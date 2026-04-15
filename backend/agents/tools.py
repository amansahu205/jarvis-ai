from __future__ import annotations

import base64
import json
import logging
import re
from statistics import mean
from typing import Any

import httpx
from pinecone import Pinecone
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.schemas.shipments import ParsedShipment
from agents.state import CandidateRoute, RiskBreakdown

logger = logging.getLogger(__name__)


class RoutePathfinderTool:
    """Route pathfinder wrapper using recursive PostGIS/SQL path expansion."""

    async def find_candidate_routes(
        self,
        session: AsyncSession,
        origin_id: str,
        dest_id: str,
        cargo_type: str,
        current_coords: list[float] | None = None,
        max_candidates: int = 3,
    ) -> list[CandidateRoute]:
        """
        Build candidate routes using recursive CTEs for air and maritime networks.

        Air path expansion uses public.routes edges.
        Maritime path expansion uses public.seaports adjacency constrained by public.maritime_lanes.
        Coordinates are returned as [lat, lng] for frontend compatibility.
        """
        sql = text(
            """
            WITH RECURSIVE air_paths AS (
                SELECT
                    r.src_iata AS origin,
                    r.dst_iata AS current_node,
                    ARRAY[r.src_iata, r.dst_iata]::text[] AS path_nodes,
                    1 AS legs,
                    COALESCE(r.distance_km, 0)::double precision AS distance_km,
                    COALESCE(r.distance_km, 0)::double precision / 760.0 AS estimated_hours,
                    'air'::text AS mode
                FROM public.routes r
                WHERE upper(r.src_iata) = upper(:origin_air)

                UNION ALL

                SELECT
                    ap.origin,
                    r.dst_iata AS current_node,
                    ap.path_nodes || r.dst_iata,
                    ap.legs + 1,
                    ap.distance_km + COALESCE(r.distance_km, 0)::double precision,
                    ap.estimated_hours + (COALESCE(r.distance_km, 0)::double precision / 760.0),
                    'air'::text
                FROM air_paths ap
                JOIN public.routes r ON upper(r.src_iata) = upper(ap.current_node)
                WHERE ap.legs < 3
                  AND NOT (upper(r.dst_iata) = ANY (SELECT upper(x) FROM unnest(ap.path_nodes) AS x))
            ),
            best_air AS (
                SELECT
                    concat('AIR-', row_number() over (order by estimated_hours, legs)) AS route_id,
                    mode,
                    legs AS leg_count,
                    estimated_hours,
                    :origin_air::text AS origin_id,
                    :dest_air::text AS destination_id,
                    path_nodes
                FROM air_paths
                WHERE upper(current_node) = upper(:dest_air)
                ORDER BY estimated_hours, legs
                LIMIT :air_limit
            ),
            maritime_ports AS (
                SELECT
                    s.un_code,
                    s.geom,
                    s.latitude,
                    s.longitude
                FROM public.seaports s
                WHERE s.geom IS NOT NULL
            ),
            origin_port AS (
                SELECT un_code, geom, latitude, longitude
                FROM maritime_ports
                WHERE upper(un_code) = upper(:origin_sea)
                UNION ALL
                SELECT mp.un_code, mp.geom, mp.latitude, mp.longitude
                FROM maritime_ports mp
                ORDER BY ST_Distance(
                    mp.geom::geometry,
                    ST_SetSRID(ST_MakePoint(:origin_lng, :origin_lat), 4326)
                )
                LIMIT 1
            ),
            dest_port AS (
                SELECT un_code, geom, latitude, longitude
                FROM maritime_ports
                WHERE upper(un_code) = upper(:dest_sea)
                UNION ALL
                SELECT mp.un_code, mp.geom, mp.latitude, mp.longitude
                FROM maritime_ports mp
                ORDER BY ST_Distance(
                    mp.geom::geometry,
                    ST_SetSRID(ST_MakePoint(:dest_lng, :dest_lat), 4326)
                )
                LIMIT 1
            ),
            sea_paths AS (
                SELECT
                    op.un_code AS origin,
                    op.un_code AS current_node,
                    ARRAY[op.un_code]::text[] AS path_nodes,
                    ARRAY[json_build_array(op.latitude, op.longitude)]::json[] AS waypoints,
                    0 AS legs,
                    0::double precision AS distance_km,
                    0::double precision AS estimated_hours,
                    'maritime'::text AS mode
                FROM origin_port op

                UNION ALL

                SELECT
                    sp.origin,
                    next_port.un_code AS current_node,
                    sp.path_nodes || next_port.un_code,
                    sp.waypoints || json_build_array(next_port.latitude, next_port.longitude),
                    sp.legs + 1,
                    sp.distance_km + (
                        ST_Distance(current_port.geom::geography, next_port.geom::geography) / 1000.0
                    ),
                    sp.estimated_hours + (
                        (ST_Distance(current_port.geom::geography, next_port.geom::geography) / 1000.0) / 37.04
                    ),
                    'maritime'::text
                FROM sea_paths sp
                JOIN maritime_ports current_port ON current_port.un_code = sp.current_node
                JOIN maritime_ports next_port ON next_port.un_code <> ALL(sp.path_nodes)
                WHERE sp.legs < 3
                  AND ST_DWithin(current_port.geom::geography, next_port.geom::geography, 2500000)
                  AND EXISTS (
                      SELECT 1
                      FROM public.maritime_lanes ml
                      WHERE ml.geom IS NOT NULL
                        AND ST_DWithin(
                            ml.geom::geometry,
                            ST_MakeLine(current_port.geom::geometry, next_port.geom::geometry),
                            1.5
                        )
                  )
            ),
            best_sea AS (
                SELECT
                    concat('SEA-', row_number() over (order by estimated_hours, legs)) AS route_id,
                    mode,
                    GREATEST(legs, 1) AS leg_count,
                    estimated_hours,
                    :origin_sea::text AS origin_id,
                    :dest_sea::text AS destination_id,
                    path_nodes,
                    waypoints
                FROM sea_paths
                WHERE upper(current_node) IN (SELECT upper(un_code) FROM dest_port)
                ORDER BY estimated_hours, legs
                LIMIT :sea_limit
            )
            SELECT
                route_id,
                mode,
                leg_count,
                estimated_hours,
                origin_id,
                destination_id,
                path_nodes,
                NULL::json[] AS waypoints
            FROM best_air

            UNION ALL

            SELECT
                route_id,
                mode,
                leg_count,
                estimated_hours,
                origin_id,
                destination_id,
                path_nodes,
                waypoints
            FROM best_sea
            LIMIT :max_candidates
            """
        )

        origin_fallback = current_coords if current_coords and len(current_coords) == 2 else None
        origin_lat, origin_lng = await self._resolve_anchor_coords(
            session=session,
            location_id=origin_id,
            fallback=origin_fallback,
        )
        dest_lat, dest_lng = await self._resolve_anchor_coords(
            session=session,
            location_id=dest_id,
            fallback=None,
        )

        origin_air_id, origin_sea_id = await self._resolve_mode_specific_ids(session, origin_id)
        dest_air_id, dest_sea_id = await self._resolve_mode_specific_ids(session, dest_id)

        params = {
            "origin_air": origin_air_id,
            "dest_air": dest_air_id,
            "origin_sea": origin_sea_id,
            "dest_sea": dest_sea_id,
            "origin_lat": origin_lat,
            "origin_lng": origin_lng,
            "dest_lat": dest_lat,
            "dest_lng": dest_lng,
            "air_limit": max_candidates,
            "sea_limit": max_candidates,
            "max_candidates": max_candidates,
        }

        result = await session.execute(sql, params)
        rows = result.fetchall()

        candidates: list[CandidateRoute] = []
        for row in rows:
            row_waypoints = []
            if row[7]:
                row_waypoints = [list(p) for p in row[7]]

            candidates.append(
                CandidateRoute(
                    route_id=row[0],
                    transit_mode=("multimodal" if row[1] not in ("air", "maritime") else row[1]),
                    leg_count=int(row[2] or 1),
                    estimated_hours=float(row[3] or 0.0),
                    origin_id=row[4],
                    destination_id=row[5],
                    path_nodes=list(row[6] or []),
                    waypoints=row_waypoints,
                )
            )

        if not candidates:
            fallback = CandidateRoute(
                route_id=f"FALLBACK-{origin_id}-{dest_id}",
                transit_mode="air",
                leg_count=1,
                estimated_hours=12.0,
                origin_id=origin_id,
                destination_id=dest_id,
                path_nodes=[origin_id, dest_id],
                waypoints=[],
            )
            return [fallback]

        return candidates[:max_candidates]
    async def _resolve_anchor_coords(
        self,
        session: AsyncSession,
        location_id: str,
        fallback: list[float] | None,
    ) -> tuple[float, float]:
        sql = text(
            """
            SELECT lat, lng FROM (
                SELECT a.latitude::double precision AS lat, a.longitude::double precision AS lng
                FROM public.airports a
                WHERE upper(a.iata_code) = upper(:location_id)
                UNION ALL
                SELECT s.latitude::double precision AS lat, s.longitude::double precision AS lng
                FROM public.seaports s
                WHERE upper(s.un_code) = upper(:location_id)
                LIMIT 1
            ) t
            """
        )
        result = await session.execute(sql, {"location_id": location_id})
        row = result.first()
        if row and row[0] is not None and row[1] is not None:
            return float(row[0]), float(row[1])

        if fallback and len(fallback) == 2:
            return float(fallback[0]), float(fallback[1])

        return 0.0, 0.0

    async def _resolve_mode_specific_ids(
        self,
        session: AsyncSession,
        location_id: str,
    ) -> tuple[str, str]:
        normalized = location_id.upper()

        airport_result = await session.execute(
            text(
                """
                SELECT iata_code
                FROM public.airports
                WHERE upper(iata_code) = upper(:location_id)
                LIMIT 1
                """
            ),
            {"location_id": normalized},
        )
        airport_row = airport_result.first()
        airport_id = str(airport_row[0]).upper() if airport_row and airport_row[0] else None

        seaport_result = await session.execute(
            text(
                """
                SELECT un_code
                FROM public.seaports
                WHERE upper(un_code) = upper(:location_id)
                LIMIT 1
                """
            ),
            {"location_id": normalized},
        )
        seaport_row = seaport_result.first()
        seaport_id = str(seaport_row[0]).upper() if seaport_row and seaport_row[0] else None

        # planned_routes ids may be IATA (air) or UN/LOCODE (sea); map explicitly by mode.
        if airport_id is None and len(normalized) == 3:
            airport_id = normalized
        if seaport_id is None and len(normalized) >= 5:
            seaport_id = normalized

        return (airport_id or normalized, seaport_id or normalized)


class POParserTool:
    """Multimodal purchase order parser using Gemini."""

    def __init__(self) -> None:
        self._api_key = settings.GEMINI_API_KEY
        self._model = 'gemini-3.1-pro-preview'

    def _build_inline_data(self, *, filename: str, content_type: str | None, file_bytes: bytes) -> dict[str, Any]:
        detected_type = content_type or ''
        lowered = filename.lower()
        if not detected_type:
            if lowered.endswith('.pdf'):
                detected_type = 'application/pdf'
            elif lowered.endswith(('.png', '.jpg', '.jpeg', '.webp')):
                detected_type = 'image/png' if lowered.endswith('.png') else 'image/jpeg'
            else:
                detected_type = 'application/pdf'

        encoded = base64.b64encode(file_bytes).decode('utf-8')
        return {
            'inline_data': {
                'mime_type': detected_type,
                'data': encoded,
            }
        }

    def _extract_json(self, text_output: str) -> dict[str, Any]:
        cleaned = text_output.strip()
        if cleaned.startswith('`'):
            cleaned = re.sub(r'^`(?:json)?\s*', '', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'`\s*$', '', cleaned)
        match = re.search(r'\{.*\}', cleaned, flags=re.DOTALL)
        json_blob = match.group(0) if match else cleaned
        return json.loads(json_blob)

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get('candidates') or []
        text_parts: list[str] = []
        for candidate in candidates:
            content = candidate.get('content') or {}
            for part in content.get('parts') or []:
                part_text = part.get('text')
                if part_text:
                    text_parts.append(str(part_text))
        return ''.join(text_parts)

    async def parse_upload(self, *, filename: str, content_type: str | None, file_bytes: bytes) -> ParsedShipment:
        if not self._api_key:
            raise RuntimeError('GEMINI_API_KEY is required for PO parsing')

        prompt = (
            'Extract the purchase order into strict JSON with these fields only: '
            'shipment_code, sensor_id, medication_name, lot_number, temp_min_c, temp_max_c, '
            'humidity_min_pct, humidity_max_pct, origin_locode, destination_locode. '
            'Normalize numeric values as numbers, preserve codes exactly, and do not add commentary. '
            'If a field is missing, infer it from the document if possible; otherwise use an empty string for text fields '
            'and 0 for numeric fields.'
        )

        inline_data = self._build_inline_data(filename=filename, content_type=content_type, file_bytes=file_bytes)
        payload = {
            'contents': [
                {
                    'parts': [
                        {'text': prompt},
                        inline_data,
                    ]
                }
            ],
            'generationConfig': {
                'temperature': 0,
                'maxOutputTokens': 800,
                'responseMimeType': 'application/json',
            },
            'systemInstruction': {
                'parts': [
                    {'text': 'You are a multimodal purchase order parser for pharmaceutical logistics.'}
                ]
            },
        }

        url = f'https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent'
        timeout = httpx.Timeout(30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, params={'key': self._api_key}, json=payload)
            response.raise_for_status()
            response_payload = response.json()

        text_output = self._extract_text(response_payload)
        if not text_output:
            raise RuntimeError('Gemini returned no text for PO parsing')

        parsed = self._extract_json(text_output)
        return ParsedShipment.model_validate(parsed)


class RiskRankerTool:
    """Risk ranker wrapper producing weighted 0-100 risk scores."""

    async def _get_hub_weather(self, lat: float, lng: float) -> float | None:
        if not settings.OPENWEATHER_API_KEY:
            return None

        url = 'https://api.openweathermap.org/data/2.5/weather'
        params = {
            'lat': lat,
            'lon': lng,
            'appid': settings.OPENWEATHER_API_KEY,
            'units': 'metric',
        }

        try:
            timeout = httpx.Timeout(5.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                payload = response.json()
                temp = payload.get('main', {}).get('temp')
                return float(temp) if temp is not None else None
        except Exception as exc:  # noqa: BLE001
            logger.warning('OpenWeather lookup failed for (%s, %s): %s', lat, lng, exc)
            return None

    async def _get_cargo_constraints(self, session: AsyncSession, cargo_type: str) -> tuple[float, float]:
        defaults: dict[str, tuple[float, float]] = {
            'vaccine': (2.0, 8.0),
            'biologic': (2.0, 8.0),
            'insulin': (2.0, 8.0),
            'refrigerated': (2.0, 8.0),
            'chilled': (2.0, 8.0),
            'ambient': (15.0, 25.0),
        }
        fallback = defaults.get(cargo_type.lower(), (2.0, 8.0))

        try:
            result = await session.execute(
                text(
                    """
                    SELECT min_temp_c, max_temp_c
                    FROM public.cargo_stability_profiles
                    WHERE lower(cargo_type) = lower(:cargo_type)
                    LIMIT 1
                    """
                ),
                {'cargo_type': cargo_type},
            )
            row = result.first()
            if row and row[0] is not None and row[1] is not None:
                return float(row[0]), float(row[1])
        except Exception as exc:  # noqa: BLE001
            logger.warning('cargo_stability_profiles lookup failed for cargo=%s: %s', cargo_type, exc)

        return fallback

    async def _get_shipments_humidity_bounds(self, session: AsyncSession, shipment_id: str | None) -> tuple[float, float]:
        if not shipment_id:
            return 35.0, 60.0

        try:
            result = await session.execute(
                text(
                    """
                    SELECT safe_humidity_min, safe_humidity_max
                    FROM public.shipments
                    WHERE shipment_code = :shipment_id
                    LIMIT 1
                    """
                ),
                {'shipment_id': shipment_id},
            )
            row = result.first()
            if row and row[0] is not None and row[1] is not None:
                return float(row[0]), float(row[1])
        except Exception as exc:  # noqa: BLE001
            logger.warning('shipments humidity bounds lookup failed for shipment=%s: %s', shipment_id, exc)

        return 35.0, 60.0

    async def _get_latest_humidity_pct(self, session: AsyncSession, shipment_id: str | None) -> float | None:
        if not shipment_id:
            return None

        try:
            result = await session.execute(
                text(
                    """
                    SELECT humidity_pct
                    FROM public.telemetry_readings
                    WHERE shipment_id = :shipment_id
                      AND humidity_pct IS NOT NULL
                    ORDER BY recorded_at DESC, received_at DESC
                    LIMIT 1
                    """
                ),
                {'shipment_id': shipment_id},
            )
            row = result.first()
            if row and row[0] is not None:
                return float(row[0])
        except Exception as exc:  # noqa: BLE001
            logger.warning('telemetry humidity lookup failed for shipment=%s: %s', shipment_id, exc)

        return None

    async def get_cumulative_excursion_duration(self, session: AsyncSession, shipment_id: str | None) -> int:
        if not shipment_id:
            return 0

        try:
            result = await session.execute(
                text(
                    """
                    SELECT COALESCE(SUM(excursion_duration_seconds), 0)
                    FROM public.telemetry_readings
                    WHERE shipment_id = :shipment_id
                    """
                ),
                {'shipment_id': shipment_id},
            )
            value = result.scalar_one_or_none()
            return int(value or 0)
        except Exception as exc:  # noqa: BLE001
            logger.warning('excursion duration aggregation failed for shipment=%s: %s', shipment_id, exc)
            return 0

    async def _resolve_location_country_code(self, session: AsyncSession, location_id: str) -> str | None:
        result = await session.execute(
            text(
                """
                SELECT country_code FROM (
                    SELECT a.country AS country_code
                    FROM public.airports a
                    WHERE upper(a.iata_code) = upper(:location_id)
                    UNION ALL
                    SELECT s.country AS country_code
                    FROM public.seaports s
                    WHERE upper(s.un_code) = upper(:location_id)
                    LIMIT 1
                ) t
                """
            ),
            {'location_id': location_id},
        )
        row = result.first()
        if row and row[0]:
            return str(row[0]).upper()
        if len(location_id) == 3:
            return location_id.upper()
        return None

    async def _get_country_risk_profile(
        self,
        session: AsyncSession,
        country_codes: list[str],
    ) -> dict[str, tuple[float, float]]:
        unique_codes = []
        seen = set()
        for code in country_codes:
            if not code:
                continue
            normalized = code.upper()
            if normalized in seen:
                continue
            seen.add(normalized)
            unique_codes.append(normalized)

        if not unique_codes:
            return {}

        try:
            result = await session.execute(
                text(
                    """
                    SELECT country_code, political_stability, customs_complexity
                    FROM public.country_risk_profiles
                    WHERE country_code = ANY(:country_codes)
                    """
                ),
                {'country_codes': unique_codes},
            )
            rows = result.fetchall()
            return {str(row[0]).upper(): (float(row[1]), float(row[2])) for row in rows}
        except Exception as exc:  # noqa: BLE001
            logger.warning('country_risk_profiles lookup failed for codes=%s: %s', unique_codes, exc)
            return {}

    async def _resolve_location_coords(
        self,
        session: AsyncSession,
        location_id: str,
    ) -> list[float] | None:
        result = await session.execute(
            text(
                """
                SELECT latitude, longitude FROM (
                    SELECT a.latitude, a.longitude
                    FROM public.airports a
                    WHERE upper(a.iata_code) = upper(:location_id)
                    UNION ALL
                    SELECT s.latitude, s.longitude
                    FROM public.seaports s
                    WHERE upper(s.un_code) = upper(:location_id)
                    LIMIT 1
                ) t
                """
            ),
            {'location_id': location_id},
        )
        row = result.first()
        if row and row[0] is not None and row[1] is not None:
            return [float(row[0]), float(row[1])]
        return None

    async def score_route(
        self,
        session: AsyncSession,
        route: CandidateRoute,
        cargo_type: str,
        hub_coords: list[float] | None = None,
        shipment_id: str | None = None,
    ) -> tuple[float, RiskBreakdown]:
        cargo_min_temp_c, cargo_max_temp_c = await self._get_cargo_constraints(session, cargo_type)
        humidity_min_pct, humidity_max_pct = await self._get_shipments_humidity_bounds(session, shipment_id)
        humidity_pct = await self._get_latest_humidity_pct(session, shipment_id)

        weather_coords = hub_coords
        if weather_coords is None and route.waypoints:
            weather_coords = route.waypoints[0]
        if weather_coords is None:
            weather_coords = await self._resolve_location_coords(session, route.origin_id)

        hub_temp_c = None
        if weather_coords is not None and len(weather_coords) == 2:
            hub_temp_c = await self._get_hub_weather(float(weather_coords[0]), float(weather_coords[1]))

        if hub_temp_c is None:
            thermal_risk = 45.0
        else:
            delta = hub_temp_c - cargo_max_temp_c
            if delta > 0:
                thermal_risk = 60.0 + (delta * 4.0)
            else:
                thermal_risk = 25.0 + (abs(delta) * 2.5)
            thermal_risk = max(0.0, min(100.0, thermal_risk))

        humidity_penalty = 0.0
        if humidity_pct is not None and (humidity_pct < humidity_min_pct or humidity_pct > humidity_max_pct):
            deviation = min(abs(humidity_pct - humidity_min_pct), abs(humidity_pct - humidity_max_pct))
            humidity_penalty = min(30.0, 10.0 + (deviation * 1.5))

        cumulative_excursion_seconds = await self.get_cumulative_excursion_duration(session, shipment_id)
        stability_penalty = 0.0
        if cumulative_excursion_seconds > 7200:
            stability_penalty = min(40.0, 12.0 + ((cumulative_excursion_seconds - 7200) / 600.0))

        country_codes: list[str] = []
        for node in route.path_nodes:
            country_code = await self._resolve_location_country_code(session, node)
            if country_code:
                country_codes.append(country_code)

        risk_map = await self._get_country_risk_profile(session, country_codes)
        political_scores = [value[0] for value in risk_map.values()]
        customs_scores = [value[1] for value in risk_map.values()]
        geopolitical_risk = mean(political_scores) if political_scores else 50.0
        customs_risk = mean(customs_scores) if customs_scores else 50.0

        operational_risk = max(0.0, min(100.0, 25.0 * max(0, route.leg_count - 1)))

        route.compliance_summary = (
            f"Cargo stability {cargo_min_temp_c:.1f}-{cargo_max_temp_c:.1f}C; "
            f"humidity={humidity_pct if humidity_pct is not None else 'unknown'} "
            f"safe_range={humidity_min_pct:.1f}-{humidity_max_pct:.1f}%; "
            f"excursion_seconds={cumulative_excursion_seconds}; "
            f"weather_temp={hub_temp_c if hub_temp_c is not None else 'unknown'}; "
            f"country_political_avg={geopolitical_risk:.1f}; "
            f"country_customs_avg={customs_risk:.1f}"
        )

        risk_score = (0.40 * thermal_risk) + (0.20 * geopolitical_risk) + (0.15 * operational_risk) + humidity_penalty + stability_penalty
        risk_score = float(max(0.0, min(100.0, risk_score)))

        breakdown = RiskBreakdown(
            thermal=round(thermal_risk, 2),
            humidity=round(humidity_penalty, 2),
            geopolitical=round(geopolitical_risk, 2),
            operational=round(operational_risk, 2),
        )
        return round(risk_score, 2), breakdown

class ComplianceRAGTool:
    """Compliance RAG wrapper over Pinecone index for clause retrieval."""

    def __init__(self) -> None:
        self._client = Pinecone(api_key=settings.PINECONE_API_KEY) if settings.PINECONE_API_KEY else None

    def summarize_for_route(
        self,
        route: CandidateRoute,
        cargo_type: str,
    ) -> str:
        if not self._client:
            return "Compliance RAG unavailable: Pinecone API key missing."

        query_text = (
            f"Pharmaceutical cold-chain compliance clauses for cargo {cargo_type}. "
            f"Route mode={route.transit_mode}, nodes={route.path_nodes}. "
            "Prioritize GDP, WHO TRS 961, customs/transit and emergency reroute constraints."
        )

        try:
            index = self._client.Index(settings.PINECONE_INDEX_NAME)

            # pinecone v8 may expose text search APIs differently by index type.
            # This fallback-friendly flow tries common query surfaces and degrades gracefully.
            try:
                response: Any = index.search(
                    namespace="compliance",
                    query={"top_k": 3, "inputs": {"text": query_text}},
                )
                records = response.get("result", {}).get("hits", []) if isinstance(response, dict) else []
            except Exception:
                records = []

            if not records:
                try:
                    embed = self._client.inference.embed(
                        model="multilingual-e5-large",
                        inputs=[query_text],
                        parameters={"input_type": "query"},
                    )
                    vector = embed.data[0].values
                    response = index.query(vector=vector, top_k=3, include_metadata=True)
                    records = response.matches if hasattr(response, "matches") else []
                except Exception:
                    records = []

            if not records:
                return "No indexed compliance clauses found; fallback policy required."

            summaries: list[str] = []
            for item in records[:3]:
                if isinstance(item, dict):
                    metadata = item.get("metadata", {})
                else:
                    metadata = getattr(item, "metadata", {}) or {}
                clause = metadata.get("clause") or metadata.get("text") or metadata.get("summary")
                if clause:
                    summaries.append(str(clause))

            if not summaries:
                return "Compliance matches found but metadata contained no clause text."

            return " | ".join(summaries)
        except Exception as exc:
            return f"Compliance RAG lookup failed: {exc}"









