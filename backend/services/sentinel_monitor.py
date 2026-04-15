from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text

from app.database import AsyncSessionLocal
from services.crisis_manager import CrisisOrchestrator


logger = logging.getLogger(__name__)


@dataclass
class PendingAlert:
    reading_id: str
    shipment_id: str
    lat: float
    lng: float
    alert_type: str | None
    status: str | None
    recorded_at: datetime | None


FETCH_PENDING_SQL = text(
    """
    SELECT
        t.reading_id,
        COALESCE(CAST(t.shipment_id AS text), '') AS shipment_id,
        t.lat,
        t.lng,
        t.alert_type,
        t.status,
        t.recorded_at
    FROM public.telemetry_readings t
    LEFT JOIN public.processed_alerts p
      ON p.reading_id = t.reading_id
    WHERE upper(coalesce(t.status, '')) = 'CRITICAL'
      AND p.reading_id IS NULL
    ORDER BY t.recorded_at ASC NULLS LAST
    LIMIT :batch_size
    """
)


class SentinelAgent:
    def __init__(self, poll_seconds: int = 20, batch_size: int = 20) -> None:
        self.poll_seconds = poll_seconds
        self.batch_size = batch_size
        self.orchestrator = CrisisOrchestrator()

    async def ensure_tables(self) -> None:
        await self.orchestrator.ensure_tables()

    async def _fetch_pending_alerts(self) -> list[PendingAlert]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(FETCH_PENDING_SQL, {"batch_size": self.batch_size})
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

    async def _handle_alert(self, alert: PendingAlert) -> None:
        crisis_type = alert.alert_type or alert.status or "CRITICAL"
        logger.info(
            "Sentinel forwarding to CrisisOrchestrator reading_id=%s shipment_id=%s crisis_type=%s",
            alert.reading_id,
            alert.shipment_id,
            crisis_type,
        )

        try:
            await self.orchestrator.initiate_resolution(alert.reading_id)
            logger.info(
                "Sentinel completed swarm flow for reading_id=%s shipment_id=%s",
                alert.reading_id,
                alert.shipment_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "Sentinel failed for reading_id=%s shipment_id=%s: %s",
                alert.reading_id,
                alert.shipment_id,
                exc,
            )

    async def run_forever(self) -> None:
        logger.info("SentinelAgent started with poll interval=%ss", self.poll_seconds)
        await self.ensure_tables()

        while True:
            try:
                pending = await self._fetch_pending_alerts()
                if pending:
                    logger.info("Sentinel found %d new critical alerts", len(pending))
                for alert in pending:
                    await self._handle_alert(alert)
            except Exception as loop_exc:  # noqa: BLE001
                logger.exception("Sentinel loop error: %s", loop_exc)

            await asyncio.sleep(self.poll_seconds)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


async def start_sentinel_monitor() -> None:
    configure_logging()
    await SentinelAgent().run_forever()


async def main() -> None:
    await start_sentinel_monitor()


if __name__ == "__main__":
    asyncio.run(main())
