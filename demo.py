#!/usr/bin/env python3
"""End-to-end demo runner for PharmaGuard agentic flow.

This script automates:
1) Create or upsert a shipment
2) Ingest a CRITICAL telemetry record
3) Poll for strategist crisis ticket generation (Sentinel -> Orchestrator chain)
4) Optionally trigger demo-critical-call endpoint as a fallback/guaranteed ring
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


def _http_json(method: str, url: str, payload: dict | None = None) -> dict:
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {url}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error for {url}: {exc}") from exc


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_shipment_code() -> str:
    return f"PO-2026-DEMO-{datetime.now().strftime('%H%M%S')}"


def run_demo(args: argparse.Namespace) -> int:
    base = args.base_url.rstrip("/")
    shipment_code = args.shipment_code or _default_shipment_code()

    print("[1/5] Creating shipment...")
    create_payload = {
        "shipment_code": shipment_code,
        "sensor_id": args.sensor_id,
        "medication_name": args.medication_name,
        "lot_number": args.lot_number,
        "temp_min_c": args.temp_min,
        "temp_max_c": args.temp_max,
        "humidity_min_pct": args.humidity_min,
        "humidity_max_pct": args.humidity_max,
        "origin_locode": args.origin,
        "destination_locode": args.destination,
    }
    create_resp = _http_json("POST", f"{base}/shipments/create", create_payload)
    shipment = create_resp.get("data", {})
    created_code = shipment.get("shipment_code", shipment_code)
    print(f"    Shipment ready: {created_code}")

    print("[2/5] Ingesting CRITICAL telemetry...")
    telemetry_payload = {
        "shipment_id": created_code,
        "recorded_at": _now_iso(),
        # Keep inside threshold so status stays CRITICAL (not ALERT).
        "temp_c": args.telemetry_temp,
        "temp_min_threshold": args.temp_min,
        "temp_max_threshold": args.temp_max,
        "lat": args.lat,
        "lng": args.lng,
        "status": "CRITICAL",
        "sensor_id": args.sensor_id,
        "medication_name": args.medication_name,
        "is_simulated": True,
        "source": "demo-script",
    }
    telemetry_resp = _http_json("POST", f"{base}/telemetry/ingest", telemetry_payload)
    reading = telemetry_resp.get("data", {})
    reading_id = reading.get("reading_id")
    print(f"    Telemetry reading: {reading_id} status={reading.get('status')}")

    print("[3/5] Waiting for Sentinel and downstream agents...")
    deadline = time.time() + args.max_wait_seconds
    matched_ticket: dict | None = None

    while time.time() < deadline:
        try:
            ticket_resp = _http_json("GET", f"{base}/strategist/tickets/latest")
            ticket = ticket_resp.get("data", {})
            if ticket and ticket.get("reading_id") == reading_id:
                matched_ticket = ticket
                break
        except RuntimeError as exc:
            if "HTTP 404" not in str(exc):
                print(f"    Poll warning: {exc}")

        time.sleep(args.poll_interval_seconds)

    if matched_ticket:
        print("    Agentic chain completed for this reading.")
        print(
            "    Ticket summary: "
            f"ticket_id={matched_ticket.get('ticket_id')} "
            f"status={matched_ticket.get('status')} "
            f"recommended_route={matched_ticket.get('recommended_route_id')}"
        )
    else:
        print("    Timeout waiting for matching ticket. Sentinel may still be processing.")

    twilio_sid = None
    if args.force_demo_call:
        print("[4/5] Triggering guaranteed demo Twilio call endpoint...")
        endpoint = f"{base}/shipments/demo-critical-call"
        if args.call_number:
            query = urllib.parse.urlencode({"to_number": args.call_number})
            endpoint = f"{endpoint}?{query}"

        call_resp = _http_json("POST", endpoint, None)
        call_data = call_resp.get("data", {})
        twilio_sid = call_data.get("twilio_execution_sid")
        print(f"    Demo call triggered: sid={twilio_sid} to={call_data.get('to')}")
    else:
        print("[4/5] Skipping explicit demo call trigger (real anomaly path only).")

    print("[5/5] Done.")
    print("    Next checks:")
    print("    - Confirm phone rang or Twilio execution SID exists")
    print("    - Review /api/v1/strategist/tickets/latest in Swagger")

    if matched_ticket or twilio_sid:
        return 0
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run end-to-end PharmaGuard demo flow.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/api/v1", help="Backend API base URL.")
    parser.add_argument("--shipment-code", default=None, help="Optional fixed shipment code.")

    parser.add_argument("--sensor-id", default="ONASSET-9001")
    parser.add_argument("--medication-name", default="Humira")
    parser.add_argument("--lot-number", default="LOT-AB12")

    parser.add_argument("--origin", default="USNYC")
    parser.add_argument("--destination", default="GBLHR")

    parser.add_argument("--temp-min", type=float, default=2.0)
    parser.add_argument("--temp-max", type=float, default=8.0)
    parser.add_argument("--humidity-min", type=float, default=35.0)
    parser.add_argument("--humidity-max", type=float, default=60.0)

    parser.add_argument("--telemetry-temp", type=float, default=5.0, help="Keep within min/max to preserve CRITICAL status.")
    parser.add_argument("--lat", type=float, default=40.7128)
    parser.add_argument("--lng", type=float, default=-74.0060)

    parser.add_argument("--max-wait-seconds", type=int, default=50)
    parser.add_argument("--poll-interval-seconds", type=int, default=5)

    parser.add_argument(
        "--force-demo-call",
        action="store_true",
        help="Also call /shipments/demo-critical-call for guaranteed ring during demos.",
    )
    parser.add_argument("--call-number", default=None, help="Optional override destination for demo call endpoint.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return run_demo(args)
    except Exception as exc:  # noqa: BLE001
        print(f"Demo failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
