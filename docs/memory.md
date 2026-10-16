# JalNiti AI — Memory Log

> This file tracks what has been completed, what is in progress, and which files are actively being worked on.
> Update this file after every significant change session.

---

## Last Updated
**2026-10-17** — UI cleanup session

---

## ✅ Completed Work

### Infrastructure
- Docker Compose setup with 3 services: frontend, backend, intelligence-service
- PostgreSQL schema: `demand_zone`, `reservoir`, `reservoir_reading`, `optimization_run`, `allocation_decision`, `fairness_state`, `policy_rule`, `audit_log`, `forecast_run`, `demand_forecast`
- Seeding pipeline: intelligence service populates DB on first boot if empty

### Backend (Node.js)
- JWT authentication with role-based access (viewer / operator / admin)
- All REST routes in `backend/src/routes/index.js`
- Reservoir service: seed, addReading, status
- Demand service: CSV import
- Optimization service: run plan, list, get, currentPolicy
- Approval service: decide (approve/reject with overrides)
- Audit service: log all changes

### Intelligence Service (Python)
- Synthetic data generator for Chennai (reservoir, weather, demand) — `data.py`
- GBR quantile demand forecast model — `forecasting/demand_model.py`
- Inflow forecast model — `forecasting/inflow_model.py`
- Multi-objective LP allocation — `optimization/allocation_model.py`
- Fairness debt update rule — `optimization/fairness_debt.py`
- Digital twin water balance simulator — `simulation/digital_twin.py`
- Scenario runner (5 presets + custom) — `simulation/scenario_runner.py`
- Reason codes + counterfactuals — `explainability/`
- FastAPI routes in `main.py`

### Frontend Pages
- Login page
- Dashboard (KPIs, allocation map, reservoir chart)
- Reservoir monitor (chart + KPIs)
- Demand Zones table
- Optimization Run (generate + approve plan)
- Scenario Lab (preset + custom scenarios)
- Fairness Audit (debt table, sector breakdown, override history)
- Policy Settings
- Evaluation / stress test

### Documentation (just added)
- `docs/PRD.md` — Product requirements
- `docs/Architecture.md` — App flow, folder structure, tech stack
- `docs/Rules.md` — What to use/avoid, error handling, guardrails
- `docs/Phases.md` — Project breakdown into phases
- `docs/Design.md` — Colours, typography, layout
- `docs/memory.md` — This file

---

## 🔄 Recently Changed (2026-10-17 session)

### Files Modified
| File | Change |
|------|--------|
| `frontend/src/pages/Dashboard.jsx` | Removed stale-data-alert popup |
| `frontend/src/pages/Reservoir.jsx` | Removed manual upload form; added auto-data info message |
| `frontend/src/pages/DemandZones.jsx` | Removed Demand Forecast card entirely |
| `frontend/src/pages/ScenarioLab.jsx` | Auto-fetch scenarios on page load (useEffect); relabelled button |
| `frontend/src/pages/FairnessAudit.jsx` | Removed empty recharts bar chart; added KPI summary row |

---

## 🔲 Pending / Next Steps

### High Priority
- [ ] Connect real India-WRIS / Google Sheets reservoir data feed (replace synthetic)
- [ ] Backend: add `/api/reservoirs/1/refresh` endpoint to pull latest data automatically
- [ ] Auto-refresh reservoir readings on a schedule (node-cron or similar)

### Medium Priority
- [ ] Better empty states: Fairness Audit with no approved plans
- [ ] Scenario Lab: show preset scenario names instead of "Your custom scenario"
- [ ] Mobile responsive fixes

### Low Priority
- [ ] PDF export of allocation plan
- [ ] Email alerts for pending approval
- [ ] Public transparency view (read-only, no login)

---

## 📁 Currently Active Files

> No files are currently being edited.

---

## 🗂 File Index (Key Files)

| File | Purpose |
|------|---------|
| `frontend/src/App.jsx` | Route definitions |
| `frontend/src/components/ui.jsx` | Shared components (Card, Kpi, Loading, Msg, useAsync...) |
| `frontend/src/services/api.js` | HTTP client + auth helpers |
| `frontend/src/styles.css` | Global CSS |
| `backend/src/routes/index.js` | All API routes |
| `backend/src/services/reservoir.service.js` | Reservoir DB logic |
| `backend/src/services/optimization.service.js` | Plan generation |
| `intelligence-service/app/config.py` | Zones, reservoir constants, default policy |
| `intelligence-service/app/data.py` | Data loading and synthetic generation |
| `intelligence-service/app/planner.py` | Core planning orchestration |
| `intelligence-service/app/main.py` | FastAPI app and routes |
| `backend/db/schema.sql` | Database schema |
