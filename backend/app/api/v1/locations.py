from fastapi import APIRouter, Query, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.schemas.shipments import ActiveShipmentItem
from app.services.shipment_service import load_active_shipments

router = APIRouter()


@router.get("/search")
async def search_locations(
    q: str = Query(min_length=2, max_length=50),
    mode: str = Query(default="air"),
    session: AsyncSession = Depends(get_db),
):
    q_clean = q.strip()

    if mode == "maritime":
        result = await session.execute(
            text("""
                SELECT
                    un_code     AS code,
                    port_name   AS label,
                    country,
                    area_global AS region,
                    NULL::float AS latitude,
                    NULL::float AS longitude
                FROM seaports
                WHERE un_code   ILIKE :prefix
                   OR port_name ILIKE :contains
                   OR country   ILIKE :prefix
                ORDER BY
                    CASE WHEN un_code ILIKE :prefix THEN 0 ELSE 1 END,
                    port_name
                LIMIT 10
            """),
            {"prefix": f"{q_clean}%", "contains": f"%{q_clean}%"},
        )
    else:
        result = await session.execute(
            text("""
                SELECT
                    iata_code                         AS code,
                    airport || ', ' || city           AS label,
                    country,
                    city                              AS region,
                    latitude::float                   AS latitude,
                    longitude::float                  AS longitude
                FROM airports
                WHERE iata_code ILIKE :prefix
                   OR airport   ILIKE :contains
                   OR city      ILIKE :prefix
                ORDER BY
                    CASE WHEN iata_code ILIKE :prefix THEN 0 ELSE 1 END,
                    airport
                LIMIT 10
            """),
            {"prefix": f"{q_clean}%", "contains": f"%{q_clean}%"},
        )

    rows = result.mappings().all()
    return [dict(r) for r in rows]


@router.get("/active-shipments", status_code=200)
async def active_shipments(
    session: AsyncSession = Depends(get_db),
) -> list[ActiveShipmentItem]:
    return await load_active_shipments(session)
