# JalNiti AI (जलनीती): Risk-Aware and Fair Water Distribution

Explainable decision-support for allocating reservoir water under scarcity. Case study: **Chennai, Tamil Nadu**
(the Poondi, Cholavaram, Red Hills and Chembarambakkam lake system serving 8 residential zones, a hospital cluster, essential and non-essential industry).

**Novelty:** fairness debt (the system remembers who was rationed), protected service floors, a dry/expected/wet
scenario reserve, a graceful rationing ladder, counterfactual explanations, digital-twin validation and human approval.

## Architecture
| Folder | Tech | Role |
|---|---|---|
| `intelligence-service/` | Python 3.12, FastAPI, scikit-learn, PuLP + CBC | Forecasting (seasonal-naive, Ridge, gradient boosting with 10/90 quantile intervals), scenario LP optimiser, fairness debt, digital twin, explanations, rolling-horizon simulator |
| `backend/` | Node 20+, Express, PostgreSQL (`pg`) | Auth (JWT, roles), CRUD, orchestration, approval workflow, audit log |
| `frontend/` | React 18 + Vite + Recharts | Government-of-India-style UI (GIGW-inspired: skip link, text-size controls, high-contrast mode, tricolour accent) |
| `data/` | CSV | `raw/` (real files you add), `processed/` (generated), `scenarios/` |
| `research/` | Python | `run_experiments.py` reproduces the baseline + ablation tables |

## Quick start (Docker, recommended)
```bash
docker compose up --build
# the first start trains the forecasting model (about 30 s). Then open:
#   UI        http://localhost:8080
#   API       http://localhost:4000/api/health
#   AI docs   http://localhost:8000/docs
```
Sign in: operator `operator` / `Jalniti@2026`, administrator `admin` / `Admin@2026`
(override with `OPERATOR_PASS`, `ADMIN_PASS`, `JWT_SECRET`; demo credentials only).

## Manual start (no Docker)
Prerequisites: Python 3.11+, Node 20+, PostgreSQL 14+.
```bash
# 0) database
createuser -P jalniti            # password: jalniti
createdb -O jalniti jalniti

# 1) AI service (terminal 1)
cd intelligence-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000

# 2) backend (terminal 2)
cd backend && cp .env.example .env && npm install && npm start

# 3) frontend (terminal 3)
cd frontend && npm install && npm run dev               # http://localhost:5173
```
The backend creates the tables (`backend/db/schema.sql`) and seeds zones, policy and 60 days of readings on first start.
Keep `pulp==2.9.0`: PuLP 4.x changed its API and bundles a different solver.

## Using it
1. **Allocation Plan**: click *Run optimiser*. Review KPIs, digital-twin checks, per-zone reasons and counterfactuals.
2. Optionally override day-1 amounts (protected zones need a written reason), then **Approve**. Approval updates fairness debt.
3. Run again: zones rationed earlier are now protected (see **Fairness Audit**).
4. **Scenario Lab** compares custom and preset scenarios; **Evaluation** runs the baseline + ablation experiment.

## Real data (Kaggle + government sources)
The environment this project was built in could not reach Kaggle or government websites, so the bundled data is
**synthetic and labelled `SIMULATED`** (rule-based, fixed seed). To use real data:
* Reservoir storage: Chennai has the best public record of any Indian city. Sources: the Kaggle dataset "Chennai Water Management"
  (daily levels and rainfall for Poondi, Cholavaram, Red Hills and Chembarambakkam, 2004 to 2019), CMWSSB daily lake-level
  bulletins (`https://chennaimetrowater.tn.gov.in`), India-WRIS (`https://indiawris.gov.in`), CWC bulletins
  (`https://cwc.gov.in/en/reservoir-monitoring`) and `https://data.gov.in`. The Kaggle file reports each lake in mcft, so sum the four lakes first.
* Weather: IMD Chennai (Nungambakkam / Meenambakkam) from `https://mausam.imd.gov.in`, or the rainfall columns in the same Kaggle dataset.
  Note that Chennai's main rain is the **north-east monsoon (Oct to Dec)**, not June to September.
* Demand: CMWSSB (Metrowater) zone-wise supply figures (usually needs an RTI or a formal request). Otherwise keep simulated demand and say so in your report.
```bash
python scripts/prepare_real_data.py reservoir  my_reservoir.csv --date-col Date --storage-col "Live Storage"
python scripts/prepare_real_data.py weather    my_weather.csv   --date-col Date --temp-col Tmax --rain-col Rainfall
rm data/processed/*.csv intelligence-service/models/*.joblib    # then restart the AI service
```
Convert units to MCM first (1 TMC = 28.317 MCM, 1 mcft = 0.0283 MCM). Do not report accuracy on simulated demand as real-world accuracy.

## Tests and experiments
```bash
cd intelligence-service && pytest -q          # 6 tests: floors, infeasible handling, fairness debt, API
cd .. && python research/run_experiments.py    # baselines + ablation -> research/results/summary.csv
```

## Main API (Node, `/api`, Bearer token)
`POST /auth/login` | `POST /reservoir-readings` | `GET /reservoirs/:id/status` | `GET /zones` | `POST /demand-readings/import` (text/csv)
| `POST /forecasts/run` | `POST /optimization/run` | `GET /optimization/:id` | `GET /optimization/:id/explanations` | `POST /optimization/:id/approve`
| `POST /scenarios/compare` | `GET /fairness/audit` | `GET|PUT /policies/:id` (admin) | `GET /audit-logs` | `POST /evaluation/run`

## Model summary
* Variables: `x[i,t]` (water per zone and day), shortage and storage per scenario, reserve slack, protected-minimum slack.
* Water balance per scenario: `storage[t] = storage[t-1] + inflow[t,s] - sum(x[i,t] / (1 - loss_i))`.
* Objective tiers: protected violation >> consecutive-rationing breach >> weighted shortage
  (priority x vulnerability x criticality x (1 + lambda x debt)) > inequity (min-max ratio) > reserve risk > delivery cost.
* Fairness debt: `debt' = alpha x debt + beta x max(0, target ratio - delivered ratio)`.
* Rationing ladder from the satisfaction ratio: normal, advisory, mild, time-window, severe, emergency minimum.

## Known limits (state these in your report)
* Demand, zone populations and the city share of reservoir storage are illustrative; calibrate with CMWSSB / TWAD data.
* LP, not MILP: pump and time-window scheduling, and consecutive-cut limits beyond day 1, are handled by daily re-optimisation.
  Pipe hydraulics (EPANET/WNTR) is a stretch goal.
* Inflow uses historical percentiles rather than a trained model (deliberate: a weak inflow model should not be oversold).
* Not an official government system. Advisory only; human approval is required.
