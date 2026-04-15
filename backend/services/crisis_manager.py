from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text

from agents.compliance_cop import ComplianceCopAgent
from agents.diplomat import DiplomatAgent
from agents.strategist_agent import PharmaGuardStrategistAgent
from app.database import AsyncSessionLocal


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


DDL_SQL = [
    """
    CREATE TABLE IF NOT EXISTS public.shipments (
        id BIGSERIAL PRIMARY KEY,
        shipment_code TEXT NOT NULL UNIQUE,
        origin_id TEXT NOT NULL,
        dest_id TEXT NOT NULL,
        cargo_type TEXT NOT NULL,
        safe_humidity_min NUMERIC NOT NULL DEFAULT 35,
        safe_humidity_max NUMERIC NOT NULL DEFAULT 60,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.shipments
        ADD COLUMN IF NOT EXISTS safe_humidity_min NUMERIC NOT NULL DEFAULT 35;

    ALTER TABLE public.shipments
        ADD COLUMN IF NOT EXISTS safe_humidity_max NUMERIC NOT NULL DEFAULT 60;
    """,
    """
    CREATE TABLE IF NOT EXISTS public.crisis_tickets (
        id BIGSERIAL PRIMARY KEY,
        reading_id TEXT NOT NULL UNIQUE,
        shipment_id TEXT,
        status VARCHAR NOT NULL DEFAULT 'GENERATING',
        telemetry_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.reroute_options (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT NOT NULL REFERENCES public.crisis_tickets(id) ON DELETE CASCADE,
        option_rank INT NOT NULL,
        route_id TEXT NOT NULL,
        transit_mode TEXT NOT NULL,
        estimated_hours DOUBLE PRECISION,
        risk_score DOUBLE PRECISION,
        path_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
        waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
        strategist_note TEXT,
        compliance_status VARCHAR NOT NULL DEFAULT 'PENDING',
        compliance_note TEXT,
        compliance_summary TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.jurisdiction_checks (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT NOT NULL REFERENCES public.crisis_tickets(id) ON DELETE CASCADE,
        option_id BIGINT REFERENCES public.reroute_options(id) ON DELETE CASCADE,
        route_id TEXT NOT NULL,
        jurisdiction_code TEXT,
        check_status TEXT,
        details TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.regulation_citations (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT NOT NULL REFERENCES public.crisis_tickets(id) ON DELETE CASCADE,
        option_id BIGINT REFERENCES public.reroute_options(id) ON DELETE CASCADE,
        route_id TEXT NOT NULL,
        clause TEXT NOT NULL,
        source TEXT,
        severity TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.diplomat_drafts (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT NOT NULL REFERENCES public.crisis_tickets(id) ON DELETE CASCADE,
        shipment_id TEXT,
        summary_message TEXT NOT NULL,
        voice_script JSONB NOT NULL DEFAULT '{}'::jsonb,
        dispatch_status VARCHAR NOT NULL DEFAULT 'DRAFT',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.audit_logs (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT REFERENCES public.crisis_tickets(id) ON DELETE SET NULL,
        agent_name TEXT NOT NULL,
        action TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.rp_approvals (
        id BIGSERIAL PRIMARY KEY,
        ticket_id BIGINT NOT NULL REFERENCES public.crisis_tickets(id) ON DELETE CASCADE,
        reading_id TEXT,
        shipment_id TEXT,
        approved_by TEXT NOT NULL,
        approver_user_id BIGINT,
        note TEXT,
        approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.planned_routes (
        id BIGSERIAL PRIMARY KEY,
        plan_token TEXT NOT NULL UNIQUE,
        user_id BIGINT,
        origin_id TEXT NOT NULL,
        dest_id TEXT NOT NULL,
        cargo_type TEXT NOT NULL,
        recommended_route_id TEXT,
        risk_score DOUBLE PRECISION,
        compliance_summary TEXT,
        evaluated_routes JSONB NOT NULL DEFAULT '[]'::jsonb,
        thought_log JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR NOT NULL DEFAULT 'PLANNED',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS public.processed_alerts (
        reading_id TEXT PRIMARY KEY,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        agent_decision TEXT,
        resolution_status VARCHAR NOT NULL DEFAULT 'PENDING'
    );
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'processed_alerts'
              AND c.conname = 'processed_alerts_reading_id_fkey'
        ) THEN
            ALTER TABLE public.processed_alerts
            ADD CONSTRAINT processed_alerts_reading_id_fkey
            FOREIGN KEY (reading_id)
            REFERENCES public.telemetry_readings(reading_id)
            ON DELETE CASCADE;
        END IF;
    END
    $$;
    """,
    """
    CREATE TABLE IF NOT EXISTS public.crisis_events (
        id BIGSERIAL PRIMARY KEY,
        reading_id TEXT NOT NULL UNIQUE,
        shipment_id TEXT NOT NULL,
        recommendation_route_id TEXT,
        risk_score DOUBLE PRECISION,
        thought_log JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
]


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

        ticket_id = await self._upsert_crisis_ticket(telemetry)
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

    async def _upsert_crisis_ticket(self, telemetry: TelemetrySnapshot) -> int:
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

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text(
                    """
                    INSERT INTO public.crisis_tickets (
                        reading_id,
                        shipment_id,
                        status,
                        telemetry_snapshot,
                        created_at,
                        updated_at
                    ) VALUES (
                        :reading_id,
                        :shipment_id,
                        'GENERATING',
                        cast(:snapshot as jsonb),
                        now(),
                        now()
                    )
                    ON CONFLICT (reading_id) DO UPDATE
                    SET shipment_id = excluded.shipment_id,
                        status = 'GENERATING',
                        telemetry_snapshot = excluded.telemetry_snapshot,
                        updated_at = now()
                    RETURNING id
                    """
                ),
                {
                    "reading_id": telemetry.reading_id,
                    "shipment_id": telemetry.shipment_id,
                    "snapshot": json.dumps(snapshot),
                },
            )
            row = result.first()
            await session.commit()

        return int(row[0])

    async def _emit_agent_event(
        self,
        ticket_id: int,
        reading_id: str,
        agent_name: str,
        action: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        payload = details or {}

        async with AsyncSessionLocal() as session:
            await session.execute(
                text(
                    """
                    INSERT INTO public.audit_logs (
                        ticket_id,
                        agent_name,
                        action,
                        details,
                        created_at
                    ) VALUES (
                        :ticket_id,
                        :agent_name,
                        :action,
                        cast(:details as jsonb),
                        now()
                    )
                    """
                ),
                {
                    "ticket_id": ticket_id,
                    "agent_name": agent_name,
                    "action": action,
                    "details": json.dumps(payload),
                },
            )
            await session.commit()

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
        ticket_id: int,
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
                    SET status = 'PENDING_APPROVAL',
                        updated_at = now()
                    WHERE id = :ticket_id
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

            # Best-effort status sync across schemas where shipment id may be text or uuid.
            try:
                await session.execute(
                    text(
                        """
                        UPDATE public.shipments
                        SET status = 'REROUTING_PROPOSED'
                        WHERE shipment_code = :shipment_id
                           OR CAST(shipment_id AS text) = :shipment_id
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



