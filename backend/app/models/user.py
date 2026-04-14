from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum

class UserRole(str, Enum):
    LOGISTICS_PLANNER = 'logistics_planner'
    RESPONSIBLE_PERSON = 'responsible_person'
    ADMIN = 'admin'
    AGENT = 'agent'

class User(SQLModel, table=True):
    __tablename__ = 'users'
    
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    hashed_password: str
    role: UserRole = Field(default=UserRole.LOGISTICS_PLANNER)
    is_active: bool = Field(default=True)
    phone_number: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TelemetryReading(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # GS1 EPCIS 2.0 Identity Pattern
    reading_id: str = Field(
        default_factory=lambda: f"TLM-{uuid4().hex[:12].upper()}",
        index=True,
        unique=True
    )
    shipment_id: str = Field(index=True)
    container_id: Optional[str] = None
    sensor_id: Optional[str] = None

    # FDA 21 CFR Part 11 Dual Timestamps
    recorded_at: datetime  # Sensor Time
    received_at: datetime = Field(default_factory=datetime.utcnow) # System Time

    # WHO TRS 961 Excursion Tracking
    temp_c: float
    temp_min_threshold: float = 2.0
    temp_max_threshold: float = 8.0
    temp_excursion: bool = False
    excursion_duration_seconds: int = 0

    # Geospatial (ReguMap Integration)
    lat: float
    lng: float
    location_description: Optional[str] = None
    location_country_code: Optional[str] = None

    # Status & Alerts
    status: str = "NORMAL" # NORMAL | WARNING | ALERT | FEED_LOST
    compliance_status: str = "compliant"
    alert_flag: bool = False
    
    # OnAsset Health
    battery_pct: Optional[float] = None
    sensor_status: str = "active"
    
    # Audit Traceability
    is_simulated: bool = True
    source: str = "generator"