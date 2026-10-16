import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app
from app import planner
from app.config import ZONE_BY_ID, DEFAULT_POLICY
from app.optimization.fairness_debt import update_state

c = TestClient(app)


def day1(plan):
    return {a["zone_id"]: a for a in plan["allocations"] if a["day"] == 0}


def test_protected_minimums_met_when_feasible():
    p = planner.run_plan({}, explain=False)
    assert p["kpis"]["protected_violation_mld"] == 0
    assert p["kpis"]["solver_status"] == "Optimal"


def test_hospital_never_cut_below_floor_in_drought():
    p = planner.run_plan({"storage_factor": 0.5, "inflow_factor": 0.0}, explain=False)
    assert day1(p)[9]["satisfaction"] >= 0.94


def test_infeasible_supply_reports_violation_not_crash():
    p = planner.run_plan({"storage_override_mcm": 0.2}, explain=False)
    assert p["kpis"]["protected_violation_mld"] > 0
    assert p["twin"]["feasible_and_safe"] is False


def test_fairness_debt_protects_repeatedly_rationed_zone():
    prm = {"storage_factor": 0.6, "inflow_factor": 0.0}
    base = day1(planner.run_plan(prm, explain=False))[1]["satisfaction"]
    st = {1: {"debt": 3.0, "consecutive": 2}}
    with_debt = day1(planner.run_plan({**prm, "state": st}, explain=False))[1]["satisfaction"]
    assert with_debt >= base


def test_fairness_debt_update_formula():
    pol = DEFAULT_POLICY
    new = update_state({1: {"debt": 1.0, "consecutive": 1}}, {i: 10 for i in ZONE_BY_ID}, {i: 20 for i in ZONE_BY_ID}, pol)
    assert abs(new[1]["debt"] - (0.8 * 1.0 + 3.0 * (0.95 - 0.5))) < 1e-6 and new[1]["consecutive"] == 2


def test_api_endpoints():
    assert c.get("/health").json()["status"] == "ok"
    assert len(c.get("/zones").json()) == 11
    f = c.post("/forecast/run", json={"horizon": 7}).json()
    assert len(f["demand"]) == 11 * 7
    assert all(r["lower"] <= r["predicted"] <= r["upper"] for r in f["demand"])
    assert len(c.post("/scenarios/compare", json={}).json()) == 5
