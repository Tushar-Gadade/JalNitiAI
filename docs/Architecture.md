# JalNiti AI — Architecture

## 1. System Overview

```
┌─────────────────────────────────────────────┐
│              User's Browser                  │
│         React + Vite SPA (port 5173)        │
└──────────────────┬──────────────────────────┘
                   │ HTTP / REST
┌──────────────────▼──────────────────────────┐
│         Node.js / Express Backend            │
│              API (port 3000)                 │
│   Auth (JWT) · Routes · Audit logs          │
└──────┬────────────────────┬─────────────────┘
       │ pg                 │ HTTP
┌──────▼──────┐    ┌────────▼────────────────┐
│ PostgreSQL  │    │  Python FastAPI Service  │
│  (port 5432)│    │  Intelligence (port 8000)│
│             │    │  Forecasting · Optimizer │
│  All state  │    │  Scenarios · Explainer  │
└─────────────┘    └─────────────────────────┘
```

---

## 2. App Flow

```
User opens dashboard
  → Frontend fetches /api/reservoirs/1/status  →  Backend queries DB
  → Frontend fetches /api/optimization          →  Backend queries DB
  
Operator clicks "Generate today's plan"
  → POST /api/optimization/run
    → Backend calls Intelligence: POST /optimize/run
      → Python reads reservoir status + zone data
      → Runs multi-objective LP (PuLP / CVXPY)
      → Generates AI explanation for each zone
      → Returns allocations + KPIs + twin check
    → Backend persists result in PostgreSQL
    → Returns plan to frontend

Operator approves plan
  → POST /api/optimization/:id/approve
    → Backend updates status to 'approved'
    → Updates fairness_state (debt, consecutive days)
    → Audit log entry recorded
```

---

## 3. Folder & File Structure

```
jalniti-ai/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── App.jsx              # Router setup
│   │   ├── main.jsx             # Entry point
│   │   ├── styles.css           # Global styles
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Sidebar + top nav
│   │   │   └── ui.jsx           # Shared UI primitives (Card, Kpi, Loading, Msg...)
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # /  — Command dashboard
│   │   │   ├── Reservoir.jsx    # /reservoir — Storage monitor
│   │   │   ├── DemandZones.jsx  # /zones — Zone table
│   │   │   ├── OptimizationRun.jsx  # /optimization — Plan generator
│   │   │   ├── ScenarioLab.jsx  # /scenarios — What-if analysis
│   │   │   ├── FairnessAudit.jsx    # /fairness — Equity tracking
│   │   │   ├── PolicySettings.jsx   # /policy — Tune parameters
│   │   │   ├── Evaluation.jsx       # /evaluation — Stress tests
│   │   │   └── Login.jsx            # /login
│   │   └── services/
│   │       └── api.js           # Fetch wrapper + auth helpers
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                     # Node.js API
│   ├── src/
│   │   ├── app.js               # Express app setup
│   │   ├── server.js            # HTTP server entry
│   │   ├── db.js                # PostgreSQL pool
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT middleware
│   │   ├── routes/
│   │   │   └── index.js         # All API routes
│   │   └── services/
│   │       ├── ai.service.js    # HTTP client → Intelligence service
│   │       ├── reservoir.service.js  # Reservoir DB operations
│   │       ├── demand.service.js     # CSV import, demand readings
│   │       ├── optimization.service.js  # Plan generation + approval
│   │       ├── approval.service.js      # Plan approval workflow
│   │       └── audit.service.js         # Audit log
│   ├── db/
│   │   └── schema.sql           # Database schema
│   └── package.json
│
├── intelligence-service/        # Python FastAPI
│   ├── app/
│   │   ├── main.py              # FastAPI routes
│   │   ├── config.py            # Zones, reservoir, policy defaults
│   │   ├── data.py              # Data loading (real CSV or synthetic)
│   │   ├── planner.py           # Core planning logic
│   │   ├── api/schemas.py       # Pydantic request/response models
│   │   ├── forecasting/
│   │   │   ├── demand_model.py  # GBR quantile demand forecast
│   │   │   └── inflow_model.py  # Reservoir inflow forecast
│   │   ├── optimization/
│   │   │   ├── allocation_model.py  # Multi-objective LP
│   │   │   ├── fairness_debt.py     # Fairness debt update
│   │   │   └── objectives.py        # Objective function components
│   │   ├── simulation/
│   │   │   ├── digital_twin.py      # Water balance simulator
│   │   │   └── scenario_runner.py   # Stress test runner
│   │   └── explainability/
│   │       ├── reason_codes.py      # Rule-based explanation codes
│   │       └── counterfactuals.py   # What-if explanation
│   └── requirements.txt
│
├── data/
│   ├── raw/                     # Real data CSVs (place here)
│   │   ├── reservoir_real.csv   # date, storage_mcm [, inflow_mcm]
│   │   ├── weather_real.csv     # date, temp_c, rain_mm
│   │   └── demand_real.csv      # date, zone_id, demand_mld
│   ├── processed/               # Auto-generated, do not edit
│   └── scenarios/
│       └── presets.json
│
├── models/
│   └── demand_gbr.joblib        # Trained GBR model
│
├── docs/                        # Project documentation
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Rules.md
│   ├── Phases.md
│   ├── Design.md
│   └── memory.md
│
├── docker-compose.yml
└── README.md
```

---

## 4. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite | Fast dev, SPA, easy routing |
| Routing | React Router v6 | Client-side navigation |
| Charts | Recharts | Composable, React-native charts |
| Styling | Vanilla CSS (styles.css) | No framework overhead |
| Backend | Node.js + Express | Thin API layer over DB |
| Auth | JWT (jsonwebtoken) | Stateless, role-based |
| Database | PostgreSQL | Relational, ACID, audit trails |
| AI Service | Python 3.11 + FastAPI | Scientific stack (numpy, pandas, scikit-learn, PuLP) |
| Optimization | PuLP (LP solver) | Multi-objective linear programming |
| Forecasting | scikit-learn GBR + Quantile Regression | Demand forecasting with uncertainty bands |
| Containerization | Docker Compose | Local dev + deployment |

---

## 5. Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate user, get JWT |
| GET | `/api/reservoirs/1/status` | Reservoir KPIs + history |
| GET | `/api/zones` | All demand zones |
| POST | `/api/optimization/run` | Generate allocation plan |
| GET | `/api/optimization/:id` | Get plan details |
| POST | `/api/optimization/:id/approve` | Approve/reject plan |
| POST | `/api/scenarios/compare` | Run scenario comparison |
| GET | `/api/fairness/audit` | Fairness debt + history |
| GET | `/api/policies` | Current policy params |
| PUT | `/api/policies/:id` | Update policy |
