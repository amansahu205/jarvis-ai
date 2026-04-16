from __future__ import annotations

import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from agents.tools import POParserTool
from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.schemas.base import SuccessResponse
from app.schemas.shipments import ParsedShipment, ShipmentCreateRequest, ShipmentRecord
from app.services.shipment_service import append_initial_audit_log, create_shipment_record, ensure_user
from app.services.twilio_service import trigger_anomaly_call_async
from services.crisis_manager import CrisisOrchestrator

router = APIRouter()
po_parser = POParserTool()


@router.post('/parse-po', status_code=200)
async def parse_purchase_order(
    file: Annotated[UploadFile, File(...)],
    session: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> SuccessResponse[ParsedShipment]:
    await CrisisOrchestrator().ensure_tables()

    if not file.content_type:
        raise HTTPException(status_code=400, detail='Upload content type is required')
    if file.content_type not in {'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'}:
        raise HTTPException(status_code=415, detail='Only PDF and image uploads are supported')

    file_bytes = await file.read()

    # Compute SHA-256 fingerprint for duplicate detection
    po_hash = hashlib.sha256(file_bytes).hexdigest()

    # Check if a shipment was already created from this exact file
    existing_code: str | None = None
    try:
        result = await session.execute(
            text('SELECT shipment_code FROM public.shipments WHERE po_file_hash = :h LIMIT 1'),
            {'h': po_hash},
        )
        row = result.first()
        if row:
            existing_code = str(row[0])
    except Exception:
        pass  # Non-fatal - duplicate check is advisory only

    # Demo fallback data - used if AI parsing fails
    demo_fallback = ParsedShipment(
        shipment_code='PO-2026-DEMO01',
        sensor_id='ONASSET-7729-A',
        medication_name='Humira (Adalimumab)',
        lot_number='LOT-992-AZ',
        temp_min_c=2.0,
        temp_max_c=8.0,
        humidity_min_pct=35.0,
        humidity_max_pct=60.0,
        origin_locode='USNYC',
        destination_locode='GBLHR',
    )

    try:
        parsed = await po_parser.parse_upload(
            filename=file.filename or 'purchase-order',
            content_type=file.content_type,
            file_bytes=file_bytes,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            'PO parsing failed (%s) - using demo fallback data', exc
        )
        parsed = demo_fallback

    parsed.po_file_hash = po_hash
    parsed.existing_shipment_code = existing_code
    return SuccessResponse(data=parsed)


@router.post('/create', status_code=201)
async def create_shipment(
    request: ShipmentCreateRequest,
    session: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    demo_trigger_critical_call: bool = Query(
        default=False,
        description='Demo-only: immediately trigger Twilio Studio call after shipment creation.',
    ),
    demo_operator_phone: str | None = Query(
        default=None,
        description='Optional phone override for demo Twilio call. Falls back to RP_PHONE_NUMBER.',
    ),
) -> SuccessResponse[ShipmentRecord]:
    await CrisisOrchestrator().ensure_tables()

    print(f'DEBUG USER: {user}')
    if user.get('role') not in {'logistics_planner', 'admin'}:
        raise HTTPException(status_code=403, detail='Logistics planner role required')

    current_user = await ensure_user(session, int(user['id']))
    record = await create_shipment_record(session, parsed=request, user_id=int(current_user.id))

    twilio_execution_sid: str | None = None
    if demo_trigger_critical_call:
        target_phone = demo_operator_phone or settings.RP_PHONE_NUMBER
        if not target_phone:
            raise HTTPException(
                status_code=400,
                detail='Demo call requested but no target phone provided and RP_PHONE_NUMBER is empty.',
            )
        try:
            twilio_execution_sid = await trigger_anomaly_call_async(target_phone)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f'Twilio demo call failed: {exc}') from exc

    await append_initial_audit_log(
        session,
        shipment_id=record.id,
        user_id=int(current_user.id),
        user_name=str(current_user.name),
        details={
            'shipment_code': record.shipment_code,
            'origin_locode': record.origin_locode,
            'destination_locode': record.destination_locode,
            'transit_mode': record.transit_mode,
            'demo_twilio_execution_sid': twilio_execution_sid,
            'demo_call_triggered': bool(twilio_execution_sid),
        },
    )
    await session.commit()
    return SuccessResponse(data=record)


@router.post('/demo-critical-call', status_code=200)
async def demo_critical_call(
    to_number: str | None = Query(
        default=None,
        description='Destination phone number for demo escalation call. Falls back to RP_PHONE_NUMBER.',
    ),
    user: dict = Depends(get_current_user),
) -> SuccessResponse[dict[str, str | bool | None]]:
    if user.get('role') not in {'logistics_planner', 'admin'}:
        raise HTTPException(status_code=403, detail='Logistics planner role required')

    target_phone = to_number or settings.RP_PHONE_NUMBER
    if not target_phone:
        raise HTTPException(
            status_code=400,
            detail='No target phone provided. Set to_number or RP_PHONE_NUMBER.',
        )

    try:
        execution_sid = await trigger_anomaly_call_async(target_phone)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Twilio demo call failed: {exc}') from exc

    return SuccessResponse(
        data={
            'triggered': True,
            'to': target_phone,
            'twilio_execution_sid': execution_sid,
        }
    )
