from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.schemas.shipments import ActiveShipmentItem, ParsedShipment, ShipmentRecord, ShipmentSummaryItem


EARTH_RADIUS_KM = 6371.0


async def ensure_user(session: AsyncSession, user_id: int) -> User:
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError(f'User {user_id} not found')
    return user


async def resolve_location_identity(session: AsyncSession, locode: str) -> dict[str, Any]:
    result = await session.execute(
        text(
            """
            SELECT code, label, latitude, longitude, source_table
            FROM (
                SELECT a.iata_code AS code,
                       COALESCE(NULLIF(a.airport, ''), NULLIF(a.city, ''), a.iata_code) AS label,
                       a.latitude::double precision AS latitude,
                       a.longitude::double precision AS longitude,
                       'airports' AS source_table
                FROM public.airports a
                WHERE upper(a.iata_code) = upper(:locode)
                UNION ALL
                SELECT s.un_code AS code,
                       COALESCE(NULLIF(s.port_name, ''), NULLIF(s.area_global, ''), s.un_code) AS label,
                       s.latitude::double precision AS latitude,
                       s.longitude::double precision AS longitude,
                       'seaports' AS source_table
                FROM public.seaports s
                WHERE upper(s.un_code) = upper(:locode)
            ) t
            LIMIT 1
            """
        ),
        {'locode': locode},
    )
    row = result.mappings().first()
    if not row:
        return {
            'code': locode.upper(),
            'label': locode.upper(),
            'latitude': None,
            'longitude': None,
            'source_table': None,
        }
    return dict(row)


def infer_transit_mode(origin_locode: str, destination_locode: str, origin_source: str | None, destination_source: str | None) -> str:
    if origin_source == 'airports' and destination_source == 'airports':
        return 'air'
    if origin_source == 'seaports' and destination_source == 'seaports':
        return 'maritime'
    if len(origin_locode) == 3 and len(destination_locode) == 3:
        return 'air'
    if len(origin_locode) >= 5 and len(destination_locode) >= 5:
        return 'maritime'
    return 'multimodal'


def haversine_km(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> float:
    origin_lat_rad = math.radians(origin_lat)
    dest_lat_rad = math.radians(dest_lat)
    delta_lat = math.radians(dest_lat - origin_lat)
    delta_lng = math.radians(dest_lng - origin_lng)

    a = math.sin(delta_lat / 2) ** 2 + math.cos(origin_lat_rad) * math.cos(dest_lat_rad) * math.sin(delta_lng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_hours(origin_coords: tuple[float, float] | None, destination_coords: tuple[float, float] | None, transit_mode: str) -> float:
    if not origin_coords or not destination_coords:
        return 0.0

    distance_km = haversine_km(origin_coords[0], origin_coords[1], destination_coords[0], destination_coords[1])
    if transit_mode == 'air':
        return max(1.0, distance_km / 750.0)
    if transit_mode == 'maritime':
        return max(6.0, distance_km / 34.0)
    return max(2.0, distance_km / 120.0)


async def build_waypoints(session: AsyncSession, origin_locode: str, destination_locode: str) -> tuple[list[list[float]], dict[str, Any], dict[str, Any], str, float]:
    origin = await resolve_location_identity(session, origin_locode)
    destination = await resolve_location_identity(session, destination_locode)

    origin_coords = (
        (float(origin['latitude']), float(origin['longitude']))
        if origin.get('latitude') is not None and origin.get('longitude') is not None
        else None
    )
    destination_coords = (
        (float(destination['latitude']), float(destination['longitude']))
        if destination.get('latitude') is not None and destination.get('longitude') is not None
        else None
    )

    transit_mode = infer_transit_mode(origin_locode, destination_locode, origin.get('source_table'), destination.get('source_table'))
    eta_hours = estimate_hours(origin_coords, destination_coords, transit_mode)

    waypoints: list[list[float]] = []
    if origin_coords is not None:
        waypoints.append([origin_coords[0], origin_coords[1]])
    if destination_coords is not None and destination_coords != origin_coords:
        waypoints.append([destination_coords[0], destination_coords[1]])

    return waypoints, origin, destination, transit_mode, eta_hours


def _eta_string(hours: float) -> str:
    total_minutes = max(0, int(round(hours * 60)))
    hours_part, minutes_part = divmod(total_minutes, 60)
    if hours_part <= 0:
        return f'{minutes_part}m'
    return f'{hours_part}h {minutes_part:02d}m'


def _status_from_telemetry(telemetry_status: str | None) -> str:
    if not telemetry_status:
        return 'normal'
    lowered = telemetry_status.lower()
    if lowered in {'critical', 'alert'}:
        return 'critical'
    if lowered in {'warning'}:
        return 'warning'
    if lowered in {'feed_lost', 'feed-lost'}:
        return 'feed_lost'
    return 'normal'


async def create_shipment_record(
    session: AsyncSession,
    *,
    parsed: ParsedShipment,
    user_id: int,
) -> ShipmentRecord:
    waypoints, origin, destination, transit_mode, eta_hours = await build_waypoints(
        session,
        parsed.origin_locode,
        parsed.destination_locode,
    )

    route_label = f"{origin['label']} → {destination['label']}"

    payload = {
        'shipment_code': parsed.shipment_code,
        'created_by_user_id': user_id,
        'sensor_id': parsed.sensor_id,
        'medication_name': parsed.medication_name,
        'lot_number': parsed.lot_number,
        'temp_min_c': float(parsed.temp_min_c),
        'temp_max_c': float(parsed.temp_max_c),
        'safe_humidity_min': float(parsed.humidity_min_pct),
        'safe_humidity_max': float(parsed.humidity_max_pct),
        'origin_locode': parsed.origin_locode.upper(),
        'destination_locode': parsed.destination_locode.upper(),
        'transit_mode': transit_mode,
        'estimated_hours': float(eta_hours),
        'waypoints': waypoints,
        'status': 'active',
        'route_label': route_label,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }

    result = await session.execute(
        text(
            """
            INSERT INTO public.shipments (
                shipment_code,
                created_by_user_id,
                sensor_id,
                medication_name,
                lot_number,
                temp_min_c,
                temp_max_c,
                safe_humidity_min,
                safe_humidity_max,
                origin_locode,
                destination_locode,
                transit_mode,
                estimated_hours,
                waypoints,
                status,
                route_label,
                created_at,
                updated_at
            ) VALUES (
                :shipment_code,
                :created_by_user_id,
                :sensor_id,
                :medication_name,
                :lot_number,
                :temp_min_c,
                :temp_max_c,
                :safe_humidity_min,
                :safe_humidity_max,
                :origin_locode,
                :destination_locode,
                :transit_mode,
                :estimated_hours,
                cast(:waypoints as jsonb),
                :status,
                :route_label,
                :created_at,
                :updated_at
            )
            ON CONFLICT (shipment_code) DO UPDATE
            SET created_by_user_id = excluded.created_by_user_id,
                sensor_id = excluded.sensor_id,
                medication_name = excluded.medication_name,
                lot_number = excluded.lot_number,
                temp_min_c = excluded.temp_min_c,
                temp_max_c = excluded.temp_max_c,
                safe_humidity_min = excluded.safe_humidity_min,
                safe_humidity_max = excluded.safe_humidity_max,
                origin_locode = excluded.origin_locode,
                destination_locode = excluded.destination_locode,
                transit_mode = excluded.transit_mode,
                estimated_hours = excluded.estimated_hours,
                waypoints = excluded.waypoints,
                status = excluded.status,
                route_label = excluded.route_label,
                updated_at = excluded.updated_at
            RETURNING id, shipment_code, created_by_user_id, status, sensor_id, medication_name, lot_number,
                      temp_min_c, temp_max_c, safe_humidity_min, safe_humidity_max,
                      origin_locode, destination_locode, transit_mode, estimated_hours, waypoints, created_at, updated_at
            """
        ),
        {**payload, 'waypoints': __import__('json').dumps(waypoints)},
    )
    row = result.mappings().one()
    return ShipmentRecord(
        id=int(row['id']),
        shipment_code=str(row['shipment_code']),
        created_by_user_id=int(row['created_by_user_id']),
        status=str(row['status']),
        sensor_id=str(row['sensor_id']),
        medication_name=str(row['medication_name']),
        lot_number=str(row['lot_number']),
        temp_min_c=float(row['temp_min_c']),
        temp_max_c=float(row['temp_max_c']),
        humidity_min_pct=float(row['safe_humidity_min']),
        humidity_max_pct=float(row['safe_humidity_max']),
        origin_locode=str(row['origin_locode']),
        destination_locode=str(row['destination_locode']),
        transit_mode=str(row['transit_mode']),
        estimated_hours=float(row['estimated_hours'] or 0.0),
        waypoints=[list(point) for point in (row['waypoints'] or [])],
        created_at=row['created_at'],
        updated_at=row['updated_at'],
    )


async def append_initial_audit_log(
    session: AsyncSession,
    *,
    shipment_id: int,
    user_id: int,
    user_name: str,
    details: dict[str, Any],
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO public.audit_logs (
                shipment_id,
                agent_name,
                action,
                details,
                created_at
            ) VALUES (
                :shipment_id,
                :agent_name,
                'SHIPMENT_INITIALIZED',
                cast(:details as jsonb),
                now()
            )
            """
        ),
        {
            'shipment_id': shipment_id,
            'agent_name': user_name,
            'details': __import__('json').dumps({**details, 'user_id': user_id}),
        },
    )


async def load_shipment_rows(session: AsyncSession, *, limit: int = 25, active_only: bool = True) -> list[dict[str, Any]]:
    result = await session.execute(
        text(
            """
            WITH latest_telemetry AS (
                SELECT
                    t.*,
                    row_number() OVER (
                        PARTITION BY CAST(t.shipment_id AS text)
                        ORDER BY t.recorded_at DESC, t.received_at DESC
                    ) AS rn
                FROM public.telemetry_readings t
            )
            SELECT
                s.id,
                s.shipment_code,
                s.sensor_id,
                s.medication_name,
                s.lot_number,
                s.temp_min_c,
                s.temp_max_c,
                s.safe_humidity_min,
                s.safe_humidity_max,
                s.origin_locode,
                s.destination_locode,
                s.transit_mode,
                s.estimated_hours,
                s.waypoints,
                s.status,
                s.route_label,
                s.created_at,
                s.updated_at,
                lt.reading_id,
                lt.temp_c,
                lt.humidity_pct,
                lt.status AS telemetry_status,
                lt.lat,
                lt.lng,
                lt.recorded_at,
                lt.alert_type
            FROM public.shipments s
            LEFT JOIN latest_telemetry lt
                ON CAST(lt.shipment_id AS text) = s.shipment_code
               AND lt.rn = 1
            WHERE (:active_only = false OR lower(s.status) <> 'delivered')
            ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
            LIMIT :limit
            """
        ),
        {'limit': limit, 'active_only': active_only},
    )
    return [dict(row) for row in result.mappings().all()]


async def load_active_shipments(session: AsyncSession, *, limit: int = 25) -> list[ActiveShipmentItem]:
    rows = await load_shipment_rows(session, limit=limit, active_only=True)
    active: list[ActiveShipmentItem] = []
    for row in rows:
        telemetry_status = row.get('telemetry_status')
        status = _status_from_telemetry(telemetry_status if telemetry_status else row.get('status'))
        current_temp = float(row['temp_c']) if row.get('temp_c') is not None else float(row['temp_min_c'] or 0.0)
        humidity = float(row['humidity_pct']) if row.get('humidity_pct') is not None else None
        current_pos = [float(row['lat']), float(row['lng'])] if row.get('lat') is not None and row.get('lng') is not None else None
        waypoints = [list(point) for point in (row.get('waypoints') or [])]
        eta = _eta_string(float(row.get('estimated_hours') or 0.0))
        alert_type = row.get('alert_type')
        warning_note = None
        crisis_message = None
        trend = None
        if telemetry_status and str(telemetry_status).lower() == 'critical':
            crisis_message = 'Crisis Active — Pending RP Approval'
            trend = None
        elif humidity is not None and (humidity < float(row['safe_humidity_min']) or humidity > float(row['safe_humidity_max'])):
            warning_note = 'Humidity outside safe range'
        elif alert_type:
            warning_note = str(alert_type)

        recorded_at = row.get('recorded_at')
        last_reading = None
        if recorded_at:
            last_reading = f"{recorded_at:%H:%M UTC}"

        active.append(
            ActiveShipmentItem(
                id=str(row['id']),
                shipmentId=str(row['shipment_code']),
                origin=str(row['origin_locode']),
                destination=str(row['destination_locode']),
                status=status if status in {'critical', 'warning', 'normal', 'feed_lost'} else 'normal',
                currentTemp=f"{current_temp:.1f}°C",
                eta=eta,
                transitMode=str(row['transit_mode']),
                cargo=str(row['medication_name']),
                humidity=(f"{humidity:.0f}%" if humidity is not None else None),
                routeWaypoints=waypoints,
                currentPos=current_pos,
                trend=trend,
                countdownTime=eta,
                lastReading=last_reading,
                warningNote=warning_note,
                crisisMessage=crisis_message,
            )
        )
    return active


async def load_latest_summary(session: AsyncSession, *, limit: int = 5) -> list[ShipmentSummaryItem]:
    rows = await load_shipment_rows(session, limit=limit, active_only=True)
    summary: list[ShipmentSummaryItem] = []
    for row in rows:
        telemetry_status = row.get('telemetry_status')
        status = _status_from_telemetry(telemetry_status if telemetry_status else row.get('status'))
        current_temp = float(row['temp_c']) if row.get('temp_c') is not None else float(row['temp_min_c'] or 0.0)
        humidity = float(row['humidity_pct']) if row.get('humidity_pct') is not None else None
        current_pos = {'lat': float(row['lat']), 'lng': float(row['lng'])} if row.get('lat') is not None and row.get('lng') is not None else None
        route = row.get('route_label') or f"{row['origin_locode']} → {row['destination_locode']}"
        eta = _eta_string(float(row.get('estimated_hours') or 0.0))
        summary.append(
            ShipmentSummaryItem(
                shipment_id=str(row['shipment_code']),
                route=route,
                status=status if status in {'critical', 'warning', 'normal', 'feed_lost', 'active'} else 'active',
                temp=f"{current_temp:.1f}°C",
                eta=eta,
                coords=current_pos,
                humidity=(f"{humidity:.0f}%" if humidity is not None else None),
                waypoints=[list(point) for point in (row.get('waypoints') or [])],
                cargo=str(row['medication_name']),
                transit_mode=str(row['transit_mode']),
            )
        )
    return summary
