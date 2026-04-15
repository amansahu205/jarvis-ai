from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


# ─── Route analysis ───────────────────────────────────────────────────────────

class AnalyzeRouteRequest(BaseModel):
    origin: str
    destination: str
    transit_mode: str
    cargo_type: str


class AnalyzeRouteResponse(BaseModel):
    route_id: str
    waypoints: list[list[float]]
    transit_time_hours: float
    mode: str
    origin_coords: list[float]
    destination_coords: list[float]


# ─── Spatial check ────────────────────────────────────────────────────────────

class JurisdictionResult(BaseModel):
    id: str                   # e.g. "EGYPT_SUEZ"
    name: str                 # human-readable label
    flag: str                 # emoji flag e.g. "🇮🇳" or "🌊" for ocean
    type: str                 # "ORIGIN" | "TRANSIT" | "DESTINATION" | "INTERNATIONAL WATERS"
    coordinates: list[float]  # [lat, lon] representative point
    regulatory_class: str     # key into RULES dict


class SpatialCheckRequest(BaseModel):
    origin: str
    destination: str
    transit_mode: str
    waypoints: list[list[float]]


class SpatialCheckResponse(BaseModel):
    jurisdictions: list[JurisdictionResult]


# ─── Compliance check ─────────────────────────────────────────────────────────

class JurisdictionCompliance(BaseModel):
    # Inherited from JurisdictionResult
    id: str
    name: str
    flag: str
    type: str
    coordinates: list[float]
    regulatory_class: str

    # Enriched compliance fields
    badge: str                        # PASS | FLAG | BLOCK
    regulation: str
    clause: str
    citation: str
    citation_url: str
    warning: Optional[str] = None
    rag_confidence: float             # 0.0–1.0
    rag_fallback: bool                # True if answer came from static rules, not RAG


class ComplianceCheckRequest(BaseModel):
    jurisdictions: list[JurisdictionResult]


class ComplianceCheckResponse(BaseModel):
    jurisdictions: list[JurisdictionCompliance]
    overall_status: str               # PASS | FLAG | BLOCK


# ─── Geometry fetch ──────────────────────────────────────────────────────────

class RouteGeometryRequest(BaseModel):
    origin: str
    destination: str
    transit_mode: str
    waypoints: list[list[float]] = []


class RouteGeometryResponse(BaseModel):
    source: str
    geometry: dict
