from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

EmitEvent = Callable[[int, str, str, str, dict[str, Any] | None], Awaitable[None]]


@dataclass
class DiplomatDraftResult:
    route_id: str
    dispatch_status: str


class DiplomatAgent:
    """Generates human-facing crisis communications for Dr. Aris."""

    async def draft_briefing(
        self,
        session: AsyncSession,
        ticket_id: int,
        reading_id: str,
        shipment_id: str,
        emit_event: EmitEvent,
    ) -> DiplomatDraftResult:
        route_row = await self._pick_top_route(session, ticket_id)

        if not route_row:
            summary = (
                f"Dr. Aris, crisis ticket {ticket_id} has no compliant reroute options yet. "
                "Please hold shipment and await manual command."
            )
            voice_script = {
                "call_type": "CRISIS_BRIEFING",
                "recipient": "Dr. Aris",
                "priority": "HIGH",
                "message": summary,
                "actions": ["Hold shipment", "Escalate to operations lead"],
            }
            route_id = ""
        else:
            route_id = str(route_row[0])
            transit_mode = str(route_row[1])
            estimated_hours = float(route_row[2] or 0.0)
            risk_score = float(route_row[3] or 100.0)
            compliance_note = str(route_row[4] or "")

            summary = (
                f"Dr. Aris, ticket {ticket_id} is ready for approval. "
                f"Recommended route {route_id} ({transit_mode}) with ETA {estimated_hours:.1f}h and risk {risk_score:.1f}. "
                f"Compliance note: {compliance_note}."
            )
            voice_script = {
                "call_type": "CRISIS_BRIEFING",
                "recipient": "Dr. Aris",
                "priority": "HIGH",
                "opening": "This is PharmaGuard Diplomat with an urgent reroute recommendation.",
                "route_id": route_id,
                "risk_score": risk_score,
                "eta_hours": estimated_hours,
                "compliance_note": compliance_note,
                "approval_prompt": "Reply APPROVE to dispatch this route, or REJECT for manual override.",
            }

        await session.execute(
            text(
                """
                INSERT INTO public.diplomat_drafts (
                    ticket_id,
                    shipment_id,
                    summary_message,
                    voice_script,
                    dispatch_status,
                    created_at
                ) VALUES (
                    :ticket_id,
                    :shipment_id,
                    :summary_message,
                    cast(:voice_script as jsonb),
                    'DRAFT',
                    now()
                )
                """
            ),
            {
                "ticket_id": ticket_id,
                "shipment_id": shipment_id,
                "summary_message": summary,
                "voice_script": __import__("json").dumps(voice_script),
            },
        )

        await emit_event(
            ticket_id,
            reading_id,
            "Diplomat",
            "generated Dr. Aris briefing drafts",
            {"route_id": route_id, "dispatch_status": "DRAFT"},
        )

        return DiplomatDraftResult(route_id=route_id, dispatch_status="DRAFT")

    async def _pick_top_route(self, session: AsyncSession, ticket_id: int):
        result = await session.execute(
            text(
                """
                SELECT route_id, transit_mode, estimated_hours, risk_score, compliance_note
                FROM public.reroute_options
                WHERE ticket_id = :ticket_id
                  AND compliance_status = 'COMPLIANT'
                ORDER BY risk_score ASC NULLS LAST, option_rank ASC
                LIMIT 1
                """
            ),
            {"ticket_id": ticket_id},
        )
        row = result.first()
        if row:
            return row

        fallback = await session.execute(
            text(
                """
                SELECT route_id, transit_mode, estimated_hours, risk_score, compliance_note
                FROM public.reroute_options
                WHERE ticket_id = :ticket_id
                ORDER BY risk_score ASC NULLS LAST, option_rank ASC
                LIMIT 1
                """
            ),
            {"ticket_id": ticket_id},
        )
        return fallback.first()
