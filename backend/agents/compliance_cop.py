from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from agents.state import CandidateRoute
from agents.tools import ComplianceRAGTool

EmitEvent = Callable[[int, str, str, str, dict[str, Any] | None], Awaitable[None]]


@dataclass
class ComplianceResult:
    compliant_route_ids: list[str]
    violating_route_ids: list[str]


class ComplianceCopAgent:
    """Audits reroute options for jurisdictional and GDP compliance."""

    RESTRICTED_ZONES = {"EG", "SY", "YE", "SD"}

    def __init__(self) -> None:
        self.rag_tool = ComplianceRAGTool()

    async def audit_options(
        self,
        session: AsyncSession,
        ticket_id: int,
        reading_id: str,
        cargo_type: str,
        emit_event: EmitEvent,
    ) -> ComplianceResult:
        result = await session.execute(
            text(
                """
                SELECT
                    id,
                    route_id,
                    transit_mode,
                    estimated_hours,
                    risk_score,
                    path_nodes,
                    waypoints
                FROM public.reroute_options
                WHERE ticket_id = :ticket_id
                ORDER BY option_rank ASC
                """
            ),
            {"ticket_id": ticket_id},
        )
        rows = result.fetchall()

        compliant: list[str] = []
        violating: list[str] = []

        await emit_event(
            ticket_id,
            reading_id,
            "Compliance Cop",
            "initiated audit",
            {"route_count": len(rows)},
        )

        for row in rows:
            option_id = int(row[0])
            route_id = str(row[1])
            transit_mode = str(row[2])
            estimated_hours = float(row[3] or 0.0)
            risk_score = float(row[4] or 100.0)
            path_nodes = row[5] or []
            waypoints = row[6] or []

            route = CandidateRoute(
                route_id=route_id,
                transit_mode=transit_mode if transit_mode in {"air", "maritime", "multimodal"} else "multimodal",
                leg_count=max(1, len(path_nodes) - 1),
                estimated_hours=estimated_hours,
                origin_id=str(path_nodes[0]) if path_nodes else "UNK",
                destination_id=str(path_nodes[-1]) if path_nodes else "UNK",
                path_nodes=[str(node) for node in path_nodes],
                waypoints=[[float(p[0]), float(p[1])] for p in waypoints if isinstance(p, (list, tuple)) and len(p) == 2],
                risk_score=risk_score,
            )

            jurisdictions = await self._collect_jurisdictions(session, route)
            rag_summary = self.rag_tool.summarize_for_route(route=route, cargo_type=cargo_type)

            violations: list[str] = []
            if not jurisdictions:
                violations.append("No certified jurisdiction/cold-chain hub found along route")

            restricted = sorted(set(jurisdictions).intersection(self.RESTRICTED_ZONES))
            if restricted:
                violations.append(f"Restricted zone transit detected: {', '.join(restricted)}")

            for jurisdiction in jurisdictions:
                await session.execute(
                    text(
                        """
                        INSERT INTO public.jurisdiction_checks (
                            ticket_id,
                            option_id,
                            route_id,
                            jurisdiction_code,
                            check_status,
                            details,
                            created_at
                        ) VALUES (
                            :ticket_id,
                            :option_id,
                            :route_id,
                            :jurisdiction_code,
                            'CHECKED',
                            :details,
                            now()
                        )
                        """
                    ),
                    {
                        "ticket_id": ticket_id,
                        "option_id": option_id,
                        "route_id": route_id,
                        "jurisdiction_code": jurisdiction,
                        "details": "Waypoint/path jurisdiction evaluated",
                    },
                )

            compliance_status = "VIOLATION" if violations else "COMPLIANT"
            if compliance_status == "VIOLATION":
                violating.append(route_id)
                for clause in violations:
                    await session.execute(
                        text(
                            """
                            INSERT INTO public.regulation_citations (
                                ticket_id,
                                option_id,
                                route_id,
                                clause,
                                source,
                                severity,
                                created_at
                            ) VALUES (
                                :ticket_id,
                                :option_id,
                                :route_id,
                                :clause,
                                :source,
                                :severity,
                                now()
                            )
                            """
                        ),
                        {
                            "ticket_id": ticket_id,
                            "option_id": option_id,
                            "route_id": route_id,
                            "clause": clause,
                            "source": "RULE_ENGINE",
                            "severity": "HIGH",
                        },
                    )
            else:
                compliant.append(route_id)

            await session.execute(
                text(
                    """
                    UPDATE public.reroute_options
                    SET compliance_status = :compliance_status,
                        compliance_note = :compliance_note,
                        compliance_summary = :compliance_summary,
                        updated_at = now()
                    WHERE id = :option_id
                    """
                ),
                {
                    "option_id": option_id,
                    "compliance_status": compliance_status,
                    "compliance_note": "; ".join(violations) if violations else "No rule-engine violations",
                    "compliance_summary": rag_summary,
                },
            )

            await emit_event(
                ticket_id,
                reading_id,
                "Compliance Cop",
                f"audited route {route_id}",
                {
                    "compliance_status": compliance_status,
                    "jurisdictions": jurisdictions,
                    "violation_count": len(violations),
                },
            )

        return ComplianceResult(compliant_route_ids=compliant, violating_route_ids=violating)

    async def _collect_jurisdictions(self, session: AsyncSession, route: CandidateRoute) -> list[str]:
        found: list[str] = []

        for node in route.path_nodes:
            code = await self._resolve_node_country(session, node)
            if code:
                found.append(code)

        for waypoint in route.waypoints:
            if len(waypoint) != 2:
                continue
            code = await self._resolve_waypoint_country(session, waypoint[0], waypoint[1])
            if code:
                found.append(code)

        unique: list[str] = []
        seen: set[str] = set()
        for code in found:
            normalized = code.upper()
            if normalized in seen:
                continue
            seen.add(normalized)
            unique.append(normalized)

        return unique

    async def _resolve_node_country(self, session: AsyncSession, node: str) -> str | None:
        result = await session.execute(
            text(
                """
                SELECT country_code FROM (
                    SELECT a.country AS country_code
                    FROM public.airports a
                    WHERE upper(a.iata_code) = upper(:node)
                    UNION ALL
                    SELECT s.country AS country_code
                    FROM public.seaports s
                    WHERE upper(s.un_code) = upper(:node)
                    LIMIT 1
                ) t
                """
            ),
            {"node": node},
        )
        row = result.first()
        return str(row[0]).upper() if row and row[0] else None

    async def _resolve_waypoint_country(self, session: AsyncSession, lat: float, lng: float) -> str | None:
        result = await session.execute(
            text(
                """
                SELECT country_code FROM (
                    SELECT a.country AS country_code,
                           abs(a.latitude - :lat) + abs(a.longitude - :lng) AS score
                    FROM public.airports a
                    WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
                    UNION ALL
                    SELECT s.country AS country_code,
                           abs(s.latitude - :lat) + abs(s.longitude - :lng) AS score
                    FROM public.seaports s
                    WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
                ) t
                ORDER BY score ASC
                LIMIT 1
                """
            ),
            {"lat": lat, "lng": lng},
        )
        row = result.first()
        return str(row[0]).upper() if row and row[0] else None
