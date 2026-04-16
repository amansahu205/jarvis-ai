# Reproducibility and Usage Draft

Use this draft to build the final PDF (maximum 5 pages).

## 1. Project Overview

PharmaGuard AI is an agentic cold-chain monitoring and route compliance platform. It supports telemetry-driven risk detection, route planning, and geospatial compliance checks.

## 2. System Requirements

- OS: Windows, macOS, or Linux
- Python: Project virtual environment in backend/.venv
- Node.js and pnpm for frontend
- PostgreSQL or Supabase connection for backend APIs
- Environment variables configured in .env files

## 3. Repository Structure

- backend: API services, strategist and risk logic, database integrations
- frontend: ReguMap and dashboard experience
- data: source and synthetic datasets used by the solution

## 4. Setup Steps

### Backend

1. Open terminal in backend
2. Activate virtual environment
3. Install dependencies
4. Start API server

Suggested commands:

- Windows PowerShell:
  - .venv/Scripts/Activate.ps1
  - python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

### Frontend

1. Open terminal in frontend
2. Install dependencies
3. Start development server

Suggested commands:

- pnpm install
- pnpm dev

## 5. Usage Workflow

1. Open the frontend app in browser
2. Navigate to ReguMap
3. Select origin, destination, transit mode, and cargo type
4. Run route analysis
5. Review route alternatives and compliance timeline
6. Validate route risk and weather-informed visualization

## 6. Dataset Notes

- Dataset type: Real and synthetic mixed
- Source files: data directory and backend scripts
- Any synthetic or LLM-generated data should be documented with generation intent and constraints

## 7. Evaluation Notes

- Include what works fully and what is partially implemented
- Include observed runtime constraints and known risks
- Include representative screenshots or tables in the final PDF

## 8. Troubleshooting

- If frontend shows loading only, verify backend is running and reachable
- If API calls fail, validate environment variables and database connectivity
- If route options are limited, verify dataset coverage and route waypoint availability

## 9. Reproduction Verification Checklist

- Fresh clone setup tested
- Backend starts successfully
- Frontend starts successfully
- Core demo workflow reproducible
- Demo outputs match documented behavior

## 10. Business Impact and Project Feasibility (Judging Criteria Coverage)

### 10.1 Criterion 1: Estimated Timeline and Cost (Real Deployment)

Assumptions for a mid-size pharma distributor:
- 8,000 temperature-sensitive shipments/month
- Multi-region operations with mixed air and maritime lanes
- Existing telemetry feed from OnAsset and existing TMS/ERP stack

Estimated rollout plan:
- Phase 1 (Weeks 1-4): integration foundation
  - Integrate telemetry ingestion, shipment context normalization, baseline anomaly detection
  - Deliverables: data contracts, observability baseline, first Sentinel alerts
- Phase 2 (Weeks 5-8): agentic decision workflow
  - Strategist routing, compliance checks, Diplomat briefing, human approval workflow
  - Deliverables: route recommendations, compliance timeline, approval controls
- Phase 3 (Weeks 9-12): operational automation and hardening
  - Twilio escalation, downstream notifications, audit pack generation, pilot KPIs
  - Deliverables: production pilot in one business lane with weekly KPI reviews

Estimated implementation cost (12-week pilot):
- Engineering and integration: $180,000 to $260,000
- Cloud and infra (dev + pilot): $12,000 to $28,000
- LLM/vector/API usage: $8,000 to $22,000
- QA/compliance validation and change management: $25,000 to $45,000
- Total pilot estimate: $225,000 to $355,000

Estimated monthly run cost after pilot:
- Platform + storage + monitoring: $6,000 to $14,000
- Model/API usage: $4,000 to $16,000
- Support/on-call + maintenance allocation: $8,000 to $18,000
- Total monthly run estimate: $18,000 to $48,000

### 10.2 Criterion 2: Clear ROI and Expected Outcomes

Current business pain (baseline assumptions):
- Annual cold-chain loss and disruption cost: $1.8M to $3.5M
- Average response time from anomaly to decision: 60 to 180 minutes
- Frequent manual coordination across logistics, compliance, and care delivery teams

Target outcomes within first 6 months:
- 25% to 40% reduction in spoilage-related financial loss
- 30% to 50% faster anomaly-to-decision cycle time
- 20% to 35% fewer avoidable route disruptions through earlier interventions
- 50%+ reduction in manual incident compilation time through structured audit logs

Illustrative annual impact model:
- Avoided loss: $450,000 to $1,400,000
- Productivity gains (operations + compliance): $180,000 to $420,000
- Total annual value: $630,000 to $1,820,000
- Against annualized run + support cost of roughly $216,000 to $576,000
- Expected payback period: approximately 4 to 12 months depending on adoption level and shipment volume

### 10.3 Criterion 3: Unintended Consequences and Ripple Effects

Key risks considered and controls:
- False positives trigger unnecessary reroutes and cost inflation
  - Control: confidence thresholds, dual-trigger policy for auto-escalation, mandatory human approval for high-cost reroutes
- Alert fatigue among operators and Responsible Person reviewers
  - Control: severity banding, deduplication windows, escalation throttling, role-specific queues
- Patient care disruption from aggressive rescheduling recommendations
  - Control: downstream recommendations must be advisory-first with explicit confidence and alternatives
- Compliance and accountability risk from opaque model decisions
  - Control: explainable rationale in each agent output, immutable audit logs, replayable decision traces
- Bias or unfair prioritization across geographies or clinics
  - Control: periodic fairness review on intervention distribution, policy overrides, governance board review cadence

### 10.4 Criterion 4: Upstream and Downstream Dependency Map

Upstream dependencies:
- OnAsset sensor telemetry quality (temperature, humidity, shock, geolocation)
- Carrier and schedule feeds (flight/vessel delays, route availability)
- Customs and trade-status signals
- Weather and geopolitical risk data feeds
- Master data quality in shipment, product, and lane reference systems

Core platform dependencies:
- Agent orchestration runtime (Sentinel, Strategist, Compliance Cop, Diplomat)
- Postgres/PostGIS for persistence and geospatial checks
- Compliance knowledge retrieval index
- Identity/role model for human-in-the-loop approvals

Downstream dependencies and business functions impacted:
- Hospital/clinic operations: appointment rescheduling advisories
- Inventory planning: revised ETA and cold-storage demand updates
- Finance and insurance: claim packet initialization and incident evidence export
- Regulatory/compliance teams: GDP/FDA traceability, audit response package generation
- Customer operations: proactive notifications and service recovery workflows

Ownership and accountability model (recommended):
- Logistics control tower: route and carrier actions
- Quality/compliance office: policy gates and regulatory sign-off
- Clinical coordination team: patient-impact communications
- IT/data engineering: feed reliability, monitoring, and incident SLOs
- Program governance lead: KPI review, risk acceptance, and ethical oversight

### 10.5 KPI Scorecard for Pilot and Scale

Pilot KPIs (weekly):
- Mean time from anomaly detection to approved action
- Percentage of critical incidents with recommendation generated in < 10 minutes
- Percentage of escalations with complete audit trail
- Number of prevented spoilage events

Scale KPIs (monthly):
- Spoilage loss rate per 1,000 shipments
- Delay-to-intervention conversion rate
- Alert precision and false-positive rate
- Compliance evidence completeness and audit turnaround time

These sections should be retained in the final PDF to explicitly satisfy competition criteria on feasibility, outcome clarity, risk governance, and enterprise dependency realism.
