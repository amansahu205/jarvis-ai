from __future__ import annotations

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from agents.state import (
    CandidateRoute,
    Recommendation,
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
        state.thought_log.append("Planning objective confirmed: proactive compliant route generation.")

        await self._run_plan_act_observe(session, state)
        return self._build_output(state)

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
        )
        state.thought_log.append(
            f"Crisis trigger received for shipment {shipment_id}; starting emergency reroute analysis."
        )
        state.thought_log.append(
            f"Evaluating impact of crisis type '{crisis_type}' from live coordinates {current_coords}."
        )

        await self._run_plan_act_observe(session, state)
        return self._build_output(state)

    async def _run_plan_act_observe(
        self,
        session: AsyncSession,
        state: StrategistAgentState,
    ) -> None:
        # PLAN
        state.thought_log.append("Plan phase: selecting candidate path strategies (air, maritime, multimodal).")

        # ACT
        state.thought_log.append(
            f"Act phase: invoking route pathfinder for {state.origin_id} -> {state.dest_id} ({state.cargo_type})."
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

        # OBSERVE
        state.thought_log.append(f"Observe phase: {len(state.candidate_routes)} candidate routes were discovered.")

        for idx, route in enumerate(state.candidate_routes, start=1):
            state.thought_log.append(
                f"Analyzing thermal stability and transit exposure for candidate {idx} ({route.route_id})."
            )
            risk_score, risk_breakdown = self.risk_ranker_tool.score_route(
                route=route,
                cargo_type=state.cargo_type,
                crisis_type=state.crisis_type,
            )
            route.risk_score = risk_score
            route.risk_breakdown = risk_breakdown

            state.thought_log.append(
                f"Retrieving regulatory clauses via compliance RAG for candidate {idx} ({route.route_id})."
            )
            route.compliance_summary = self.compliance_rag_tool.summarize_for_route(
                route=route,
                cargo_type=state.cargo_type,
            )

            state.thought_log.append(
                f"Observation for {route.route_id}: risk={route.risk_score}, compliance signal captured."
            )

        if not state.candidate_routes:
            state.thought_log.append("No viable routes found; cannot produce recommendation.")
            return

        state.candidate_routes.sort(key=lambda r: (r.risk_score if r.risk_score is not None else 100.0, r.estimated_hours))
        best = state.candidate_routes[0]

        state.recommendation = Recommendation(
            recommended_route_id=best.route_id,
            risk_score=float(best.risk_score or 100.0),
            compliance_summary=best.compliance_summary,
        )
        state.thought_log.append(
            f"Primary recommendation selected: {best.route_id} with risk score {state.recommendation.risk_score}."
        )

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
                    NULLIF(MAX(CASE WHEN shipment_id = :shipment_id THEN location_country_code END), ''),
                    'BOM'
                ) AS inferred_origin,
                COALESCE(
                    NULLIF(MAX(CASE WHEN shipment_id = :shipment_id THEN location_description END), ''),
                    'JFK'
                ) AS inferred_destination,
                COALESCE(
                    NULLIF(MAX(CASE WHEN shipment_id = :shipment_id THEN medication_name END), ''),
                    'vaccine'
                ) AS inferred_cargo
            FROM public.telemetry_readings
            WHERE shipment_id = :shipment_id
            """
        )
        result = await session.execute(sql, {"shipment_id": shipment_id})
        row = result.first()

        if not row:
            return "BOM", "JFK", "vaccine"

        inferred_origin = str(row[0] or "BOM").upper()
        inferred_destination = str(row[1] or "JFK").upper()
        inferred_cargo = str(row[2] or "vaccine").lower()

        # Keep explicit [lat, lng] semantics available to downstream tools.
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
            )

        return StrategistOutput(
            recommended_route_id=state.recommendation.recommended_route_id,
            risk_score=state.recommendation.risk_score,
            compliance_summary=state.recommendation.compliance_summary,
            thought_log=state.thought_log,
            evaluated_routes=state.candidate_routes,
        )
