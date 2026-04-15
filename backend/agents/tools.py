from __future__ import annotations

from typing import Any

from pinecone import Pinecone
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from agents.state import CandidateRoute, RiskBreakdown


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

        if current_coords:
            origin_lat, origin_lng = current_coords[0], current_coords[1]
        else:
            origin_lat, origin_lng = 0.0, 0.0

        params = {
            "origin_air": origin_id,
            "dest_air": dest_id,
            "origin_sea": origin_id,
            "dest_sea": dest_id,
            "origin_lat": origin_lat,
            "origin_lng": origin_lng,
            "dest_lat": origin_lat,
            "dest_lng": origin_lng,
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


class RiskRankerTool:
    """Risk ranker wrapper producing weighted 0-100 risk scores."""

    def score_route(
        self,
        route: CandidateRoute,
        cargo_type: str,
        crisis_type: str | None = None,
    ) -> tuple[float, RiskBreakdown]:
        # Thermal risk: more transit time and crisis-related thermal alerts increase risk.
        base_thermal = min(100.0, route.estimated_hours * 2.6)
        if cargo_type.lower() in {"vaccine", "biologic", "insulin"}:
            base_thermal += 12.0
        if crisis_type and "temp" in crisis_type.lower():
            base_thermal += 18.0

        # Geopolitical risk: chokepoints and broad transits increase risk.
        route_tokens = " ".join(route.path_nodes).lower()
        geo = 22.0
        if "suez" in route_tokens:
            geo += 14.0
        if "panama" in route_tokens:
            geo += 11.0
        if route.transit_mode == "maritime":
            geo += 6.0

        # Operational risk: more legs and multimodal hops increase handling risk.
        ops = 12.0 + (route.leg_count - 1) * 15.0
        if route.transit_mode == "multimodal":
            ops += 8.0

        thermal = max(0.0, min(100.0, base_thermal))
        geopolitical = max(0.0, min(100.0, geo))
        operational = max(0.0, min(100.0, ops))

        # Weighted risk score (0-100)
        risk_score = (0.45 * thermal) + (0.35 * geopolitical) + (0.20 * operational)
        risk_score = float(max(0.0, min(100.0, risk_score)))

        breakdown = RiskBreakdown(
            thermal=round(thermal, 2),
            geopolitical=round(geopolitical, 2),
            operational=round(operational, 2),
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




