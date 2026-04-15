from __future__ import annotations

from pydantic import BaseModel, Field


class PlanRouteRequest(BaseModel):
    origin_id: str = Field(min_length=3, max_length=12)
    dest_id: str = Field(min_length=3, max_length=12)
    cargo_type: str = Field(min_length=2, max_length=64)


class CrisisRerouteOption(BaseModel):
    option_rank: int
    route_id: str
    transit_mode: str
    estimated_hours: float
    risk_score: float
    path_nodes: list[str] = Field(default_factory=list)
    waypoints: list[list[float]] = Field(default_factory=list)
    strategist_note: str | None = None
    compliance_status: str | None = None
    compliance_note: str | None = None
    compliance_summary: str | None = None


class CrisisTicketResponse(BaseModel):
    ticket_id: int
    reading_id: str
    shipment_id: str
    status: str
    recommended_route_id: str | None = None
    risk_score: float | None = None
    thought_log: list[str] = Field(default_factory=list)
    evaluated_routes: list[CrisisRerouteOption] = Field(default_factory=list)


class ApproveTicketRequest(BaseModel):
    note: str | None = None


class ApproveTicketResponse(BaseModel):
    ticket_id: int
    status: str
    approved_by: str
