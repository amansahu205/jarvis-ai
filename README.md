# PharmaGuard AI

<p align="center">
	<img src="https://capsule-render.vercel.app/api?type=waving&height=220&text=PharmaGuard%20AI&fontAlign=50&fontAlignY=38&color=0:0D1117,40:1E3A8A,70:0EA5E9,100:10B981&fontColor=E6EDF3&desc=Autonomous%20Cold-Chain%20Monitoring%20%7C%20ReguMap%20Spatial%20Compliance&descAlign=50&descAlignY=60&animation=twinkling" alt="PharmaGuard AI Banner" />
</p>

<p align="center">
	<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=18&pause=1200&color=58A6FF&center=true&vCenter=true&width=900&lines=Anomaly+to+approved+reroute+in+under+10+minutes;Spatial+compliance+with+PostGIS+and+jurisdiction-aware+checks;Multi-agent+workflow+with+human-in-the-loop+approval" alt="Typing animation" />
</p>

<p align="center">
	<img src="https://img.shields.io/badge/Challenge-UMD%20Agentic%20AI%202026-1f6feb?style=for-the-badge&logo=openai&logoColor=white" />
	<img src="https://img.shields.io/badge/Backend-FastAPI-059669?style=for-the-badge&logo=fastapi&logoColor=white" />
	<img src="https://img.shields.io/badge/Frontend-Next.js-0D1117?style=for-the-badge&logo=nextdotjs&logoColor=white" />
	<img src="https://img.shields.io/badge/Database-Supabase%20Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=0D1117" />
	<img src="https://img.shields.io/badge/Geospatial-PostGIS-2D6CDF?style=for-the-badge&logo=postgresql&logoColor=white" />
</p>

---

## What This Project Does

PharmaGuard AI is a crisis-response platform for pharmaceutical cold-chain logistics.

It monitors shipment telemetry, detects risk events, generates alternative routes, validates route compliance across jurisdictions, and presents approval-ready options to Responsible Persons before dispatch actions are executed.

Core system outcomes:

- Real-time anomaly detection and escalation
- Route generation for air and maritime transport
- Spatial compliance intelligence powered by geospatial data
- Human-in-the-loop decision control with auditability

---

## Architecture Snapshot

```mermaid
flowchart LR
		A[Telemetry Stream] --> B[Sentinel Agent]
		B --> C[Strategist Agent]
		C --> D[ReguMap APIs]
		D --> E[(Postgres + PostGIS)]
		C --> F[Compliance Timeline]
		C --> G[Diplomat Agent]
		G --> H[Crisis Ticket]
		F --> H
		H --> I[Compliance Cop]
		I --> J[RP Dashboard Approval]
		J --> K[Downstream Dispatch]
```

---

## Repository Structure

```text
jarvis-ai/
├── backend/
│   ├── app/
│   ├── scripts/
│   │   ├── eda_logistics_datasets.py
│   │   ├── etl_logistics_spatial_supabase.py
│   │   └── migrate_logistics_to_supabase.py
│   └── sql/
│       ├── logistics_setup.sql
│       ├── logistics_fk_and_gist.sql
│       ├── logistics_spatial_indexes.sql
│       └── logistics_cleanup.sql
├── frontend/
└── data/
		├── world_airports.csv
		├── UpdatedPub150.csv
		├── airlines.csv
		├── routes.csv
		└── Shipping_Lanes_v1.geojson
```

---

## Data Engineering Workflow

### 1) Run EDA Validation

The EDA script checks:

- Null coordinates in airport and seaport source files
- Latitude/longitude range violations
- Orphaned aviation routes where source or destination IATA is not in airports

Command:

```bash
python backend/scripts/eda_logistics_datasets.py --data-dir "D:/MS/UMD/Courses/Spring-2026/Agentic-AI/jarvis-ai/data"
```

Outputs are written to:

- data/eda_reports/eda_summary.json
- data/eda_reports/airports_null_coordinates.csv
- data/eda_reports/seaports_null_coordinates.csv
- data/eda_reports/airports_invalid_coordinate_ranges.csv
- data/eda_reports/seaports_invalid_coordinate_ranges.csv
- data/eda_reports/routes_orphaned_iata.csv

### 2) Run Spatial ETL into Supabase

ETL script capabilities:

- Ensures PostGIS extension is enabled
- Loads airports and builds geography points
- Loads seaports with mapped names and LOCODE aliases plus geography points
- Builds aviation route geography linestrings from airport coordinates
- Loads maritime lanes from GeoJSON as geography multilinestrings
- Adds/validates foreign key constraints and creates GIST indexes

Command:

```bash
python backend/scripts/etl_logistics_spatial_supabase.py --data-dir "D:/MS/UMD/Courses/Spring-2026/Agentic-AI/jarvis-ai/data"
```

The script reads DATABASE_URL from backend/.env unless passed explicitly.

---

## SQL Toolbelt

Use these SQL files for setup, optimization, and rollback:

- backend/sql/logistics_setup.sql
- backend/sql/logistics_fk_and_gist.sql
- backend/sql/logistics_spatial_indexes.sql
- backend/sql/logistics_cleanup.sql

---

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy
- Pydantic
- Python

### Data & Geospatial

- PostgreSQL (Supabase)
- PostGIS
- GeoPandas
- Shapely
- Pandas

### Frontend

- Next.js
- TypeScript
- Component-driven dashboard architecture

---

## Quick Start

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

---

## Visual Identity

<p align="center">
	<img src="https://capsule-render.vercel.app/api?type=rect&color=0:1E293B,40:0EA5E9,70:10B981,100:1E293B&height=55&section=header&text=Mission-Critical%20Dark-Ops%20UI%20for%20Cold-Chain%20Intelligence&fontSize=18&fontColor=E6EDF3&animation=fadeIn" />
</p>

This project is designed for command-center workflows:

- Fast signal-to-decision UX
- High-contrast, role-specific views
- Geospatial-first compliance context

---

## License

Academic project for UMD Agentic AI Challenge 2026.

