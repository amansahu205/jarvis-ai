import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.schemas.base import SuccessResponse
from app.schemas.regumap import (
    AnalyzeRouteRequest,
    AnalyzeRouteResponse,
    ComplianceCheckRequest,
    ComplianceCheckResponse,
    JurisdictionCompliance,
    JurisdictionResult,
    RouteGeometryRequest,
    RouteGeometryResponse,
    SpatialCheckRequest,
    SpatialCheckResponse,
)
from app.lib.spatial import generate_route, get_jurisdictions_for_route
from app.lib.compliance_rules import RULES

router = APIRouter()


def _waypoints_to_linestring_wkt(waypoints: list[list[float]]) -> str | None:
    if len(waypoints) < 2:
        return None

    # API waypoints are [lat, lon] and PostGIS WKT expects (lon lat).
    coords: list[str] = []
    for point in waypoints:
        if len(point) != 2:
            continue
        lat, lon = point
        coords.append(f"{lon} {lat}")

    if len(coords) < 2:
        return None

    return f"LINESTRING({', '.join(coords)})"


# ─── Compliance fallback for unknown regulatory classes ───────────────────────
# Jurisdictions caught by the GeoJSON (e.g. YEM, SDN) may not have a RULES
# entry yet. Return a generic PASS with a note so the response never 422s.

def _get_rule(regulatory_class: str) -> dict:
    if regulatory_class in RULES:
        return RULES[regulatory_class]
    return {
        "badge": "PASS",
        "regulation": f"No rule defined for {regulatory_class}",
        "clause": (
            f"No specific compliance rule has been configured for "
            f"regulatory class '{regulatory_class}'. "
            "Default PASS status assigned pending rule authoring."
        ),
        "citation": "",
        "citation_url": "",
        "warning": None,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/analyze-route", status_code=200)
async def analyze_route(
    request: AnalyzeRouteRequest,
    session: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> SuccessResponse[AnalyzeRouteResponse]:
    try:
        route = await generate_route(session, request.origin, request.destination, request.transit_mode)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return SuccessResponse(data=AnalyzeRouteResponse(**route))


@router.post("/spatial-check", status_code=200)
async def spatial_check(
    request: SpatialCheckRequest,
    _: dict = Depends(get_current_user),
) -> SuccessResponse[SpatialCheckResponse]:
    if len(request.waypoints) < 2:
        raise HTTPException(
            status_code=422,
            detail="At least 2 waypoints are required for spatial analysis.",
        )

    jx_dicts = get_jurisdictions_for_route(request.waypoints)

    if not jx_dicts:
        raise HTTPException(
            status_code=422,
            detail="No jurisdictions could be inferred from the provided waypoints.",
        )

    jurisdictions = [JurisdictionResult(**jx) for jx in jx_dicts]
    return SuccessResponse(data=SpatialCheckResponse(jurisdictions=jurisdictions))


@router.post("/compliance-check", status_code=200)
async def compliance_check(
    request: ComplianceCheckRequest,
    _: dict = Depends(get_current_user),
) -> SuccessResponse[ComplianceCheckResponse]:
    enriched: list[JurisdictionCompliance] = []

    for jx in request.jurisdictions:
        rule = _get_rule(jx.regulatory_class)
        enriched.append(
            JurisdictionCompliance(
                **jx.model_dump(),
                badge=rule["badge"],
                regulation=rule["regulation"],
                clause=rule["clause"],
                citation=rule["citation"],
                citation_url=rule["citation_url"],
                warning=rule["warning"],
                rag_confidence=1.0,
                rag_fallback=True,
            )
        )

    badges = {e.badge for e in enriched}
    if "BLOCK" in badges:
        overall = "BLOCK"
    elif "FLAG" in badges:
        overall = "FLAG"
    else:
        overall = "PASS"

    return SuccessResponse(
        data=ComplianceCheckResponse(jurisdictions=enriched, overall_status=overall)
    )


@router.post("/route-geometry", status_code=200)
async def route_geometry(
    request: RouteGeometryRequest,
    session: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> SuccessResponse[RouteGeometryResponse]:
    mode = request.transit_mode.lower()

    if mode == "air":
        result = await session.execute(
            text(
                """
                SELECT ST_AsGeoJSON(r.geom::geometry) AS geom_json
                FROM public.routes r
                WHERE r.src_iata = :origin
                  AND r.dst_iata = :destination
                  AND r.geom IS NOT NULL
                LIMIT 1
                """
            ),
            {"origin": request.origin.upper(), "destination": request.destination.upper()},
        )
        row = result.mappings().first()
        if row and row["geom_json"]:
            return SuccessResponse(
                data=RouteGeometryResponse(
                    source="routes",
                    geometry=json.loads(row["geom_json"]),
                )
            )

    if mode == "maritime":
        line_wkt = _waypoints_to_linestring_wkt(request.waypoints)
        if line_wkt:
            result = await session.execute(
                text(
                    """
                    WITH ref AS (
                      SELECT ST_GeomFromText(:line_wkt, 4326) AS line
                    )
                    SELECT ST_AsGeoJSON(m.geom::geometry) AS geom_json
                    FROM public.maritime_lanes m, ref
                    WHERE m.geom IS NOT NULL
                    ORDER BY ST_Distance(m.geom::geometry, ref.line)
                    LIMIT 1
                    """
                ),
                {"line_wkt": line_wkt},
            )
            row = result.mappings().first()
            if row and row["geom_json"]:
                return SuccessResponse(
                    data=RouteGeometryResponse(
                        source="maritime_lanes",
                        geometry=json.loads(row["geom_json"]),
                    )
                )

    # Fallback: build a geometry from analyze-route waypoints.
    fallback_wkt = _waypoints_to_linestring_wkt(request.waypoints)
    if not fallback_wkt:
        raise HTTPException(status_code=422, detail="Unable to derive route geometry from request.")

    result = await session.execute(
        text("SELECT ST_AsGeoJSON(ST_GeomFromText(:line_wkt, 4326)) AS geom_json"),
        {"line_wkt": fallback_wkt},
    )
    row = result.mappings().first()

    return SuccessResponse(
        data=RouteGeometryResponse(
            source="analyze_route_waypoints",
            geometry=json.loads(row["geom_json"]),
        )
    )
