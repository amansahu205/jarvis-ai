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
