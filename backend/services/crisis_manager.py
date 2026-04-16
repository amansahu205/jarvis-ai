from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text

from agents.compliance_cop import ComplianceCopAgent
from agents.diplomat import DiplomatAgent
from agents.strategist_agent import PharmaGuardStrategistAgent
from app.config import settings
from app.database import AsyncSessionLocal
from app.services.twilio_service import maybe_trigger_critical_call


@dataclass
class TelemetrySnapshot:
    reading_id: str
    shipment_id: str
    status: str
    alert_type: str | None
    temp_c: float | None
    lat: float
    lng: float
    medication_name: str | None
    location_description: str | None
    recorded_at: Any


# DDL_SQL is intentionally empty — real schema is managed by Supabase migrations.
# ensure_tables() is kept as a safe no-op to avoid startup errors.
DDL_SQL: list[str] = []

def _severity_from_telemetry(alert_type: str | None, status: str | None) -> str:
    marker = (alert_type or status or "").upper()
    if marker in {"CRITICAL", "TEMP_EXCURSION", "ALERT", "CRITICAL_L1"}:
        return "CRITICAL_L1"
    return "WARNING_L2"

class CrisisOrchestrator:
    """Orchestrates Sentinel -> Strategist -> Compliance Cop -> Diplomat flow."""

    def __init__(self) -> None:
        self.strategist = PharmaGuardStrategistAgent()
        self.compliance_cop = ComplianceCopAgent()
        self.diplomat = DiplomatAgent()

    async def ensure_tables(self) -> None:
        async with AsyncSessionLocal() as session:
            for ddl in DDL_SQL:
                await session.execute(text(ddl))
            await session.commit()

    async def initiate_resolution(self, reading_id: str) -> None:
        await self.ensure_tables()
        telemetry = await self._load_telemetry(reading_id)
        if telemetry is None:
            return

        severity = _severity_from_telemetry(telemetry.alert_type, telemetry.status)
        ticket_id = await self._upsert_crisis_ticket(telemetry)

        if severity == "CRITICAL_L1":
            call_sid = await maybe_trigger_critical_call(settings.RP_PHONE_NUMBER)
            if call_sid:
                await self._emit_agent_event(
                    ticket_id,
                    reading_id,
                    "Diplomat",
                    "triggered twilio escalation call",
                    {"twilio_execution_sid": call_sid, "to": settings.RP_PHONE_NUMBER},
                )
        await self._emit_agent_event(
            ticket_id,
            reading_id,
            "Sentinel",
            "created crisis ticket",
            {"shipment_id": telemetry.shipment_id, "status": telemetry.status},
        )

        strategist_output = None
        async with AsyncSessionLocal() as session:
            strategist_output = await self.strategist.handle_crisis_reroute(
                session=session,
                shipment_id=telemetry.shipment_id,
                current_coords=[telemetry.lat, telemetry.lng],
                crisis_type=telemetry.alert_type or telemetry.status,
            )
            await self.strategist.save_reroute_options(
                session=session,
                ticket_id=ticket_id,
                routes=strategist_output.evaluated_routes[:3],
            )
            await session.commit()

        await self._emit_agent_event(
            ticket_id,
            reading_id,
            "Strategist",
            "generated reroute options",
            {
                "route_count": len(strategist_output.evaluated_routes[:3]),
                "recommended_route_id": strategist_output.recommended_route_id,
            },
        )

        async with AsyncSessionLocal() as session:
            await self.compliance_cop.audit_options(
                session=session,
                ticket_id=ticket_id,
                reading_id=reading_id,
                cargo_type=(telemetry.medication_name or "vaccine"),
                emit_event=self._emit_agent_event,
            )
            await session.commit()

        async with AsyncSessionLocal() as session:
            draft = await self.diplomat.draft_briefing(
                session=session,
                ticket_id=ticket_id,
                reading_id=reading_id,
                shipment_id=telemetry.shipment_id,
                emit_event=self._emit_agent_event,
            )
            await session.commit()

        await self._finalize_ticket(
            ticket_id=ticket_id,
            reading_id=reading_id,
            shipment_id=telemetry.shipment_id,
            recommended_route_id=draft.route_id,
            risk_score=float(strategist_output.risk_score),
        )

    async def _load_telemetry(self, reading_id: str) -> TelemetrySnapshot | None:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text(
                    """
                    SELECT
                        reading_id,
                        COALESCE(CAST(shipment_id AS text), '') AS shipment_id,
                        COALESCE(status, 'CRITICAL') AS status,
                        alert_type,
                        temp_c,
                        lat,
                        lng,
                        medication_name,
                        location_description,
                        recorded_at
                    FROM public.telemetry_readings
                    WHERE reading_id = :reading_id
                    LIMIT 1
                    """
                ),
                {"reading_id": reading_id},
            )
            row = result.first()

        if not row:
            return None

        return TelemetrySnapshot(
            reading_id=str(row[0]),
            shipment_id=str(row[1]),
            status=str(row[2]),
            alert_type=(str(row[3]) if row[3] is not None else None),
            temp_c=(float(row[4]) if row[4] is not None else None),
            lat=float(row[5]),
            lng=float(row[6]),
            medication_name=(str(row[7]) if row[7] is not None else None),
            location_description=(str(row[8]) if row[8] is not None else None),
            recorded_at=row[9],
        )

    async def _upsert_crisis_ticket(self, telemetry: TelemetrySnapshot) -> str:
        """Insert/upsert a crisis_ticket. Returns the ticket UUID."""
        snapshot = {
            "reading_id": telemetry.reading_id,
            "shipment_id": telemetry.shipment_id,
            "status": telemetry.status,
            "alert_type": telemetry.alert_type,
            "temp_c": telemetry.temp_c,
            "lat": telemetry.lat,
            "lng": telemetry.lng,
            "medication_name": telemetry.medication_name,
            "location_description": telemetry.location_description,
            "recorded_at": str(telemetry.recorded_at),
        }
        # Resolve shipment UUID from shipment_code (telemetry.shipment_id stores the code string)
        async with AsyncSessionLocal() as session:
            ship_result = await session.execute(
                text(
                    "SELECT id FROM public.shipments WHERE shipment_code = :code LIMIT 1"
                ),
                {"code": telemetry.shipment_id},
            )
            ship_row = ship_result.first()
            shipment_uuid: str | None = str(ship_row[0]) if ship_row else None

        severity = _severity_from_telemetry(telemetry.alert_type, telemetry.status)

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text(
                    """
                    INSERT INTO public.crisis_tickets (
                        shipment_id,
                        severity,
                        status,
                        anomaly_summary,
                        telemetry_snapshot,
                        created_at
                    ) VALUES (
                        :shipment_id::uuid,
                        :severity::crisis_severity,
                        'GENERATING'::crisis_status,
                        cast(:anomaly_summary as jsonb),
                        cast(:telemetry_snapshot as jsonb),
                        now()
                    )
                    ON CONFLICT DO NOTHING
                    RETURNING id
                    """
                ),
                {
                    "shipment_id": shipment_uuid,
                    "severity": severity,
                    "anomaly_summary": json.dumps({"reading_id": telemetry.reading_id, "alert_type": telemetry.alert_type}),
                    "telemetry_snapshot": json.dumps([snapshot]),
                },
            )
            row = result.first()
            await session.commit()

        if row:
            return str(row[0])
        # If ON CONFLICT DO NOTHING hit, fetch the existing ticket
        async with AsyncSessionLocal() as session:
            existing = await session.execute(
                text(
                    "SELECT id FROM public.crisis_tickets WHERE shipment_id = :sid::uuid "
                    "AND status = 'GENERATING' ORDER BY created_at DESC LIMIT 1"
                ),
                {"sid": shipment_uuid},
            )
            existing_row = existing.first()
        return str(existing_row[0]) if existing_row else ''

    async def _emit_agent_event(
        self,
        ticket_id: str,  # UUID string
        reading_id: str,
        agent_name: str,
        action: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        payload = details or {}
        # Map free-form action strings to valid audit_event_type enum values
        _ACTION_TO_EVENT = {
            'created crisis ticket': 'ANOMALY_DETECTED',
            'generated reroute options': 'ROUTE_COMPLIANCE_CHECK',
            'ticket moved to PENDING_APPROVAL': 'RP_ALERTED',
            'approved': 'RP_APPROVED',
            'rejected': 'RP_REJECTED',
            'dispatch': 'DISPATCH_COMPLETE',
            'triggered twilio escalation call': 'RP_ALERTED',
        }
        event_type = next(
            (v for k, v in _ACTION_TO_EVENT.items() if k.lower() in action.lower()),
            'ROUTE_COMPLIANCE_CHECK',  # safe default
        )

        try:
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text(
                        """
                        INSERT INTO public.audit_logs (
                            crisis_ticket_id,
                            actor_agent,
                            event_type,
                            payload_summary,
                            occurred_at
                        ) VALUES (
                            :crisis_ticket_id::uuid,
                            :actor_agent,
                            :event_type::audit_event_type,
                            cast(:payload_summary as jsonb),
                            now()
                        )
                        """
                    ),
                    {
                        "crisis_ticket_id": ticket_id,
                        "actor_agent": agent_name,
                        "event_type": event_type,
                        "payload_summary": json.dumps({"action": action, **payload}),
                    },
                )
                await session.commit()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning('audit_log emit failed (non-fatal): %s', exc)

        msg = f"{agent_name}: {action}"
        if payload:
            msg += f" | {payload}"
        await self._append_crisis_thought(reading_id, msg)

    async def _append_crisis_thought(self, reading_id: str, message: str) -> None:
        async with AsyncSessionLocal() as session:
            existing = await session.execute(
                text(
                    """
                    SELECT thought_log, COALESCE(CAST(shipment_id AS text), '') AS shipment_id
                    FROM public.crisis_events
                    WHERE reading_id = :reading_id
                    LIMIT 1
                    """
                ),
                {"reading_id": reading_id},
            )
            row = existing.first()

            if row:
                logs = list(row[0] or [])
                logs.append(message)
                await session.execute(
                    text(
                        """
                        UPDATE public.crisis_events
                        SET thought_log = cast(:thought_log as jsonb)
                        WHERE reading_id = :reading_id
                        """
                    ),
                    {"reading_id": reading_id, "thought_log": json.dumps(logs)},
                )
            else:
                shipment_result = await session.execute(
                    text(
                        """
                        SELECT COALESCE(CAST(shipment_id AS text), '')
                        FROM public.telemetry_readings
                        WHERE reading_id = :reading_id
                        LIMIT 1
                        """
                    ),
                    {"reading_id": reading_id},
                )
                shipment_row = shipment_result.first()
                shipment_id = str(shipment_row[0]) if shipment_row else ""

                await session.execute(
                    text(
                        """
                        INSERT INTO public.crisis_events (
                            reading_id,
                            shipment_id,
                            thought_log,
                            created_at
                        ) VALUES (
                            :reading_id,
                            :shipment_id,
                            cast(:thought_log as jsonb),
                            now()
                        )
                        ON CONFLICT (reading_id) DO UPDATE
                        SET thought_log = excluded.thought_log
                        """
                    ),
                    {
                        "reading_id": reading_id,
                        "shipment_id": shipment_id,
                        "thought_log": json.dumps([message]),
                    },
                )

            await session.commit()

    async def _finalize_ticket(
        self,
        ticket_id: str,  # UUID string
        reading_id: str,
        shipment_id: str,
        recommended_route_id: str,
        risk_score: float,
    ) -> None:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text(
                    """
                    UPDATE public.crisis_tickets
                    SET status = 'PENDING_APPROVAL'::crisis_status
                    WHERE id = :ticket_id::uuid
                    """
                ),
                {"ticket_id": ticket_id},
            )

            await session.execute(
                text(
                    """
                    INSERT INTO public.processed_alerts (
                        reading_id,
                        processed_at,
                        agent_decision,
                        resolution_status
                    ) VALUES (
                        :reading_id,
                        now(),
                        :agent_decision,
                        'PENDING_APPROVAL'
                    )
                    ON CONFLICT (reading_id) DO UPDATE
                    SET processed_at = now(),
                        agent_decision = excluded.agent_decision,
                        resolution_status = excluded.resolution_status
                    """
                ),
                {
                    "reading_id": reading_id,
                    "agent_decision": recommended_route_id,
                },
            )

            await session.execute(
                text(
                    """
                    INSERT INTO public.crisis_events (
                        reading_id,
                        shipment_id,
                        recommendation_route_id,
                        risk_score,
                        thought_log,
                        created_at
                    ) VALUES (
                        :reading_id,
                        :shipment_id,
                        :recommended_route_id,
                        :risk_score,
                        cast(:thought_log as jsonb),
                        now()
                    )
                    ON CONFLICT (reading_id) DO UPDATE
                    SET recommendation_route_id = excluded.recommendation_route_id,
                        risk_score = excluded.risk_score
                    """
                ),
                {
                    "reading_id": reading_id,
                    "shipment_id": shipment_id,
                    "recommended_route_id": recommended_route_id,
                    "risk_score": risk_score,
                    "thought_log": json.dumps([]),
                },
            )

            # Best-effort status sync — use CRISIS_OPEN (valid shipment_status enum value)
            try:
                await session.execute(
                    text(
                        """
                        UPDATE public.shipments
                        SET status = 'CRISIS_OPEN'::shipment_status
                        WHERE shipment_code = :shipment_id
                        """
                    ),
                    {"shipment_id": shipment_id},
                )
            except Exception:
                pass

            await session.commit()

        await self._emit_agent_event(
            ticket_id,
            reading_id,
            "Orchestrator",
            "ticket moved to PENDING_APPROVAL",
            {
                "recommended_route_id": recommended_route_id,
                "frontend_signal": "CRISIS_PENDING_APPROVAL",
            },
        )






