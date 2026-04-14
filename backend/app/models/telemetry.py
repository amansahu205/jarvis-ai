from datetime import datetime
from uuid import uuid4
from typing import Optional
from sqlmodel import SQLModel, Field


class TelemetryReading(SQLModel, table=True):
    __tablename__ = "telemetry_readings"

    id: Optional[int] = Field(default=None, primary_key=True)

    # GS1 EPCIS 2.0 Identity Pattern
    reading_id: str = Field(
        default_factory=lambda: f"TLM-{uuid4().hex[:12].upper()}",
        index=True,
        unique=True,
    )
    shipment_id: str = Field(index=True)
    container_id: Optional[str] = None
    sensor_id: Optional[str] = None

    # FDA 21 CFR Part 11 Dual Timestamps
    recorded_at: datetime                                    # sensor time (from generator/OnAsset)
    received_at: datetime = Field(default_factory=datetime.utcnow)  # system receipt time

    # WHO TRS 961 Excursion Tracking
    temp_c: float
    temp_min_threshold: float = Field(default=2.0)
    temp_max_threshold: float = Field(default=8.0)
    temp_excursion: bool = Field(default=False)
    excursion_duration_seconds: int = Field(default=0)

    # Environmental Sensors
    humidity_pct: Optional[float] = None
    shock_g: Optional[float] = None
    light_lux: Optional[float] = None
    tilt_degrees: Optional[float] = None

    # Geospatial (ReguMap Integration)
    lat: float
    lng: float
    location_description: Optional[str] = None
    location_country_code: Optional[str] = None
    altitude_m: Optional[float] = None

    # Cargo Traceability
    medication_name: Optional[str] = None
    batch_number: Optional[str] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[datetime] = None

    # Status & Alerts
    status: str = Field(default="NORMAL")        # NORMAL | WARNING | ALERT | FEED_LOST
    compliance_status: str = Field(default="compliant")
    alert_flag: bool = Field(default=False)
    alert_type: Optional[str] = None             # TEMP_HIGH | TEMP_LOW | HUMIDITY | SHOCK | DWELL | FEED_LOST

    # OnAsset Sensor Health
    battery_pct: Optional[float] = None
    signal_strength: Optional[int] = None
    sensor_status: str = Field(default="active")

    # Audit / Source
    is_simulated: bool = Field(default=True)
    source: str = Field(default="generator")
    notes: Optional[str] = None
