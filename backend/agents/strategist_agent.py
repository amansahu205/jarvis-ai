from __future__ import annotations

import json

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from agents.state import (
    CandidateRoute,
    Recommendation,
    RouteComparisonRow,
    StrategistAgentState,
    StrategistOutput,
)
from agents.tools import ComplianceRAGTool, RiskRankerTool, RoutePathfinderTool


SYSTEM_PROMPT = (
    "You are PharmaGuard Strategist. Plan pharmaceutical cold-chain routes with "
    "a strict Plan -> Act -> Observe loop, prioritize compliance and safety over speed, "
    "and always provide a primary recommendation with a transparent risk rationale."
)


class PharmaGuardStrategistAgent:
    def __init__(self) -> None:
        self.route_pathfinder_tool = RoutePathfinderTool()
        self.risk_ranker_tool = RiskRankerTool()
        self.compliance_rag_tool = ComplianceRAGTool()
        self.system_prompt = SYSTEM_PROMPT

    def _emit_thought(self, state: StrategistAgentState, log_message: str) -> None:
        # TODO: Connect to Kafka producer.topic('agent_thoughts').
        print(log_message)
        state.thought_log.append(log_message)

    async def plan_new_route(
        self,
        session: AsyncSession,
        origin_id: str,
        dest_id: str,
        cargo_type: str,
    ) -> StrategistOutput:
        state = StrategistAgentState(
            objective="plan_new_route",
            origin_id=origin_id,
            dest_id=dest_id,
            cargo_type=cargo_type,
        )
        self._emit_thought(state, "Planning objective confirmed: proactive compliant route generation.")

        await self._run_plan_act_observe(session, state)
        return self._build_output(state)

    async def save_planned_route(
        self,
        session: AsyncSession,
        *,
        plan_token: str,
        user_id: int,
        origin_id: str,
        dest_id: str,
        cargo_type: str,
        output: StrategistOutput,
    ) -> None:
        await session.execute(
            text(
                """
                INSERT INTO public.planned_routes (
                    plan_token,
                    user_id,
                    origin_id,
                    dest_id,
                    cargo_type,
                    recommended_route_id,
                    risk_score,
                    compliance_summary,
                    evaluated_routes,
                    thought_log,
                    status,
                    created_at
                ) VALUES (
                    :plan_token,
                    :user_id,
                    :origin_id,
                    :dest_id,
                    :cargo_type,
                    :recommended_route_id,
                    :risk_score,
                    :compliance_summary,
                    cast(:evaluated_routes as jsonb),
                    cast(:thought_log as jsonb),
                    'PLANNED',
                    now()
                )
                ON CONFLICT (plan_token) DO UPDATE
                SET user_id = excluded.user_id,
                    origin_id = excluded.origin_id,
                    dest_id = excluded.dest_id,
                    cargo_type = excluded.cargo_type,
                    recommended_route_id = excluded.recommended_route_id,
                    risk_score = excluded.risk_score,
                    compliance_summary = excluded.compliance_summary,
                    evaluated_routes = excluded.evaluated_routes,
                    thought_log = excluded.thought_log,
                    status = excluded.status,
                    created_at = now()
                """
            ),
            {
                "plan_token": plan_token,
                "user_id": user_id,
                "origin_id": origin_id,
                "dest_id": dest_id,
                "cargo_type": cargo_type,
                "recommended_route_id": output.recommended_route_id,
                "risk_score": float(output.risk_score),
                "compliance_summary": output.compliance_summary,
                "evaluated_routes": json.dumps([route.model_dump() for route in output.evaluated_routes]),
                "thought_log": json.dumps(output.thought_log),
            },
        )

    async def handle_crisis_reroute(
        self,
        session: AsyncSession,
        shipment_id: str,
        current_coords: list[float],
        crisis_type: str,
    ) -> StrategistOutput:
        inferred_origin, inferred_dest, inferred_cargo = await self._resolve_crisis_context(
            session=session,
            shipment_id=shipment_id,
            current_coords=current_coords,
        )

        state = StrategistAgentState(
            objective="handle_crisis_reroute",
            shipment_id=shipment_id,
            origin_id=inferred_origin,
            dest_id=inferred_dest,
            cargo_type=inferred_cargo,
            current_coords=current_coords,
            crisis_type=crisis_type,
            root_cause=self._identify_root_cause(crisis_type),
        )
        self._emit_thought(
            state,
            f"Crisis trigger received for shipment {shipment_id}; starting emergency reroute analysis.",
        )
        self._emit_thought(
            state,
            f"Root cause classified as {state.root_cause} for crisis type '{crisis_type}'.",
        )

        await self._run_plan_act_observe(session, state)
        return self._build_output(state)

    async def save_reroute_options(
        self,
        session: AsyncSession,
        ticket_id: int,
        routes: list[CandidateRoute],
    ) -> None:
        await session.execute(
            text(
                """
                DELETE FROM public.reroute_options
                WHERE ticket_id = :ticket_id
                """
            ),
            {"ticket_id": ticket_id},
        )

        for index, route in enumerate(routes[:3], start=1):
            await session.execute(
                text(
                    """
                    INSERT INTO public.reroute_options (
                        ticket_id,
                        option_rank,
                        route_id,
                        transit_mode,
                        estimated_hours,
                        risk_score,
                        path_nodes,
                        waypoints,
                        strategist_note,
                        compliance_status,
                        compliance_note,
                        compliance_summary,
                        created_at,
                        updated_at
                    ) VALUES (
                        :ticket_id,
                        :option_rank,
                        :route_id,
                        :transit_mode,
                        :estimated_hours,
                        :risk_score,
                        cast(:path_nodes as jsonb),
                        cast(:waypoints as jsonb),
                        :strategist_note,
                        'PENDING',
                        'Awaiting Compliance Cop audit',
                        :compliance_summary,
                        now(),
                        now()
                    )
                    """
                ),
                {
                    "ticket_id": ticket_id,
                    "option_rank": index,
                    "route_id": route.route_id,
                    "transit_mode": route.transit_mode,
                    "estimated_hours": float(route.estimated_hours),
                    "risk_score": float(route.risk_score or 100.0),
                    "path_nodes": json.dumps(route.path_nodes),
                    "waypoints": json.dumps(route.waypoints),
                    "strategist_note": route.strategist_note,
                    "compliance_summary": route.compliance_summary,
                },
            )

    def _identify_root_cause(self, crisis_type: str | None) -> str:
        if not crisis_type:
            return "GEOPOLITICAL"

        lowered = crisis_type.lower()
        thermal_tokens = ("temp", "thermal", "humidity", "cold", "heat", "excursion")
        if any(token in lowered for token in thermal_tokens):
            return "THERMAL"
        return "GEOPOLITICAL"

    async def _run_plan_act_observe(
        self,
        session: AsyncSession,
        state: StrategistAgentState,
    ) -> None:
        self._emit_thought(state, "Plan phase: selecting candidate path strategies (air, maritime, multimodal).")

        self._emit_thought(
            state,
            f"Act phase: invoking route pathfinder for {state.origin_id} -> {state.dest_id} ({state.cargo_type}).",
        )
        candidates = await self.route_pathfinder_tool.find_candidate_routes(
            session=session,
            origin_id=state.origin_id,
            dest_id=state.dest_id,
            cargo_type=state.cargo_type,
            current_coords=state.current_coords,
            max_candidates=3,
        )
        state.candidate_routes = candidates[:3]

        self._emit_thought(state, f"Observe phase: {len(state.candidate_routes)} candidate routes were discovered.")

        if state.objective == 'handle_crisis_reroute' and state.shipment_id:
            cumulative_excursion_seconds = await self.risk_ranker_tool.get_cumulative_excursion_duration(session, state.shipment_id)
            if cumulative_excursion_seconds > 7200:
                self._emit_thought(
                    state,
                    f"Status escalated to CRITICAL: shipment {state.shipment_id} cumulative excursion duration is {cumulative_excursion_seconds}s, exceeding the 7200s stability budget.",
                )

        for idx, route in enumerate(state.candidate_routes, start=1):
            self._emit_thought(
                state,
                f"Analyzing route {idx} ({route.route_id}) for thermal, geopolitical, and operational risks.",
            )

            risk_score, risk_breakdown = await self.risk_ranker_tool.score_route(
                session=session,
                route=route,
                cargo_type=state.cargo_type,
                hub_coords=state.current_coords,
                shipment_id=state.shipment_id,
            )
            route.risk_score = risk_score
            route.risk_breakdown = risk_breakdown

            route.compliance_summary = self.compliance_rag_tool.summarize_for_route(
                route=route,
                cargo_type=state.cargo_type,
            )
            route.strategist_note = self._build_strategist_note(route, state)

            self._emit_thought(
                state,
                f"Observation for {route.route_id}: risk={route.risk_score}, main_factor={self._main_risk_factor(route)}.",
            )

        state.comparison_table = [
            RouteComparisonRow(
                route_id=route.route_id,
                transit_mode=route.transit_mode,
                estimated_hours=round(route.estimated_hours, 2),
                risk_score=round(float(route.risk_score or 100.0), 2),
                main_risk_factor=self._main_risk_factor(route),
                strategist_note=route.strategist_note,
            )
            for route in state.candidate_routes
        ]

        if not state.candidate_routes:
            self._emit_thought(state, "No viable routes found; cannot produce recommendation.")
            return

        ranked_routes = sorted(state.candidate_routes, key=lambda route: self._route_priority_key(route, state))
        best = ranked_routes[0]

        state.recommendation = Recommendation(
            recommended_route_id=best.route_id,
            risk_score=float(best.risk_score or 100.0),
            compliance_summary=best.compliance_summary,
        )
        self._emit_thought(
            state,
            f"Primary recommendation selected: {best.route_id} with risk score {state.recommendation.risk_score}.",
        )

    def _route_priority_key(self, route: CandidateRoute, state: StrategistAgentState) -> tuple[float, float, float, float]:
        risk = float(route.risk_score or 100.0)

        if state.objective != "handle_crisis_reroute":
            return (risk, route.estimated_hours, 0.0, 0.0)

        if state.root_cause == "THERMAL":
            # Thermal crises prioritize fastest path to a cold-chain node.
            return (route.estimated_hours, risk, 0.0, 0.0)

        mode_rank = {"multimodal": 0.0, "maritime": 1.0, "air": 2.0}.get(route.transit_mode, 3.0)
        blocked_keywords = ("suez", "egypt")
        blocked_penalty = 1.0 if any(keyword in node.lower() for node in route.path_nodes for keyword in blocked_keywords) else 0.0
        # Geopolitical crises prioritize non-blocked maritime alternatives or multimodal pivots.
        return (blocked_penalty, mode_rank, risk, route.estimated_hours)

    def _main_risk_factor(self, route: CandidateRoute) -> str:
        if not route.risk_breakdown:
            return "unknown"

        weighted = {
            "thermal": 0.40 * route.risk_breakdown.thermal,
            "humidity": 0.20 * route.risk_breakdown.humidity,
            "geopolitical": 0.25 * route.risk_breakdown.geopolitical,
            "operational": 0.15 * route.risk_breakdown.operational,
        }
        return max(weighted, key=weighted.get)

    def _build_strategist_note(self, route: CandidateRoute, state: StrategistAgentState) -> str:
        main_factor = self._main_risk_factor(route)

        if state.objective == "handle_crisis_reroute" and state.root_cause == "THERMAL":
            return (
                "Thermal emergency mode: prioritize rapid transfer to cold-storage infrastructure "
                f"(primary risk factor: {main_factor})."
            )

        if state.objective == "handle_crisis_reroute" and state.root_cause == "GEOPOLITICAL":
            return (
                "Geopolitical emergency mode: prefer alternative maritime lanes or multimodal pivot "
                f"(primary risk factor: {main_factor})."
            )

        if main_factor == "thermal":
            return "Main risk driver is thermal exposure at transit hubs; active cooling controls required."
        if main_factor == "humidity":
            return "Main risk driver is humidity excursion outside the 35%-60% safe band."
        if main_factor == "geopolitical":
            return "Main risk driver is jurisdiction/corridor instability; monitor customs and disruption signals."
        return "Main risk driver is operational complexity; reduce handoffs where possible."

    async def _resolve_crisis_context(
        self,
        session: AsyncSession,
        shipment_id: str,
        current_coords: list[float],
    ) -> tuple[str, str, str]:
        sql = text(
            """
            SELECT
                COALESCE(
                    NULLIF(MAX(CASE WHEN CAST(shipment_id AS text) = :shipment_id THEN location_country_code END), ''),
                    'BOM'
                ) AS inferred_origin,
                COALESCE(
                    NULLIF(MAX(CASE WHEN CAST(shipment_id AS text) = :shipment_id THEN location_description END), ''),
                    'JFK'
                ) AS inferred_destination,
                COALESCE(
                    NULLIF(MAX(CASE WHEN CAST(shipment_id AS text) = :shipment_id THEN medication_name END), ''),
                    'vaccine'
                ) AS inferred_cargo
            FROM public.telemetry_readings
            WHERE CAST(shipment_id AS text) = :shipment_id
            """
        )
        result = await session.execute(sql, {"shipment_id": shipment_id})
        row = result.first()

        if not row:
            return "BOM", "JFK", "vaccine"

        inferred_origin = str(row[0] or "BOM").upper()
        inferred_destination = str(row[1] or "JFK").upper()
        inferred_cargo = str(row[2] or "vaccine").lower()

        _ = current_coords
        return inferred_origin, inferred_destination, inferred_cargo

    def _build_output(self, state: StrategistAgentState) -> StrategistOutput:
        if state.recommendation is None:
            return StrategistOutput(
                recommended_route_id="",
                risk_score=100.0,
                compliance_summary="No recommendation available.",
                thought_log=state.thought_log,
                evaluated_routes=state.candidate_routes,
                comparison_table=state.comparison_table,
            )

        return StrategistOutput(
            recommended_route_id=state.recommendation.recommended_route_id,
            risk_score=state.recommendation.risk_score,
            compliance_summary=state.recommendation.compliance_summary,
            thought_log=state.thought_log,
            evaluated_routes=state.candidate_routes,
            comparison_table=state.comparison_table,
        )



