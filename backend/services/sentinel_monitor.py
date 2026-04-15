from __future__ import annotations

import asyncio
import json
import logging
import random
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text

from agents.strategist_agent import PharmaGuardStrategistAgent
from app.database import AsyncSessionLocal


logger = logging.getLogger("sentinel_monitor")


@dataclass
class PendingAlert:
    reading_id: str
    shipment_id: str
    lat: float
    lng: float
    alert_type: str | None
    status: str | None
    recorded_at: datetime | None


DDL_SQL = [
    """
    CREATE TABLE IF NOT EXISTS public.processed_alerts (
        reading_id VARCHAR PRIMARY KEY,
        processed_at TIMESTAMPTZ DEFAULT now(),
        agent_decision TEXT,
        resolution_status VARCHAR DEFAULT 'PENDING'
    );
    """,
    """
    ALTER TABLE public.processed_alerts
        ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT now();
    """,
    """
    ALTER TABLE public.processed_alerts
        ADD COLUMN IF NOT EXISTS agent_decision TEXT;
    """,
    """
    ALTER TABLE public.processed_alerts
        ADD COLUMN IF NOT EXISTS resolution_status VARCHAR DEFAULT 'PENDING';
    """,
    """
    ALTER TABLE public.processed_alerts
        DROP COLUMN IF EXISTS shipment_id,
        DROP COLUMN IF EXISTS processing_status,
        DROP COLUMN IF EXISTS error_message;
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


FETCH_PENDING_SQL = text(
    """
    SELECT
        t.reading_id,
        t.shipment_id,
        t.lat,
        t.lng,
        t.alert_type,
        t.status,
        t.recorded_at
    FROM public.telemetry_readings t
    LEFT JOIN public.processed_alerts p
      ON p.reading_id = t.reading_id
    WHERE p.reading_id IS NULL
      AND (
          upper(coalesce(t.status, '')) = 'CRITICAL'
          OR coalesce(t.alert_flag, false) = true
      )
    ORDER BY t.recorded_at ASC NULLS LAST
    LIMIT :batch_size
    """
)


MARK_PROCESSED_SQL = text(
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
        :resolution_status
    )
    ON CONFLICT (reading_id) DO UPDATE
    SET processed_at = now(),
        agent_decision = excluded.agent_decision,
        resolution_status = excluded.resolution_status
    """
)


INSERT_CRISIS_EVENT_SQL = text(
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
        :recommendation_route_id,
        :risk_score,
        cast(:thought_log as jsonb),
        now()
    )
    ON CONFLICT (reading_id) DO UPDATE
    SET recommendation_route_id = excluded.recommendation_route_id,
        risk_score = excluded.risk_score,
        thought_log = excluded.thought_log,
        created_at = now()
    """
)


UPDATE_SHIPMENT_STATUS_SQL = text(
    """
    UPDATE public.shipments
    SET status = 'REROUTING_PROPOSED'
    WHERE shipment_id = :shipment_id
    """
)


async def ensure_monitor_tables() -> None:
    async with AsyncSessionLocal() as session:
        for ddl in DDL_SQL:
            await session.execute(text(ddl))
        await session.commit()


async def fetch_pending_alerts(batch_size: int = 20) -> list[PendingAlert]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(FETCH_PENDING_SQL, {"batch_size": batch_size})
        rows = result.fetchall()

    alerts: list[PendingAlert] = []
    for row in rows:
        alerts.append(
            PendingAlert(
                reading_id=str(row[0]),
                shipment_id=str(row[1]),
                lat=float(row[2]),
                lng=float(row[3]),
                alert_type=row[4],
                status=row[5],
                recorded_at=row[6],
            )
        )
    return alerts


async def mark_alert(
    reading_id: str,
    resolution_status: str,
    agent_decision: str,
) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            MARK_PROCESSED_SQL,
            {
                "reading_id": reading_id,
                "resolution_status": resolution_status,
                "agent_decision": agent_decision,
            },
        )
        await session.commit()


async def process_single_alert(alert: PendingAlert, agent: PharmaGuardStrategistAgent) -> None:
    logger.info(
        "Processing alert reading_id=%s shipment_id=%s status=%s alert_type=%s",
        alert.reading_id,
        alert.shipment_id,
        alert.status,
        alert.alert_type,
    )

    crisis_type = alert.alert_type or alert.status or "CRITICAL"

    try:
        async with AsyncSessionLocal() as session:
            output = await agent.handle_crisis_reroute(
                session=session,
                shipment_id=alert.shipment_id,
                current_coords=[alert.lat, alert.lng],
                crisis_type=crisis_type,
            )

            await session.execute(
                INSERT_CRISIS_EVENT_SQL,
                {
                    "reading_id": alert.reading_id,
                    "shipment_id": alert.shipment_id,
                    "recommendation_route_id": output.recommended_route_id,
                    "risk_score": float(output.risk_score),
                    "thought_log": json.dumps(output.thought_log),
                },
            )

            try:
                await session.execute(
                    UPDATE_SHIPMENT_STATUS_SQL,
                    {"shipment_id": alert.shipment_id},
                )
            except Exception as shipment_exc:  # noqa: BLE001
                logger.warning(
                    "Unable to update shipments table for shipment_id=%s: %s",
                    alert.shipment_id,
                    shipment_exc,
                )

            await session.commit()

        decision_summary = (
            f"route={output.recommended_route_id or 'NONE'}; "
            f"risk={output.risk_score:.2f}; "
            f"steps={len(output.thought_log)}"
        )
        await mark_alert(
            reading_id=alert.reading_id,
            resolution_status="REROUTING_PROPOSED",
            agent_decision=decision_summary,
        )

        logger.info(
            "Alert handled reading_id=%s recommended_route_id=%s thought_steps=%d",
            alert.reading_id,
            output.recommended_route_id,
            len(output.thought_log),
        )

    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "Error while processing reading_id=%s shipment_id=%s: %s",
            alert.reading_id,
            alert.shipment_id,
            exc,
        )

        await mark_alert(
            reading_id=alert.reading_id,
            resolution_status="FAILED",
            agent_decision=f"error={str(exc)[:900]}",
        )


async def monitor_loop(
    poll_min_seconds: int = 20,
    poll_max_seconds: int = 30,
    batch_size: int = 20,
) -> None:
    if poll_min_seconds <= 0 or poll_max_seconds < poll_min_seconds:
        raise ValueError("Invalid polling interval configuration")

    logger.info("Sentinel monitor starting with poll range %ss-%ss", poll_min_seconds, poll_max_seconds)
    await ensure_monitor_tables()

    agent = PharmaGuardStrategistAgent()

    while True:
        try:
            pending = await fetch_pending_alerts(batch_size=batch_size)
            if pending:
                logger.info("Found %d pending critical alerts", len(pending))
            else:
                logger.info("No pending critical alerts")

            for alert in pending:
                await process_single_alert(alert, agent)

        except Exception as loop_exc:  # noqa: BLE001
            logger.exception("Monitor loop error: %s", loop_exc)

        sleep_for = random.randint(poll_min_seconds, poll_max_seconds)
        logger.info("Sleeping %s seconds before next poll", sleep_for)
        await asyncio.sleep(sleep_for)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


async def main() -> None:
    configure_logging()
    await monitor_loop()


if __name__ == "__main__":
    asyncio.run(main())
