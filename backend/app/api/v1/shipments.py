from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from agents.tools import POParserTool
from app.api.deps import get_current_user
from app.database import get_db
from app.schemas.base import SuccessResponse
from app.schemas.shipments import ParsedShipment, ShipmentCreateRequest, ShipmentRecord
from app.services.shipment_service import append_initial_audit_log, create_shipment_record, ensure_user
from services.crisis_manager import CrisisOrchestrator

router = APIRouter()
po_parser = POParserTool()


@router.post('/parse-po', status_code=200)
async def parse_purchase_order(
    file: Annotated[UploadFile, File(...)],
    _: dict = Depends(get_current_user),
) -> SuccessResponse[ParsedShipment]:
    await CrisisOrchestrator().ensure_tables()

    if not file.content_type:
        raise HTTPException(status_code=400, detail='Upload content type is required')
    if file.content_type not in {'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'}:
        raise HTTPException(status_code=415, detail='Only PDF and image uploads are supported')

    file_bytes = await file.read()
    parsed = await po_parser.parse_upload(filename=file.filename or 'purchase-order', content_type=file.content_type, file_bytes=file_bytes)
    return SuccessResponse(data=parsed)


@router.post('/create', status_code=201)
async def create_shipment(
    request: ShipmentCreateRequest,
    session: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> SuccessResponse[ShipmentRecord]:
    await CrisisOrchestrator().ensure_tables()

    if user.get('role') not in {'logistics_planner', 'admin'}:
        raise HTTPException(status_code=403, detail='Logistics planner role required')

    current_user = await ensure_user(session, int(user['id']))
    record = await create_shipment_record(session, parsed=request, user_id=int(current_user.id))
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
        },
    )
    await session.commit()
    return SuccessResponse(data=record)
