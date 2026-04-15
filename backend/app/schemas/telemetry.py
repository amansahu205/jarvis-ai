from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TelemetryIngestRequest(BaseModel):
    """Payload sent by generator / OnAsset sensor bridge."""

    shipment_id: str
    container_id: Optional[str] = None
    sensor_id: Optional[str] = None

    # FDA 21 CFR Part 11 — sensor timestamp is mandatory from the source
    recorded_at: datetime

    # Temperature (required)
    temp_c: float
    temp_min_threshold: float = 2.0
    temp_max_threshold: float = 8.0

    # Optional environmental sensors
    humidity_pct: Optional[float] = None
    shock_g: Optional[float] = None
    light_lux: Optional[float] = None
    tilt_degrees: Optional[float] = None

    # Geospatial (required)
    lat: float
    lng: float
    location_description: Optional[str] = None
    location_country_code: Optional[str] = None
    altitude_m: Optional[float] = None

    # Cargo traceability
    medication_name: Optional[str] = None
    batch_number: Optional[str] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[datetime] = None

    # Status override (computed server-side if omitted)
    status: Optional[str] = None

    # OnAsset health
    battery_pct: Optional[float] = None
    signal_strength: Optional[int] = None
    sensor_status: str = "active"

    # Audit
    is_simulated: bool = True
    source: str = "generator"
    notes: Optional[str] = None


class TelemetryIngestResponse(BaseModel):
    reading_id: str
    shipment_id: str
    temp_c: float
    temp_excursion: bool
    alert_flag: bool
    alert_type: Optional[str]
    excursion_duration_seconds: int
    status: str
    received_at: datetime


class TelemetryLatestResponse(BaseModel):
    reading_id: str
    shipment_id: str
    temp_c: float
    temp_excursion: bool
    alert_flag: bool
    status: str
    recorded_at: datetime
