from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_current_user
from app.schemas.base import SuccessResponse
from app.schemas.regumap import (
    AnalyzeRouteRequest,
    AnalyzeRouteResponse,
    ComplianceCheckRequest,
    ComplianceCheckResponse,
    JurisdictionCompliance,
    JurisdictionResult,
    SpatialCheckRequest,
    SpatialCheckResponse,
)
from app.lib.spatial import generate_route, get_jurisdictions_for_route
from app.lib.compliance_rules import RULES

router = APIRouter()


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
    _: dict = Depends(get_current_user),
) -> SuccessResponse[AnalyzeRouteResponse]:
    try:
        route = generate_route(request.origin, request.destination, request.transit_mode)
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
