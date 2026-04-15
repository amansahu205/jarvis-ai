from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ParsedShipment(BaseModel):
    shipment_code: str = Field(min_length=3, max_length=64)
    sensor_id: str = Field(min_length=1, max_length=64)
    medication_name: str = Field(min_length=1, max_length=255)
    lot_number: str = Field(min_length=1, max_length=64)
    temp_min_c: float
    temp_max_c: float
    humidity_min_pct: float
    humidity_max_pct: float
    origin_locode: str = Field(min_length=3, max_length=16)
    destination_locode: str = Field(min_length=3, max_length=16)


class ShipmentCreateRequest(ParsedShipment):
    waypoint_origin_lat: float | None = None
    waypoint_origin_lng: float | None = None
    waypoint_destination_lat: float | None = None
    waypoint_destination_lng: float | None = None


class ShipmentRecord(BaseModel):
    id: int
    shipment_code: str
    created_by_user_id: int
    status: str
    sensor_id: str
    medication_name: str
    lot_number: str
    temp_min_c: float
    temp_max_c: float
    humidity_min_pct: float
    humidity_max_pct: float
    origin_locode: str
    destination_locode: str
    transit_mode: Literal['air', 'maritime', 'ground', 'multimodal']
    estimated_hours: float
    waypoints: list[list[float]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ShipmentSummaryItem(BaseModel):
    shipment_id: str
    route: str
    status: Literal['critical', 'warning', 'normal', 'feed_lost', 'active']
    temp: str
    eta: str
    coords: dict[str, float] | None = None
    humidity: str | None = None
    waypoints: list[list[float]] = Field(default_factory=list)
    cargo: str
    transit_mode: Literal['air', 'maritime', 'ground', 'multimodal']


class ActiveShipmentItem(BaseModel):
    id: str
    shipmentId: str
    origin: str
    destination: str
    status: Literal['critical', 'warning', 'normal', 'feed_lost']
    currentTemp: str
    eta: str
    transitMode: Literal['air', 'maritime', 'ground', 'multimodal']
    cargo: str
    humidity: str | None = None
    routeWaypoints: list[list[float]] = Field(default_factory=list)
    currentPos: list[float] | None = None
    trend: str | None = None
    countdownTime: str | None = None
    lastReading: str | None = None
    warningNote: str | None = None
    crisisMessage: str | None = None
