from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, Enum as SAEnum, Float, ForeignKey, JSON, Numeric, String, Text
from sqlmodel import Field, SQLModel


class ShipmentStatus(str, Enum):
    ACTIVE = 'active'
    CRITICAL = 'critical'
    WARNING = 'warning'
    NORMAL = 'normal'
    FEED_LOST = 'feed_lost'
    DELIVERED = 'delivered'
    PLANNED = 'planned'


class TransitMode(str, Enum):
    AIR = 'air'
    MARITIME = 'maritime'
    GROUND = 'ground'
    MULTIMODAL = 'multimodal'


class Shipment(SQLModel, table=True):
    __tablename__ = 'shipments'

    id: Optional[int] = Field(default=None, primary_key=True)
    shipment_code: str = Field(sa_column=Column(String(64), unique=True, nullable=False, index=True))
    created_by_user_id: int = Field(sa_column=Column(ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True))
    sensor_id: str = Field(sa_column=Column(String(64), nullable=False, index=True))
    medication_name: str = Field(sa_column=Column(String(255), nullable=False))
    lot_number: str = Field(sa_column=Column(String(64), nullable=False))
    temp_min_c: float = Field(sa_column=Column(Float, nullable=False))
    temp_max_c: float = Field(sa_column=Column(Float, nullable=False))
    safe_humidity_min: float = Field(sa_column=Column(Numeric, nullable=False, server_default='35'))
    safe_humidity_max: float = Field(sa_column=Column(Numeric, nullable=False, server_default='60'))
    origin_locode: str = Field(sa_column=Column(String(16), nullable=False, index=True))
    destination_locode: str = Field(sa_column=Column(String(16), nullable=False, index=True))
    transit_mode: TransitMode = Field(sa_column=Column(SAEnum(TransitMode), nullable=False, server_default='multimodal'))
    estimated_hours: float = Field(sa_column=Column(Float, nullable=False, server_default='0'))
    waypoints: list[list[float]] = Field(sa_column=Column(JSON, nullable=False, server_default='[]'), default_factory=list)
    status: ShipmentStatus = Field(sa_column=Column(SAEnum(ShipmentStatus), nullable=False, server_default='active', index=True))
    current_temp_c: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    current_humidity_pct: Optional[float] = Field(default=None, sa_column=Column(Float, nullable=True))
    route_label: Optional[str] = Field(default=None, sa_column=Column(String(255), nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(nullable=False, index=True))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(nullable=False))
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(nullable=True, index=True))


class AuditAction(str, Enum):
    SHIPMENT_INITIALIZED = 'SHIPMENT_INITIALIZED'
    SHIPMENT_APPROVED = 'SHIPMENT_APPROVED'


class AuditLog(SQLModel, table=True):
    __tablename__ = 'audit_logs'

    id: Optional[int] = Field(default=None, primary_key=True)
    shipment_id: Optional[int] = Field(default=None, sa_column=Column(ForeignKey('shipments.id', ondelete='SET NULL'), nullable=True, index=True))
    ticket_id: Optional[int] = Field(default=None, sa_column=Column(nullable=True, index=True))
    agent_name: str = Field(sa_column=Column(String(128), nullable=False, index=True))
    action: AuditAction = Field(sa_column=Column(SAEnum(AuditAction), nullable=False, index=True))
    details: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, server_default='{}'))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(nullable=False, index=True))
