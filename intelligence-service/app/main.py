"""JalNiti AI intelligence service (FastAPI): forecasting, optimisation, simulation, explanations."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from . import data, planner
from .config import ZONES, DEFAULT_POLICY, RESERVOIR
from .api.schemas import PlanParams, CompareRequest, FairnessUpdate, EvalRequest
from .forecasting import demand_model
from .optimization.fairness_debt import update_state
from .simulation import scenario_runner as sr

@asynccontextmanager
async def lifespan(_app):
    data.build_all(); demand_model.train()
    yield


app = FastAPI(title="JalNiti AI Intelligence Service", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_eval_cache = {}

PRESET_SCENARIOS = [
    ("Normal", {}),
    ("Heatwave (+12% demand)", {"demand_growth": 0.12, "temp_offset": 4}),
    ("Delayed NE monsoon (no inflow)", {"inflow_factor": 0.0, "demand_growth": 0.05}),
    ("Pipe outage (Velachery route at 40%)", {"outages": {6: 0.4}}),
    ("Severe drought (storage -30%)", {"storage_factor": 0.7, "inflow_factor": 0.0, "demand_growth": 0.08}),
]


@app.get("/health")
def health():
    return {"status": "ok", "service": "jalniti-intelligence", "data_source": planner.reservoir_status()["source"]}


@app.get("/zones")
def zones():
    return ZONES


@app.get("/policy/defaults")
def policy_defaults():
    return DEFAULT_POLICY


@app.get("/reservoir/status")
def reservoir_status():
    return planner.reservoir_status()


@app.get("/forecast/metrics")
def forecast_metrics():
    return demand_model.metrics()


@app.post("/forecast/run")
def forecast_run(p: PlanParams = PlanParams()):
    inp = planner.build_inputs(p.model_dump(exclude_none=True))
    return {"horizon": inp["horizon"], "demand": inp["forecast"], "inflow": inp["inflow_meta"], "metrics": demand_model.metrics(),
            "mean_uncertainty": inp["mean_uncertainty"], "reserve_mcm": inp["reserve_mcm"]}


@app.post("/optimize/run")
def optimize_run(p: PlanParams = PlanParams()):
    return planner.run_plan(p.model_dump(exclude_none=True), explain=True)


@app.get("/scenarios/presets")
def presets():
    return [{"name": n, "params": q} for n, q in PRESET_SCENARIOS]


@app.post("/scenarios/compare")
def compare(req: CompareRequest):
    base = req.base.model_dump(exclude_none=True)
    items = [(s.name, s.params.model_dump(exclude_none=True)) for s in req.scenarios] if req.scenarios else [(n, {**base, **q}) for n, q in PRESET_SCENARIOS]
    out = []
    for name, prm in items:
        r = planner.run_plan(prm, explain=False)
        out.append({"name": name, "kpis": r["kpis"], "twin_ok": r["twin"]["feasible_and_safe"],
                    "day1": [{"zone_code": a["zone_code"], "zone_name": a["zone_name"], "satisfaction": a["satisfaction"], "stage": a["ration_stage"]}
                             for a in r["allocations"] if a["day"] == 0]})
    return out


@app.post("/fairness/update")
def fairness_update(req: FairnessUpdate):
    pol = {**DEFAULT_POLICY, **(req.policy or {})}
    return update_state(req.state, req.delivered, req.demand, pol)


@app.get("/evaluate/presets")
def eval_presets():
    return {k: v["label"] for k, v in sr.PRESETS.items()}


@app.post("/evaluate/run")
def evaluate(req: EvalRequest):
    if req.preset not in sr.PRESETS:
        raise HTTPException(400, "unknown preset")
    k = (req.preset, req.days)
    if k not in _eval_cache:
        _eval_cache[k] = {"preset": req.preset, "label": sr.PRESETS[req.preset]["label"], "results": sr.evaluate(req.preset, req.days),
                          "note": "Simulated stress test on synthetic/illustrative data: validates optimiser behaviour, not real-world accuracy."}
    return _eval_cache[k]
