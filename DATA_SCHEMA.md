# PharmaGuard AI – Data Models & Schemas

**Version**: 1.0  
**Database**: PostgreSQL 16+ (Supabase)  
**ORM**: SQLModel (Pydantic + SQLAlchemy unified)  
**Migration tool**: Alembic  
**Philosophy**: One SQLModel class per table; separate Pydantic schemas for API request/response. Never expose DB models directly to API layer.

---

## 1. Entity Relationship Diagram

### Core Logistics & Crisis Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PHARMAGUARD AI ENTITIES                         │
└─────────────────────────────────────────────────────────────────────┘

users (id, email, role)
  │
  ├─ 1:N ─────── shipments (id, origin_id, dest_id, cargo_type)
  │                    │
  │                    ├─ 1:N ─── telemetry_readings (reading_id, shipment_id, temp_c, lat, lng)
  │                    │               │
  │                    │               ├─ 0:1 ── processed_alerts (reading_id)
  │                    │               │
  │                    │               └─ 0:1 ── crisis_events (reading_id, recommendation_route_id)
  │                    │                              │
  │                    │                              └─ 0:1 ── crisis_tickets (id, reading_id, status)
  │                    │                                          │
  │                    │                                          ├─ 1:N ─ reroute_options (route_id, risk_score)
  │                    │                                          │
  │                    │                                          ├─ 1:N ─ jurisdiction_checks (jurisd_code)
  │                    │                                          │
  │                    │                                          ├─ 1:N ─ regulation_citations (clause)
  │                    │                                          │
  │                    │                                          ├─ 0:1 ─ diplomat_drafts (voice_script)
  │                    │                                          │
  │                    │                                          └─ N:N ── audit_logs (action='RP_APPROVED')
  │                    │
  │                    └─ 1:N ─── rp_approvals (approver_user_id, approved_by)
  │
  └─ 1:N ── planned_routes (user_id, plan_token, origin_id, dest_id)


Master Data & Risk ProfilesAirports, Seaports, Routes, Maritime Lanes, Country Risk Profiles
```

---

## 2. SQLModel Table Definitions

### `users`

```python
# app/models/user.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, Enum as SAEnum
from datetime import datetime
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    LOGISTICS_PLANNER = "logistics_planner"
    RESPONSIBLE_PERSON = "responsible_person"
    ADMIN = "admin"
    AGENT = "agent"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(
        sa_column=Column(String(255), unique=True, nullable=False, index=True)
    )
    name: str = Field(max_length=255, nullable=False)
    hashed_password: str = Field(nullable=False)
    role: UserRole = Field(
        sa_column=Column(SAEnum(UserRole), nullable=False, server_default="logistics_planner")
    )
    phone_number: Optional[str] = Field(default=None, nullable=True)
    is_active: bool = Field(default=True, nullable=False)

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
    )
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
```

---

### `shipments`

```python
# app/models/shipment.py
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, ForeignKey, Text, Enum as SAEnum
from datetime import datetime
from enum import Enum
from typing import Optional, List


class CargoType(str, Enum):
    VACCINE = "vaccine"
    BIOLOGIC = "biologic"
    INSULIN = "insulin"
    REFRIGERATED = "refrigerated"
    CHILLED = "chilled"
    AMBIENT = "ambient"


class ShipmentStatus(str, Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    REROUTING_PROPOSED = "rerouting_proposed"
    REROUTED = "rerouted"
    DELIVERED = "delivered"
    FAILED = "failed"


class Shipment(SQLModel, table=True):
    __tablename__ = "shipments"

    id: Optional[int] = Field(default=None, primary_key=True)
    shipment_code: str = Field(
        sa_column=Column(String(64), unique=True, nullable=False, index=True)
    )
    origin_id: str = Field(
        sa_column=Column(String(12), nullable=False, index=True)
    )  # IATA or UN/LOCODE
    dest_id: str = Field(
        sa_column=Column(String(12), nullable=False, index=True)
    )  # IATA or UN/LOCODE
    cargo_type: CargoType = Field(
        sa_column=Column(SAEnum(CargoType), nullable=False, index=True)
    )

    # Temperature constraints (WHO TRS 961)
    temp_min_threshold: float = Field(default=2.0, nullable=False)
    temp_max_threshold: float = Field(default=8.0, nullable=False)

    # Custody chain
    created_by_user_id: int = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    )

    status: ShipmentStatus = Field(
        sa_column=Column(SAEnum(ShipmentStatus), nullable=False, server_default="pending"),
        index=True,
    )

    # Timestamps
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
    )
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)

    # Relationships
    telemetry_readings: List["TelemetryReading"] = Relationship(back_populates="shipment")
```

---

### `telemetry_readings`

```python
# app/models/telemetry.py
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, ForeignKey, Text, Boolean, Enum as SAEnum
from datetime import datetime
from enum import Enum
from uuid import uuid4
from typing import Optional


class AlertType(str, Enum):
    TEMP_HIGH = "TEMP_HIGH"
    TEMP_LOW = "TEMP_LOW"
    HUMIDITY = "HUMIDITY"
    SHOCK = "SHOCK"
    DWELL = "DWELL"
    FEED_LOST = "FEED_LOST"


class ReadingStatus(str, Enum):
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    ALERT = "ALERT"
    CRITICAL = "CRITICAL"
    FEED_LOST = "FEED_LOST"


class TelemetryReading(SQLModel, table=True):
    __tablename__ = "telemetry_readings"

    id: Optional[int] = Field(default=None, primary_key=True)

    # GS1 EPCIS 2.0 Identity
    reading_id: str = Field(
        unique=True,
        index=True,
        nullable=False,
    )
    shipment_id: str = Field(
        sa_column=Column(String(64), ForeignKey("shipments.shipment_code"), nullable=False, index=True)
    )
    container_id: Optional[str] = Field(default=None, nullable=True)
    sensor_id: Optional[str] = Field(default=None, nullable=True)

    # FDA 21 CFR Part 11 Dual Timestamps
    recorded_at: datetime = Field(nullable=False)  # Sensor timestamp
    received_at: datetime = Field(
        default_factory=datetime.utcnow, nullable=False
    )  # System receipt time

    # WHO TRS 961 Excursion Tracking
    temp_c: float = Field(nullable=False, index=True)
    temp_min_threshold: float = Field(default=2.0, nullable=False)
    temp_max_threshold: float = Field(default=8.0, nullable=False)
    temp_excursion: bool = Field(default=False, nullable=False)
    excursion_duration_seconds: int = Field(default=0, nullable=False)

    # Environmental Sensors
    humidity_pct: Optional[float] = Field(default=None, nullable=True)
    shock_g: Optional[float] = Field(default=None, nullable=True)
    light_lux: Optional[float] = Field(default=None, nullable=True)
    tilt_degrees: Optional[float] = Field(default=None, nullable=True)

    # Geospatial (ReguMap Integration)
    lat: float = Field(nullable=False, index=True)
    lng: float = Field(nullable=False, index=True)
    location_description: Optional[str] = Field(default=None, nullable=True)
    location_country_code: Optional[str] = Field(default=None, nullable=True)
    altitude_m: Optional[float] = Field(default=None, nullable=True)

    # Cargo Traceability
    medication_name: Optional[str] = Field(default=None, nullable=True)
    batch_number: Optional[str] = Field(default=None, nullable=True)
    lot_number: Optional[str] = Field(default=None, nullable=True)
    expiry_date: Optional[datetime] = Field(default=None, nullable=True)

    # Status & Alerts
    status: ReadingStatus = Field(
        sa_column=Column(SAEnum(ReadingStatus), nullable=False, server_default="NORMAL"),
        index=True,
    )
    compliance_status: str = Field(default="compliant", nullable=False, index=True)
    alert_flag: bool = Field(default=False, nullable=False)
    agent_notified: bool = Field(default=False, nullable=False, index=True)
    alert_type: Optional[AlertType] = Field(
        sa_column=Column(SAEnum(AlertType)), default=None, nullable=True
    )

    # OnAsset Sensor Health
    battery_pct: Optional[float] = Field(default=None, nullable=True)
    signal_strength: Optional[int] = Field(default=None, nullable=True)
    sensor_status: str = Field(default="active", nullable=False)

    # Audit / Source
    is_simulated: bool = Field(default=True, nullable=False)
    source: str = Field(default="generator", nullable=False)
    notes: Optional[str] = Field(default=None, nullable=True)

    # Soft delete
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
```

---

### `crisis_tickets`

```python
# app/models/crisis_ticket.py
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, ForeignKey, Text, Enum as SAEnum, JSON
from datetime import datetime
from enum import Enum
from typing import Optional, List


class TicketStatus(str, Enum):
    GENERATING = "GENERATING"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RESOLVED = "RESOLVED"


class CrisisTicket(SQLModel, table=True):
    __tablename__ = "crisis_tickets"

    id: Optional[int] = Field(default=None, primary_key=True)
    reading_id: str = Field(
        sa_column=Column(String(64), unique=True, nullable=False, index=True),
        foreign_key="telemetry_readings.reading_id",
    )
    shipment_id: Optional[str] = Field(default=None, nullable=True)

    status: TicketStatus = Field(
        sa_column=Column(SAEnum(TicketStatus), nullable=False, server_default="GENERATING"),
        index=True,
    )

    telemetry_snapshot: dict = Field(
        sa_column=Column(JSON, nullable=False, server_default="{}"),
        default_factory=dict,
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    reroute_options: List["RerouteOption"] = Relationship(back_populates="ticket")
    audit_logs: List["AuditLog"] = Relationship(back_populates="ticket")
```

---

### `reroute_options`

```python
# app/models/reroute_option.py
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, ForeignKey, Text, JSON, Enum as SAEnum
from datetime import datetime
from enum import Enum
from typing import Optional, List


class RouteMode(str, Enum):
    AIR = "air"
    MARITIME = "maritime"
    MULTIMODAL = "multimodal"


class ComplianceStatus(str, Enum):
    COMPLIANT = "COMPLIANT"
    CONDITIONAL = "CONDITIONAL"
    NON_COMPLIANT = "NON_COMPLIANT"
    PENDING = "PENDING"


class RerouteOption(SQLModel, table=True):
    __tablename__ = "reroute_options"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticket_id: int = Field(
        sa_column=Column(ForeignKey("crisis_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    )

    option_rank: int = Field(nullable=False)
    route_id: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    transit_mode: RouteMode = Field(
        sa_column=Column(SAEnum(RouteMode), nullable=False)
    )

    # Route metrics
    estimated_hours: Optional[float] = Field(default=None, nullable=True)
    risk_score: Optional[float] = Field(default=None, nullable=True)

    # Route geometry
    path_nodes: list[str] = Field(
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        default_factory=list,
    )
    waypoints: list[list[float]] = Field(
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        default_factory=list,
    )

    # Agent notes & compliance
    strategist_note: Optional[str] = Field(default=None, nullable=True)
    compliance_status: ComplianceStatus = Field(
        sa_column=Column(SAEnum(ComplianceStatus), nullable=False, server_default="PENDING"),
        index=True,
    )
    compliance_note: Optional[str] = Field(default=None, nullable=True)
    compliance_summary: Optional[str] = Field(default=None, nullable=True)

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    ticket: "CrisisTicket" = Relationship(back_populates="reroute_options")
```

---

### `planned_routes`

```python
# app/models/planned_route.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, ForeignKey, Text, JSON, Enum as SAEnum
from datetime import datetime
from enum import Enum
from typing import Optional


class PlanStatus(str, Enum):
    PLANNED = "PLANNED"
    APPROVED = "APPROVED"
    EXPIRED = "EXPIRED"


class PlannedRoute(SQLModel, table=True):
    __tablename__ = "planned_routes"

    id: Optional[int] = Field(default=None, primary_key=True)
    plan_token: str = Field(
        sa_column=Column(String(36), unique=True, nullable=False, index=True)
    )

    user_id: Optional[int] = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    )

    # Route identifiers
    origin_id: str = Field(sa_column=Column(String(12), nullable=False, index=True))
    dest_id: str = Field(sa_column=Column(String(12), nullable=False, index=True))
    cargo_type: str = Field(sa_column=Column(String(64), nullable=False))

    # Strategist output
    recommended_route_id: Optional[str] = Field(default=None, nullable=True)
    risk_score: Optional[float] = Field(default=None, nullable=True)
    compliance_summary: Optional[str] = Field(default=None, nullable=True)

    # Narrative & auditability
    evaluated_routes: list = Field(
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        default_factory=list,
    )
    thought_log: list[str] = Field(
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        default_factory=list,
    )

    status: PlanStatus = Field(
        sa_column=Column(SAEnum(PlanStatus), nullable=False, server_default="PLANNED"),
        index=True,
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
```

---

### `rp_approvals`

```python
# app/models/rp_approval.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, ForeignKey, Text
from datetime import datetime
from typing import Optional


class RPApproval(SQLModel, table=True):
    __tablename__ = "rp_approvals"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Approval custody
    ticket_id: int = Field(
        sa_column=Column(ForeignKey("crisis_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    reading_id: Optional[str] = Field(default=None, nullable=True)
    shipment_id: Optional[str] = Field(default=None, nullable=True)

    # Responsible Person identity (from JWT context)
    approved_by: str = Field(sa_column=Column(String(255), nullable=False))
    approver_user_id: Optional[int] = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    )

    # Signature & notes
    note: Optional[str] = Field(default=None, nullable=True)
    approved_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
```

---

### `audit_logs`

```python
# app/models/audit_log.py
from sqlmodel import SQLModel, Field, Column, Relationship
from sqlalchemy import String, ForeignKey, Text, JSON, Enum as SAEnum
from datetime import datetime
from enum import Enum
from typing import Optional


class AuditAction(str, Enum):
    RP_APPROVED = "RP_APPROVED"
    ROUTE_EVALUATED = "ROUTE_EVALUATED"
    CRISIS_DETECTED = "CRISIS_DETECTED"
    COMPLIANCE_CHECK = "COMPLIANCE_CHECK"
    REROUTE_SUGGESTED = "REROUTE_SUGGESTED"
    TICKET_CREATED = "TICKET_CREATED"
    DIPLOMAT_DRAFTED = "DIPLOMAT_DRAFTED"


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)

    ticket_id: Optional[int] = Field(
        sa_column=Column(ForeignKey("crisis_tickets.id", ondelete="SET NULL"), nullable=True, index=True)
    )

    agent_name: str = Field(sa_column=Column(String(128), nullable=False, index=True))
    action: AuditAction = Field(
        sa_column=Column(SAEnum(AuditAction), nullable=False, index=True)
    )
    details: dict = Field(
        sa_column=Column(JSON, nullable=False, server_default="{}"),
        default_factory=dict,
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # Relationships
    ticket: Optional["CrisisTicket"] = Relationship(back_populates="audit_logs")
```

---

### `jurisdiction_checks`

```python
# app/models/jurisdiction_check.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, ForeignKey, Text
from datetime import datetime
from typing import Optional


class JurisdictionCheck(SQLModel, table=True):
    __tablename__ = "jurisdiction_checks"

    id: Optional[int] = Field(default=None, primary_key=True)

    ticket_id: int = Field(
        sa_column=Column(ForeignKey("crisis_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    option_id: Optional[int] = Field(
        sa_column=Column(ForeignKey("reroute_options.id", ondelete="CASCADE"), nullable=True, index=True)
    )

    route_id: str = Field(sa_column=Column(String(64), nullable=False))
    jurisdiction_code: Optional[str] = Field(default=None, nullable=True)
    check_status: Optional[str] = Field(default=None, nullable=True)
    details: Optional[str] = Field(default=None, nullable=True)

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
```

---

### `regulation_citations`

```python
# app/models/regulation_citation.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, ForeignKey, Text
from datetime import datetime
from typing import Optional


class RegulationCitation(SQLModel, table=True):
    __tablename__ = "regulation_citations"

    id: Optional[int] = Field(default=None, primary_key=True)

    ticket_id: int = Field(
        sa_column=Column(ForeignKey("crisis_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    option_id: Optional[int] = Field(
        sa_column=Column(ForeignKey("reroute_options.id", ondelete="CASCADE"), nullable=True, index=True)
    )

    route_id: str = Field(sa_column=Column(String(64), nullable=False))
    clause: str = Field(sa_column=Column(Text, nullable=False))
    source: Optional[str] = Field(default=None, nullable=True)
    severity: Optional[str] = Field(default=None, nullable=True)

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
```

---

### `diplomat_drafts`

```python
# app/models/diplomat_draft.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, ForeignKey, Text, JSON, Enum as SAEnum
from datetime import datetime
from enum import Enum
from typing import Optional


class DraftStatus(str, Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    SENT = "SENT"
    FAILED = "FAILED"


class DiplomatDraft(SQLModel, table=True):
    __tablename__ = "diplomat_drafts"

    id: Optional[int] = Field(default=None, primary_key=True)

    ticket_id: int = Field(
        sa_column=Column(ForeignKey("crisis_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    shipment_id: Optional[str] = Field(default=None, nullable=True)

    summary_message: str = Field(sa_column=Column(Text, nullable=False))
    voice_script: dict = Field(
        sa_column=Column(JSON, nullable=False, server_default="{}"),
        default_factory=dict,
    )

    dispatch_status: DraftStatus = Field(
        sa_column=Column(SAEnum(DraftStatus), nullable=False, server_default="DRAFT"),
        index=True,
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
```

---

### `crisis_events`

```python
# app/models/crisis_event.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, ForeignKey, Text, JSON
from datetime import datetime
from typing import Optional


class CrisisEvent(SQLModel, table=True):
    __tablename__ = "crisis_events"

    id: Optional[int] = Field(default=None, primary_key=True)

    reading_id: str = Field(
        sa_column=Column(String(64), unique=True, nullable=False, index=True)
    )
    shipment_id: str = Field(sa_column=Column(String(64), nullable=False, index=True))

    recommendation_route_id: Optional[str] = Field(default=None, nullable=True)
    risk_score: Optional[float] = Field(default=None, nullable=True)

    thought_log: list[str] = Field(
        sa_column=Column(JSON, nullable=False, server_default="[]"),
        default_factory=list,
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
    )
```

---

### `processed_alerts`

```python
# app/models/processed_alert.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, ForeignKey
from datetime import datetime
from typing import Optional


class ProcessedAlert(SQLModel, table=True):
    __tablename__ = "processed_alerts"

    reading_id: str = Field(
        sa_column=Column(String(64), ForeignKey("telemetry_readings.reading_id", ondelete="CASCADE"), primary_key=True),
    )

    processed_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
    )
    agent_decision: Optional[str] = Field(default=None, nullable=True)
    resolution_status: str = Field(default="PENDING", nullable=False, index=True)
```

---

### Master Data: `airports`, `seaports`, `routes`, `country_risk_profiles`, `cargo_stability_profiles`

```python
# app/models/geography.py
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import String, Float, Text, JSON
from datetime import datetime
from typing import Optional


class Airport(SQLModel, table=True):
    __tablename__ = "airports"

    iata_code: str = Field(sa_column=Column(String(3), primary_key=True))
    city: Optional[str] = Field(default=None, nullable=True)
    country: Optional[str] = Field(default=None, nullable=True)
    country_code: Optional[str] = Field(default=None, nullable=True)
    latitude: float = Field(nullable=False)
    longitude: float = Field(nullable=False)
    elevation_m: Optional[float] = Field(default=None, nullable=True)


class Seaport(SQLModel, table=True):
    __tablename__ = "seaports"

    un_code: str = Field(sa_column=Column(String(5), primary_key=True))
    port_name: Optional[str] = Field(default=None, nullable=True)
    country: Optional[str] = Field(default=None, nullable=True)
    country_code: Optional[str] = Field(default=None, nullable=True)
    latitude: float = Field(nullable=False)
    longitude: float = Field(nullable=False)
    geom: Optional[dict] = Field(
        sa_column=Column(JSON),  # Or use Geometry type with GeoAlchemy2
        default=None,
        nullable=True,
    )


class Route(SQLModel, table=True):
    __tablename__ = "routes"

    id: Optional[int] = Field(default=None, primary_key=True)
    src_iata: str = Field(sa_column=Column(String(3), nullable=False, index=True))
    dst_iata: str = Field(sa_column=Column(String(3), nullable=False, index=True))
    distance_km: Optional[float] = Field(default=None, nullable=True)


class CountryRiskProfile(SQLModel, table=True):
    __tablename__ = "country_risk_profiles"

    country_code: str = Field(sa_column=Column(String(2), primary_key=True))
    country_name: Optional[str] = Field(default=None, nullable=True)
    political_stability: float = Field(default=50.0, nullable=False)  # 0-100
    customs_complexity: float = Field(default=50.0, nullable=False)  # 0-100
    border_delay_hours: Optional[float] = Field(default=None, nullable=True)


class CargoStabilityProfile(SQLModel, table=True):
    __tablename__ = "cargo_stability_profiles"

    cargo_type: str = Field(sa_column=Column(String(64), primary_key=True))
    min_temp_c: float = Field(nullable=False)
    max_temp_c: float = Field(nullable=False)
    humidity_min_pct: Optional[float] = Field(default=None, nullable=True)
    humidity_max_pct: Optional[float] = Field(default=None, nullable=True)
    light_sensitive: bool = Field(default=False, nullable=False)


class MaritimeLane(SQLModel, table=True):
    __tablename__ = "maritime_lanes"

    id: Optional[int] = Field(default=None, primary_key=True)
    lane_name: Optional[str] = Field(default=None, nullable=True)
    geom: Optional[dict] = Field(
        sa_column=Column(JSON),  # Or use Geometry type with GeoAlchemy2
        default=None,
        nullable=True,
    )
```

---

## 3. Pydantic Request/Response Schemas

### Auth Schemas

```python
# app/schemas/auth.py
from pydantic import BaseModel, EmailStr, field_validator
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "logistics_planner"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password cannot exceed 128 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    name: str
    role: str
    phone_number: str | None = None
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str
```

### Strategist Schemas

```python
# app/schemas/strategist.py
from pydantic import BaseModel, Field
from datetime import datetime


class PlanRouteRequest(BaseModel):
    origin_id: str = Field(min_length=3, max_length=12, description="IATA or UN/LOCODE")
    dest_id: str = Field(min_length=3, max_length=12, description="IATA or UN/LOCODE")
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


class StrategistOutput(BaseModel):
    recommended_route_id: str
    risk_score: float
    compliance_summary: str
    evaluated_routes: list[CrisisRerouteOption]
    thought_log: list[str]
```

### Shipment Schemas

```python
# app/schemas/shipment.py
from pydantic import BaseModel, field_validator
from datetime import datetime


class ShipmentCreate(BaseModel):
    shipment_code: str
    origin_id: str = Field(min_length=3, max_length=12)
    dest_id: str = Field(min_length=3, max_length=12)
    cargo_type: str
    temp_min_threshold: float = 2.0
    temp_max_threshold: float = 8.0

    @field_validator("temp_min_threshold", "temp_max_threshold")
    @classmethod
    def validate_thresholds(cls, v: float) -> float:
        if not -50 <= v <= 50:
            raise ValueError("Temperature must be between -50°C and 50°C")
        return v

    @field_validator("temp_max_threshold", mode="after")
    @classmethod
    def max_greater_than_min(cls, v: float, info) -> float:
        if "temp_min_threshold" in info.data and v < info.data["temp_min_threshold"]:
            raise ValueError("max_threshold must be >= min_threshold")
        return v


class ShipmentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    shipment_code: str
    origin_id: str
    dest_id: str
    cargo_type: str
    status: str
    temp_min_threshold: float
    temp_max_threshold: float
    created_at: datetime
    updated_at: datetime
```

### Telemetry Schemas

```python
# app/schemas/telemetry.py
from pydantic import BaseModel, Field
from datetime import datetime


class TelemetryReadingCreate(BaseModel):
    reading_id: str
    shipment_id: str
    container_id: str | None = None
    sensor_id: str | None = None
    recorded_at: datetime
    temp_c: float
    humidity_pct: float | None = None
    shock_g: float | None = None
    lat: float
    lng: float
    location_description: str | None = None
    medication_name: str | None = None
    batch_number: str | None = None


class TelemetryReadingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    reading_id: str
    shipment_id: str
    temp_c: float
    humidity_pct: float | None
    status: str
    alert_flag: bool
    agent_notified: bool
    lat: float
    lng: float
    recorded_at: datetime
    received_at: datetime
```

---

## 4. Database Table Reference

### `users`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | — | Y | Login identifier |
| `name` | `VARCHAR(255)` | NOT NULL | — | N | Display name |
| `hashed_password` | `TEXT` | NOT NULL | — | N | bcrypt/argon2 hash |
| `role` | `ENUM` | NOT NULL | `'logistics_planner'` | Y | User role |
| `phone_number` | `VARCHAR(20)` | NULLABLE | null | N | Contact |
| `is_active` | `BOOLEAN` | NOT NULL | `true` | Y | Account status |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Y | Audit |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | N | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | null | Y | Soft delete |

### `shipments`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `shipment_code` | `VARCHAR(64)` | UNIQUE, NOT NULL | — | Y | GS1/EPCIS identifier |
| `origin_id` | `VARCHAR(12)` | NOT NULL | — | Y | IATA or UN/LOCODE |
| `dest_id` | `VARCHAR(12)` | NOT NULL | — | Y | IATA or UN/LOCODE |
| `cargo_type` | `ENUM` | NOT NULL | — | Y | Vaccine, biologic, etc. |
| `temp_min_threshold` | `FLOAT` | NOT NULL | `2.0` | N | WHO TRS 961 |
| `temp_max_threshold` | `FLOAT` | NOT NULL | `8.0` | N | WHO TRS 961 |
| `created_by_user_id` | `BIGINT` | FK→users.id | null | Y | Custody chain |
| `status` | `ENUM` | NOT NULL | `'pending'` | Y | Shipment lifecycle |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Y | Audit |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | N | Auto-updated |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | null | Y | Soft delete |

### `telemetry_readings`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `reading_id` | `VARCHAR(64)` | UNIQUE, NOT NULL | — | Y | GS1 EPCIS 2.0 |
| `shipment_id` | `VARCHAR(64)` | FK→shipments | — | Y | Cargo owner |
| `container_id` | `VARCHAR(64)` | NULLABLE | null | N | Logistics unit |
| `sensor_id` | `VARCHAR(64)` | NULLABLE | null | N | Device ID |
| `recorded_at` | `TIMESTAMPTZ` | NOT NULL | — | N | Sensor timestamp (FDA 21 CFR) |
| `received_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | N | System receipt (FDA 21 CFR) |
| `temp_c` | `FLOAT` | NOT NULL | — | Y | Core measurement |
| `temp_min_threshold` | `FLOAT` | NOT NULL | `2.0` | N | WHO TRS 961 |
| `temp_max_threshold` | `FLOAT` | NOT NULL | `8.0` | N | WHO TRS 961 |
| `temp_excursion` | `BOOLEAN` | NOT NULL | `false` | N | Breach flag |
| `humidity_pct` | `FLOAT` | NULLABLE | null | N | Environmental |
| `shock_g` | `FLOAT` | NULLABLE | null | N | Environmental |
| `lat` | `FLOAT` | NOT NULL | — | Y | Geographic |
| `lng` | `FLOAT` | NOT NULL | — | Y | Geographic |
| `status` | `ENUM` | NOT NULL | `'NORMAL'` | Y | Alert classification |
| `alert_flag` | `BOOLEAN` | NOT NULL | `false` | N | Alert signal |
| `agent_notified` | `BOOLEAN` | NOT NULL | `false` | Y | Sentinel processing |
| `alert_type` | `ENUM` | NULLABLE | null | N | Anomaly type |
| `medication_name` | `VARCHAR(255)` | NULLABLE | null | N | Cargo tracking |
| `batch_number` | `VARCHAR(64)` | NULLABLE | null | N | Traceability |
| `is_simulated` | `BOOLEAN` | NOT NULL | `true` | N | Test data flag |
| `deleted_at` | `TIMESTAMPTZ` | NULLABLE | null | Y | Soft delete |

### `crisis_tickets`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `reading_id` | `VARCHAR(64)` | UNIQUE, FK→telemetry | — | Y | Crisis trigger |
| `shipment_id` | `VARCHAR(64)` | NULLABLE | null | Y | Asset owner |
| `status` | `ENUM` | NOT NULL | `'GENERATING'` | Y | Ticket lifecycle |
| `telemetry_snapshot` | `JSONB` | NOT NULL | `{}` | N | Crisis context |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Y | Audit |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | N | Auto-updated |

### `reroute_options`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `ticket_id` | `BIGINT` | FK→crisis_tickets | — | Y | Parent ticket |
| `option_rank` | `INT` | NOT NULL | — | N | Display order |
| `route_id` | `VARCHAR(64)` | NOT NULL | — | Y | Strategist route ID |
| `transit_mode` | `ENUM` | NOT NULL | — | N | Air/maritime/multimodal |
| `estimated_hours` | `FLOAT` | NULLABLE | null | N | Route duration |
| `risk_score` | `FLOAT` | NULLABLE | null | Y | Ranking metric (0-100) |
| `compliance_status` | `ENUM` | NOT NULL | `'PENDING'` | Y | Legal validation |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | N | Audit |

### `rp_approvals`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `ticket_id` | `BIGINT` | FK→crisis_tickets | — | Y | Custody parent |
| `reading_id` | `VARCHAR(64)` | NULLABLE | null | N | Crisis trigger |
| `approved_by` | `VARCHAR(255)` | NOT NULL | — | N | RP identity (JWT context) |
| `approver_user_id` | `BIGINT` | FK→users | null | Y | User linkage |
| `note` | `TEXT` | NULLABLE | null | N | Sign-off comment |
| `approved_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Y | Custody timestamp |

### `audit_logs`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `ticket_id` | `BIGINT` | FK→crisis_tickets | null | Y | Event parent |
| `agent_name` | `VARCHAR(128)` | NOT NULL | — | Y | Actor (agent or user) |
| `action` | `ENUM` | NOT NULL | — | Y | Action type (RP_APPROVED, ROUTE_EVALUATED, etc.) |
| `details` | `JSONB` | NOT NULL | `{}` | N | Event payload |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Y | Immutable timestamp |

### `planned_routes`

| Column | Type | Constraints | Default | Index | Notes |
|--------|------|------------|---------|-------|-------|
| `id` | `BIGSERIAL` | PK | — | Y | Primary key |
| `plan_token` | `VARCHAR(36)` | UNIQUE, NOT NULL | — | Y | Session identifier (UUID) |
| `user_id` | `BIGINT` | FK→users | null | Y | Requester |
| `origin_id` | `VARCHAR(12)` | NOT NULL | — | Y | Proactive planning |
| `dest_id` | `VARCHAR(12)` | NOT NULL | — | Y | Proactive planning |
| `cargo_type` | `VARCHAR(64)` | NOT NULL | — | N | Goods type |
| `recommended_route_id` | `VARCHAR(64)` | NULLABLE | null | N | Strategist output |
| `risk_score` | `FLOAT` | NULLABLE | null | N | Route-level score |
| `evaluated_routes` | `JSONB` | NOT NULL | `[]` | N | All candidates |
| `thought_log` | `JSONB` | NOT NULL | `[]` | N | Strategist thinking |
| `status` | `ENUM` | NOT NULL | `'PLANNED'` | Y | Session status |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Y | Audit |

---

## 5. Alembic Migrations

### Setup

```bash
# Initialize (one-time)
cd backend
uv run alembic init migrations

# Configure for async patterns
# See: migrations/env.py (async_engine_from_config pattern)
```

### `migrations/env.py` (Async Pattern)

```python
"""
Alembic environment configuration for async SQLModel + Supabase.
"""
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import async_engine_from_config, create_async_engine
from alembic import context

# Import all models so Alembic detects them for autogenerate
from app.models.user import User
from app.models.shipment import Shipment
from app.models.telemetry import TelemetryReading
from app.models.crisis_ticket import CrisisTicket
from app.models.reroute_option import RerouteOption
from app.models.planned_route import PlannedRoute
from app.models.rp_approval import RPApproval
from app.models.audit_log import AuditLog
from app.models.crisis_event import CrisisEvent
from app.models.geography import Airport, Seaport, Route, CountryRiskProfile

from sqlmodel import SQLModel

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode with async engine.
    """
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = configuration["sqlalchemy.url"].replace(
        "postgresql://", "postgresql+asyncpg://"
    )

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=NullPool,  # No pooling for migrations
    )

    with connectable.begin() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    asyncio.run(connectable.dispose())


run_migrations_online()
```

### Migration Naming Convention

```
migrations/versions/
  001_create_users.py
  002_create_shipments.py
  003_create_telemetry_readings.py
  004_create_crisis_tickets.py
  005_create_indexes_on_telemetry.py

Format: NNN_verb_object_description.py
Verbs: create, add, drop, rename, alter
```

### Commands

```bash
# Generate from model changes
uv run alembic revision --autogenerate -m "create shipments table"

# Review migration before applying
cat migrations/versions/NNN_*.py

# Apply all pending
uv run alembic upgrade head

# Rollback one
uv run alembic downgrade -1

# Check current version
uv run alembic current

# View history
uv run alembic history
```

### Migration Rules

```
✅ DO:
  - Review autogenerated migrations manually
  - Test both upgrade AND downgrade
  - Add indexes in same migration as table creation
  - Use NOT NULL constraints for new columns only after backfill

❌ DON'T:
  - Drop columns in production (mark nullable first)
  - Rename columns (add new + migrate + drop old)
  - Run alembic in app startup (use CI/deployment scripts)
  - Commit large data migrations (use background jobs)
```

---

## 6. Query Patterns

### Always Filter Soft-Deleted Rows

```python
# CORRECT
from sqlalchemy.orm import selectinload
from sqlmodel import select

# Single entity
result = await db.execute(
    select(Shipment).where(Shipment.deleted_at.is_(None))
)
shipment = result.scalar_one_or_none()

# List with filter
result = await db.execute(
    select(Shipment)
    .where(Shipment.deleted_at.is_(None))
    .where(Shipment.status == ShipmentStatus.IN_TRANSIT)
    .order_by(Shipment.created_at.desc())
)
shipments = result.scalars().all()
```

### Avoid N+1: Use selectinload

```python
# CORRECT — eager load relationships
result = await db.execute(
    select(CrisisTicket)
    .options(selectinload(CrisisTicket.reroute_options))
    .options(selectinload(CrisisTicket.audit_logs))
    .where(CrisisTicket.deleted_at.is_(None))
)

# WRONG — lazy loading in async context fails
tickets = result.scalars().all()
for ticket in tickets:
    print(ticket.reroute_options)  # MissingGreenlet error!
```

### Transactions for Multi-Table Operations

```python
async def create_crisis_ticket_with_options(
    db: AsyncSession,
    reading_id: str,
    shipment_id: str,
    reroute_options: list[dict],
) -> CrisisTicket:
    try:
        # Create parent
        ticket = CrisisTicket(
            reading_id=reading_id,
            shipment_id=shipment_id,
            status=TicketStatus.PENDING_APPROVAL,
        )
        db.add(ticket)
        await db.flush()  # Get ID without committing

        # Create children
        for opt in reroute_options:
            option = RerouteOption(
                ticket_id=ticket.id,
                **opt,
            )
            db.add(option)

        # Single commit (all-or-nothing)
        await db.commit()
        return ticket

    except Exception:
        await db.rollback()
        raise
```

### Atomic RP Approval Write

```python
async def approve_crisis_ticket(
    db: AsyncSession,
    ticket_id: int,
    user: User,
    note: str | None = None,
) -> ApproveTicketResponse:
    """
    Atomic write to three tables in single transaction.
    """
    try:
        # 1. Insert RP approval
        approval = RPApproval(
            ticket_id=ticket_id,
            approved_by=user.name,
            approver_user_id=user.id,
            note=note,
        )
        db.add(approval)

        # 2. Insert audit log
        audit = AuditLog(
            ticket_id=ticket_id,
            agent_name="ResponsiblePerson",
            action=AuditAction.RP_APPROVED,
            details={
                "approved_by": user.name,
                "approver_user_id": user.id,
                "note": note,
            },
        )
        db.add(audit)

        # 3. Update ticket status
        ticket = await db.get(CrisisTicket, ticket_id)
        ticket.status = TicketStatus.APPROVED
        ticket.updated_at = datetime.utcnow()

        # SINGLE COMMIT
        await db.commit()

        return ApproveTicketResponse(
            ticket_id=ticket_id,
            status="APPROVED",
            approved_by=user.name,
        )

    except Exception:
        await db.rollback()
        raise
```

---

## 7. Seed Data for Development

### Suez Canal Crisis Scenario

```python
# seeds/dev_seed.py
import asyncio
from datetime import datetime, timedelta
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.shipment import Shipment, ShipmentStatus, CargoType
from app.models.telemetry import TelemetryReading, ReadingStatus, AlertType
from app.services.auth_service import AuthService
from sqlmodel import select


async def seed_users():
    """Seed dev users."""
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(select(User).where(User.email == "planner@dev.local"))
        if result.scalar_one_or_none():
            print("Users already seeded, skipping...")
            return

        users = [
            User(
                email="planner@dev.local",
                name="Elena Logistics Planner",
                hashed_password=AuthService.hash_password("DevPlanner123!"),
                role=UserRole.LOGISTICS_PLANNER,
                phone_number="+1-555-0101",
            ),
            User(
                email="approver@dev.local",
                name="Dr. Aris Responsible Person",
                hashed_password=AuthService.hash_password("DevApprover123!"),
                role=UserRole.RESPONSIBLE_PERSON,
                phone_number="+1-555-0102",
            ),
            User(
                email="admin@dev.local",
                name="Admin User",
                hashed_password=AuthService.hash_password("DevAdmin123!"),
                role=UserRole.ADMIN,
            ),
        ]

        for user in users:
            db.add(user)

        await db.commit()
        print(f"✓ Seeded {len(users)} users")


async def seed_shipment_suez_scenario():
    """Seed the Suez Canal anomaly scenario."""
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(
            select(Shipment).where(Shipment.shipment_code == "SHP-SUEZ-2026-001")
        )
        if result.scalar_one_or_none():
            print("Suez scenario already seeded, skipping...")
            return

        # Create shipment: Mumbai → New York (vaccine)
        shipment = Shipment(
            shipment_code="SHP-SUEZ-2026-001",
            origin_id="BOM",  # Mumbai (IATA)
            dest_id="JFK",  # New York (IATA)
            cargo_type=CargoType.VACCINE,
            temp_min_threshold=2.0,
            temp_max_threshold=8.0,
            status=ShipmentStatus.IN_TRANSIT,
        )
        db.add(shipment)
        await db.flush()
        shipment_id = shipment.shipment_code

        # Create nominal telemetry readings (pre-crisis)
        base_time = datetime.utcnow() - timedelta(hours=2)
        nominal_readings = [
            TelemetryReading(
                reading_id=f"SUEZ-NOMINAL-{i:03d}",
                shipment_id=shipment_id,
                container_id="CONT-SUEZ-001",
                sensor_id="SENSOR-DHL-0042",
                recorded_at=base_time + timedelta(minutes=5 * i),
                temp_c=5.5 + (0.2 * (i % 3)),  # Slight variation around 5.5°C
                humidity_pct=45.0,
                lat=20.0 + (0.1 * i),  # Route path
                lng=65.0 + (0.1 * i),
                location_description=f"Container track point {i}",
                medication_name="COVID-19 mRNA Vaccine",
                batch_number="BATCH-2024-001",
                is_simulated=True,
                status=ReadingStatus.NORMAL,
                alert_flag=False,
            )
            for i in range(10)
        ]

        for reading in nominal_readings:
            db.add(reading)

        await db.flush()

        # Create CRISIS reading: temperature excursion at Suez crossing
        crisis_reading = TelemetryReading(
            reading_id="SUEZ-CRISIS-0420",
            shipment_id=shipment_id,
            container_id="CONT-SUEZ-001",
            sensor_id="SENSOR-DHL-0042",
            recorded_at=base_time + timedelta(hours=1, minutes=50),
            temp_c=15.2,  # BREACH: Exceeds max (8.0°C)
            temp_min_threshold=2.0,
            temp_max_threshold=8.0,
            temp_excursion=True,
            excursion_duration_seconds=1200,  # 20 minutes
            humidity_pct=72.0,
            lat=29.95,  # Suez Canal coordinates
            lng=32.58,
            location_description="Suez Canal transit zone (container cooling failure)",
            medication_name="COVID-19 mRNA Vaccine",
            batch_number="BATCH-2024-001",
            is_simulated=True,
            status=ReadingStatus.CRITICAL,
            alert_flag=True,
            agent_notified=False,
            alert_type=AlertType.TEMP_HIGH,
        )
        db.add(crisis_reading)

        await db.commit()
        print(f"✓ Seeded Suez scenario: {shipment_id} with {len(nominal_readings)} nominal + 1 crisis reading")


async def seed_all():
    """Run all seed functions."""
    print("\n" + "=" * 60)
    print("🌱 Seeding PharmaGuard AI development database...")
    print("=" * 60 + "\n")

    await seed_users()
    await seed_shipment_suez_scenario()

    print("\n" + "=" * 60)
    print("✓ Seed complete! Ready for development.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(seed_all())
```

### Run seed

```bash
uv run python seeds/dev_seed.py
```

---

## 8. Data Lifecycle & Retention

| Entity | Retention | Soft Delete | Hard Delete | Rationale |
|--------|-----------|-----------|----------|-----------|
| **User** | Indefinite (until user deletion request) | Yes (deleted_at) | 30 days after soft delete | GDPR right-to-be-forgotten |
| **Shipment** | Indefinite (audit trail) | Yes (deleted_at) | Never (compliance) | Regulatory traceability |
| **TelemetryReading** | 1 year | Yes (deleted_at) | Auto-purge after 1 year | Cost; keep recent for debugging |
| **CrisisTicket** | Indefinite (audit trail) | No (immutable custody record) | Never | Regulatory compliance |
| **RerouteOption** | Indefinite (audit trail) | No (immutable) | Never | Regulatory compliance |
| **RPApproval** | Indefinite | No (immutable custody) | Never | **Non-repudiation** (eSignature) |
| **AuditLog** | 3 years | No (immutable) | Hard delete after 3 years | SOC2, HIPAA-adjacent |
| **PlannedRoute** | 90 days | No | Auto-purge after 90 days | Session artifact |
| **ProcessedAlert** | 1 year | No | Auto-purge after 1 year | Alert dedup |

### Cleanup Job (Scheduled Daily)

```python
# app/jobs/cleanup_job.py
async def cleanup_stale_data():
    """Hard-delete expired records (runs daily)."""
    async with AsyncSessionLocal() as db:
        one_year_ago = datetime.utcnow() - timedelta(days=365)
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)

        # Hard-delete old telemetry
        await db.execute(
            delete(TelemetryReading).where(TelemetryReading.created_at < one_year_ago)
        )

        # Hard-delete expired planned routes
        await db.execute(
            delete(PlannedRoute).where(PlannedRoute.created_at < ninety_days_ago)
        )

        # Hard-delete old processed alerts
        await db.execute(
            delete(ProcessedAlert).where(ProcessedAlert.processed_at < one_year_ago)
        )

        await db.commit()
        logging.info("✓ Cleanup job completed")
```

---

## 9. Security & Compliance Notes

### Sensitive Fields
- `User.hashed_password`: Never log, never expose in API
- `RPApproval.approved_by`: Log approver name + JWT fingerprint for non-repudiation
- `AuditLog.details`: Can contain sensitive data; restrict read access by role

### PII Handling
- Users requesting account deletion: soft delete → hard delete after 30 days (grace period)
- TelemetryReading may contain customer identifiers: mask in exports

### Immutability
- `AuditLog`: append-only; never permit updates or deletes except hard purge after retention
- `RPApproval`: immutable once written (represents legal custody transfer)

### Row-Level Security (Supabase RLS)
suggested policies:
```sql
-- Users can only see their own profile
CREATE POLICY users_select_self ON users
  USING (auth.uid()::text = id::text);

-- RP approvals visible to ticket creator + approver
CREATE POLICY rp_approvals_visibility ON rp_approvals
  USING (
    approver_user_id = auth.uid()::int
    OR ticket_id IN (
      SELECT id FROM crisis_tickets
      WHERE created_by_user_id = auth.uid()::int
    )
  );

-- Telemetry visible to shipment owner + logistics team
CREATE POLICY telemetry_visibility ON telemetry_readings
  USING (
    auth.has_role('logistics_planner')
    OR auth.has_role('admin')
  );
```

---

## 10. Indexing Strategy

### Critical Indexes (Performance)

```sql
-- Telemetry hot path (Sentinel polling)
CREATE INDEX idx_telemetry_status_agent_notified ON telemetry_readings(status, agent_notified);
CREATE INDEX idx_telemetry_lat_lng ON telemetry_readings(lat, lng);  -- For geospatial queries

-- Crisis ticket lookups
CREATE INDEX idx_crisis_tickets_status_created ON crisis_tickets(status, created_at DESC);

-- Audit trail filtering
CREATE INDEX idx_audit_logs_ticket_action ON audit_logs(ticket_id, action);

-- Soft delete filtering (add to most queries)
CREATE INDEX idx_shipments_deleted_at ON shipments(deleted_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

### Optional Indexes (JSONB)

```sql
-- If querying evaluated_routes array
CREATE INDEX idx_planned_routes_evaluated_routes ON planned_routes USING GIN (evaluated_routes);

-- If querying audit log details
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN (details);
```

---

**END OF DATA_SCHEMA.md**
