from __future__ import annotations

import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from agents.strategist_agent import PharmaGuardStrategistAgent
from agents.state import StrategistOutput
from app.api.deps import get_current_user
from app.database import get_db
from app.schemas.base import SuccessResponse
from app.schemas.strategist import (
    ApproveTicketRequest,
    ApproveTicketResponse,
    CrisisTicketResponse,
    PlanRouteRequest,
)
from services.crisis_manager import CrisisOrchestrator


router = APIRouter()


@router.post('/plan', status_code=200)
async def plan_route(
    request: PlanRouteRequest,
    session: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> SuccessResponse[StrategistOutput]:
    await CrisisOrchestrator().ensure_tables()

    strategist = PharmaGuardStrategistAgent()
    output = await strategist.plan_new_route(
        session=session,
        origin_id=request.origin_id,
        dest_id=request.dest_id,
        cargo_type=request.cargo_type,
    )

    plan_token = str(uuid4())
    await strategist.save_planned_route(
        session=session,
        plan_token=plan_token,
        user_id=int(user['id']),
        origin_id=request.origin_id,
        dest_id=request.dest_id,
        cargo_type=request.cargo_type,
        output=output,
    )
    await session.commit()

    return SuccessResponse(data=output)


@router.get('/tickets/latest', status_code=200)
async def get_latest_ticket(
    session: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
) -> SuccessResponse[CrisisTicketResponse]:
    await CrisisOrchestrator().ensure_tables()

    result = await session.execute(
        text(
            """
            WITH latest_ticket AS (
                SELECT id, reading_id, COALESCE(shipment_id, '') AS shipment_id, status
                FROM public.crisis_tickets
                WHERE status IN ('GENERATING', 'PENDING_APPROVAL', 'APPROVED')
                ORDER BY updated_at DESC NULLS LAST, id DESC
                LIMIT 1
            )
            SELECT
                lt.id AS ticket_id,
                lt.reading_id,
                lt.shipment_id,
                lt.status,
                ce.recommendation_route_id,
                ce.risk_score,
                COALESCE(ce.thought_log, '[]'::jsonb) AS thought_log,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'option_rank', ro.option_rank,
                            'route_id', ro.route_id,
                            'transit_mode', ro.transit_mode,
                            'estimated_hours', COALESCE(ro.estimated_hours, 0),
                            'risk_score', COALESCE(ro.risk_score, 100),
                            'path_nodes', COALESCE(ro.path_nodes, '[]'::jsonb),
                            'waypoints', COALESCE(ro.waypoints, '[]'::jsonb),
                            'strategist_note', ro.strategist_note,
                            'compliance_status', ro.compliance_status,
                            'compliance_note', ro.compliance_note,
                            'compliance_summary', ro.compliance_summary
                        )
                        ORDER BY ro.option_rank
                    ) FILTER (WHERE ro.id IS NOT NULL),
                    '[]'::json
                ) AS evaluated_routes
            FROM latest_ticket lt
            LEFT JOIN public.crisis_events ce ON ce.reading_id = lt.reading_id
            LEFT JOIN public.reroute_options ro ON ro.ticket_id = lt.id
            GROUP BY
                lt.id,
                lt.reading_id,
                lt.shipment_id,
                lt.status,
                ce.recommendation_route_id,
                ce.risk_score,
                ce.thought_log
            """
        )
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='No crisis ticket found')

    payload = CrisisTicketResponse(
        ticket_id=int(row['ticket_id']),
        reading_id=str(row['reading_id']),
        shipment_id=str(row['shipment_id']),
        status=str(row['status']),
        recommended_route_id=(str(row['recommendation_route_id']) if row['recommendation_route_id'] else None),
        risk_score=(float(row['risk_score']) if row['risk_score'] is not None else None),
        thought_log=list(row['thought_log'] or []),
        evaluated_routes=list(row['evaluated_routes'] or []),
    )
    return SuccessResponse(data=payload)


@router.post('/tickets/{ticket_id}/approve', status_code=200)
async def approve_ticket(
    ticket_id: int,
    request: ApproveTicketRequest,
    session: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> SuccessResponse[ApproveTicketResponse]:
    await CrisisOrchestrator().ensure_tables()

    ticket_result = await session.execute(
        text(
            """
            SELECT id, reading_id, COALESCE(shipment_id, '') AS shipment_id
            FROM public.crisis_tickets
            WHERE id = :ticket_id
            LIMIT 1
            """
        ),
        {'ticket_id': ticket_id},
    )
    ticket_row = ticket_result.mappings().first()
    if not ticket_row:
        raise HTTPException(status_code=404, detail='Ticket not found')

    approved_by = str(user.get('name') or user.get('id') or 'responsible_person')

    await session.execute(
        text(
            """
            INSERT INTO public.rp_approvals (
                ticket_id,
                reading_id,
                shipment_id,
                approved_by,
                approver_user_id,
                note,
                approved_at
            ) VALUES (
                :ticket_id,
                :reading_id,
                :shipment_id,
                :approved_by,
                :approver_user_id,
                :note,
                now()
            )
            """
        ),
        {
            'ticket_id': int(ticket_row['id']),
            'reading_id': str(ticket_row['reading_id']),
            'shipment_id': str(ticket_row['shipment_id']),
            'approved_by': approved_by,
            'approver_user_id': int(user['id']),
            'note': request.note,
        },
    )

    await session.execute(
        text(
            """
            INSERT INTO public.audit_logs (
                ticket_id,
                agent_name,
                action,
                details,
                created_at
            ) VALUES (
                :ticket_id,
                'ResponsiblePerson',
                'RP_APPROVED',
                cast(:details as jsonb),
                now()
            )
            """
        ),
        {
            'ticket_id': int(ticket_row['id']),
            'details': json.dumps(
                {
                    'approved_by': approved_by,
                    'approver_user_id': int(user['id']),
                    'note': request.note,
                }
            ),
        },
    )

    await session.execute(
        text(
            """
            UPDATE public.crisis_tickets
            SET status = 'APPROVED',
                updated_at = now()
            WHERE id = :ticket_id
            """
        ),
        {'ticket_id': int(ticket_row['id'])},
    )

    await session.commit()

    return SuccessResponse(
        data=ApproveTicketResponse(
            ticket_id=int(ticket_row['id']),
            status='APPROVED',
            approved_by=approved_by,
        )
    )
