from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.telemetry import TelemetryReading
from app.schemas.base import SuccessResponse
from app.schemas.telemetry import (
    TelemetryIngestRequest,
    TelemetryIngestResponse,
    TelemetryLatestResponse,
)

router = APIRouter()


async def _excursion_duration(
    session: AsyncSession,
    shipment_id: str,
    current_recorded_at: datetime,
) -> int:
    """
    WHO TRS 961 — find the most recent ALERT reading for this shipment
    that precedes current_recorded_at and return elapsed seconds.
    Returns 0 if no prior ALERT exists (first excursion in the chain).
    """
    stmt = (
        select(TelemetryReading)
        .where(TelemetryReading.shipment_id == shipment_id)
        .where(TelemetryReading.status == "ALERT")
        .where(TelemetryReading.recorded_at < current_recorded_at)
        .order_by(TelemetryReading.recorded_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    prior = result.scalars().first()
    if prior is None:
        return 0
    delta = current_recorded_at - prior.recorded_at
    return max(0, int(delta.total_seconds()))


@router.post("/ingest", status_code=201)
async def ingest_telemetry(
    payload: TelemetryIngestRequest,
    session: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> SuccessResponse[TelemetryIngestResponse]:
    """
    Ingest a single cold-chain telemetry reading.

    Server-side rules applied automatically:
    - temp_excursion = True  if temp_c outside [min, max]
    - alert_flag    = True  if temp_excursion
    - alert_type    = TEMP_HIGH | TEMP_LOW
    - excursion_duration_seconds = seconds since first ALERT reading for shipment
    - status        = ALERT if excursion, else caller-supplied or NORMAL
    """
    data = payload.model_dump()

    # ── WHO TRS 961 excursion detection ──────────────────────────────────────
    temp_excursion = (
        payload.temp_c < payload.temp_min_threshold
        or payload.temp_c > payload.temp_max_threshold
    )
    alert_flag = temp_excursion
    alert_type: Optional[str] = None

    if temp_excursion:
        alert_type = (
            "TEMP_HIGH" if payload.temp_c > payload.temp_max_threshold else "TEMP_LOW"
        )

    # ── Status resolution ─────────────────────────────────────────────────────
    if temp_excursion:
        status = "ALERT"
    elif payload.status:
        status = payload.status
    else:
        status = "NORMAL"

    # ── Excursion duration (WHO TRS 961) ──────────────────────────────────────
    excursion_duration_seconds = 0
    if temp_excursion:
        excursion_duration_seconds = await _excursion_duration(
            session, payload.shipment_id, payload.recorded_at
        )

    reading = TelemetryReading(
        **{k: v for k, v in data.items() if k not in {"status"}},
        temp_excursion=temp_excursion,
        alert_flag=alert_flag,
        alert_type=alert_type,
        excursion_duration_seconds=excursion_duration_seconds,
        status=status,
    )

    session.add(reading)
    await session.commit()
    await session.refresh(reading)

    return SuccessResponse(
        data=TelemetryIngestResponse(
            reading_id=reading.reading_id,
            shipment_id=reading.shipment_id,
            temp_c=reading.temp_c,
            temp_excursion=reading.temp_excursion,
            alert_flag=reading.alert_flag,
            alert_type=reading.alert_type,
            excursion_duration_seconds=reading.excursion_duration_seconds,
            status=reading.status,
            received_at=reading.received_at,
        )
    )


@router.get("/latest", status_code=200)
async def latest_telemetry(
    session: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> SuccessResponse[TelemetryLatestResponse]:
    stmt = select(TelemetryReading).order_by(TelemetryReading.recorded_at.desc()).limit(1)
    result = await session.execute(stmt)
    latest = result.scalars().first()

    if latest is None:
        return SuccessResponse(
            data=TelemetryLatestResponse(
                reading_id="",
                shipment_id="",
                temp_c=0.0,
                temp_excursion=False,
                alert_flag=False,
                status="NORMAL",
                recorded_at=datetime.utcnow(),
            )
        )

    return SuccessResponse(
        data=TelemetryLatestResponse(
            reading_id=latest.reading_id,
            shipment_id=latest.shipment_id,
            temp_c=latest.temp_c,
            temp_excursion=latest.temp_excursion,
            alert_flag=latest.alert_flag,
            status=latest.status,
            recorded_at=latest.recorded_at,
        )
    )
