from __future__ import annotations

import asyncio
import logging

from twilio.rest import Client

from app.config import settings


logger = logging.getLogger(__name__)


def twilio_calling_enabled() -> bool:
    return bool(
        settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_PHONE_NUMBER
        and settings.TWILIO_STUDIO_FLOW_SID
    )


def trigger_anomaly_call(to_number: str) -> str:
    if not twilio_calling_enabled():
        raise RuntimeError(
            "Twilio is not fully configured. Required: TWILIO_ACCOUNT_SID, "
            "TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_STUDIO_FLOW_SID."
        )

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    execution = client.studio.v2.flows(settings.TWILIO_STUDIO_FLOW_SID).executions.create(
        to=to_number,
        from_=settings.TWILIO_PHONE_NUMBER,
    )
    return execution.sid


async def trigger_anomaly_call_async(to_number: str) -> str:
    return await asyncio.to_thread(trigger_anomaly_call, to_number)


async def maybe_trigger_critical_call(to_number: str | None) -> str | None:
    if not to_number:
        logger.info("Twilio call skipped: no operator phone provided")
        return None

    if not twilio_calling_enabled():
        logger.info("Twilio call skipped: Twilio environment not fully configured")
        return None

    try:
        call_sid = await trigger_anomaly_call_async(to_number)
        logger.info("Twilio Studio execution triggered successfully sid=%s", call_sid)
        return call_sid
    except Exception as exc:  # noqa: BLE001
        logger.exception("Twilio escalation call failed for %s: %s", to_number, exc)
        return None
