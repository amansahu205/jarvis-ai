from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RiskBreakdown(BaseModel):
    thermal: float = Field(ge=0.0, le=100.0)
    geopolitical: float = Field(ge=0.0, le=100.0)
    operational: float = Field(ge=0.0, le=100.0)


class CandidateRoute(BaseModel):
    route_id: str
    transit_mode: Literal["air", "maritime", "multimodal"]
    leg_count: int = Field(ge=1)
    estimated_hours: float = Field(ge=0.0)
    origin_id: str
    destination_id: str
    path_nodes: list[str] = Field(default_factory=list)
    waypoints: list[list[float]] = Field(default_factory=list)  # [lat, lng]
    risk_score: float | None = None
    risk_breakdown: RiskBreakdown | None = None
    compliance_summary: str = "Pending compliance retrieval"


class Recommendation(BaseModel):
    recommended_route_id: str
    risk_score: float = Field(ge=0.0, le=100.0)
    compliance_summary: str


class StrategistOutput(BaseModel):
    recommended_route_id: str
    risk_score: float = Field(ge=0.0, le=100.0)
    compliance_summary: str
    thought_log: list[str] = Field(default_factory=list)
    evaluated_routes: list[CandidateRoute] = Field(default_factory=list)


class StrategistAgentState(BaseModel):
    objective: Literal["plan_new_route", "handle_crisis_reroute"]
    origin_id: str
    dest_id: str
    cargo_type: str
    shipment_id: str | None = None
    crisis_type: str | None = None
    current_coords: list[float] | None = None  # [lat, lng]
    started_at: datetime = Field(default_factory=datetime.utcnow)
    thought_log: list[str] = Field(default_factory=list)
    candidate_routes: list[CandidateRoute] = Field(default_factory=list)
    recommendation: Recommendation | None = None


class CrisisContext(BaseModel):
    shipment_id: str
    current_coords: list[float]  # [lat, lng]
    crisis_type: str
