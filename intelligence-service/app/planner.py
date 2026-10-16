"""Orchestration: forecasts -> scenarios -> optimiser -> digital twin -> explanations."""
import copy
import numpy as np
from .config import ZONES, ZONE_BY_ID, RESERVOIR, DEFAULT_POLICY, ML_TO_MCM, CLASS_OF
from . import data
from .forecasting import demand_model
from .forecasting.inflow_model import inflow_scenarios
from .optimization.allocation_model import solve_plan, gini
from .optimization.objectives import ration_stage
from .simulation.digital_twin import validate
from .explainability.reason_codes import explain_row
from .explainability import counterfactuals

_fc_cache = {}


def cached_forecast(horizon, temp_offset=0.0):
    k = (horizon, temp_offset)
    if k not in _fc_cache:
        _fc_cache[k] = demand_model.forecast(horizon, temp_offset)
    return _fc_cache[k]


def reservoir_status():
    r = data.load("reservoir")
    last = r.iloc[-1]
    cap, share = RESERVOIR["capacity_mcm"], RESERVOIR["city_share"]
    hist = r.tail(60)
    return dict(reservoir=RESERVOIR, as_of=str(last["date"].date()), storage_mcm=float(last["storage_mcm"]),
                fill_pct=round(float(last["storage_mcm"]) / cap * 100, 1), city_allocable_mcm=round(float(last["storage_mcm"]) * share, 3),
                inflow_mcm=float(last["inflow_mcm"]), source=str(last["source"]), quality_flag=str(last["quality_flag"]),
                history=[dict(date=str(d.date()), storage_mcm=float(s), inflow_mcm=float(i)) for d, s, i in zip(hist["date"], hist["storage_mcm"], hist["inflow_mcm"])])


def build_inputs(params):
    H = int(params.get("horizon", DEFAULT_POLICY["horizon_days"]))
    pol = {**DEFAULT_POLICY, **(params.get("policy") or {})}
    growth = float(params.get("demand_growth", 0.0))
    fc = cached_forecast(H, float(params.get("temp_offset", 0.0)))
    zones = copy.deepcopy(ZONES)
    demand = {s: {z["id"]: [0.0] * H for z in zones} for s in ("dry", "expected", "wet")}
    unc = []
    for r in fc:
        i, t = r["zone_id"], r["day"]
        g = 1 + growth
        demand["dry"][i][t], demand["expected"][i][t], demand["wet"][i][t] = r["upper"] * g, r["predicted"] * g, r["lower"] * g
        unc.append(r["uncertainty"])
    inf = inflow_scenarios(H)
    share = RESERVOIR["city_share"]
    factor = float(params.get("inflow_factor", 1.0))
    inflow = {s: [v * share * factor for v in vals] for s, vals in inf["scenarios_mcm_per_day"].items()}
    st = reservoir_status()
    storage0 = float(params["storage_override_mcm"]) if params.get("storage_override_mcm") is not None else st["city_allocable_mcm"]
    storage0 *= float(params.get("storage_factor", 1.0))
    reserve_days = float(params.get("reserve_days", pol["reserve_days"]))
    exp_total0 = sum(demand["expected"][z["id"]][0] for z in zones)
    reserve = reserve_days * exp_total0 * ML_TO_MCM * (1 + pol["uncertainty_reserve_gain"] * float(np.mean(unc)))
    state = {int(k): v for k, v in (params.get("state") or {}).items()}
    outages = {int(k): float(v) for k, v in (params.get("outages") or {}).items()}
    return dict(zones=zones, demand=demand, inflow=inflow, storage0=storage0, reserve_mcm=reserve, state=state, policy=pol,
                cap_factor=outages, horizon=H, dates=[r["date"] for r in fc if r["zone_id"] == 1], mean_uncertainty=float(np.mean(unc)),
                inflow_meta=inf, forecast=fc)


def run_plan(params, explain=True):
    inp = build_inputs(params)
    use_f, use_s = params.get("use_fairness", True), params.get("use_scenarios", True)
    kw = dict(inflow=inp["inflow"], storage0=inp["storage0"], reserve_mcm=inp["reserve_mcm"], state=inp["state"], policy=inp["policy"],
              use_fairness=use_f, use_scenarios=use_s, cap_factor=inp["cap_factor"], horizon=inp["horizon"])
    res = solve_plan(inp["zones"], inp["demand"], **kw)
    zones, H, demand = inp["zones"], inp["horizon"], inp["demand"]
    ids = [z["id"] for z in zones]
    # class mean ratios for explanations
    ratios = {i: [min(1.0, res["x"][i][t] / max(demand["expected"][i][t], 1e-9)) for t in range(H)] for i in ids}
    cls_mean = {}
    for t in range(H):
        for c in set(CLASS_OF.values()):
            vals = [ratios[i][t] for i in ids if CLASS_OF[ZONE_BY_ID[i]["type"]] == c]
            cls_mean[c, t] = float(np.mean(vals))
    dry = res["storage"].get("dry", res["storage"]["expected"])
    rows = []
    for z in zones:
        i = z["id"]
        for t in range(H):
            d, a = demand["expected"][i][t], res["x"][i][t]
            n, name = ration_stage(ratios[i][t])
            tight = (dry[t] - inp["reserve_mcm"]) < 0.02
            code, msg = explain_row(z, t, d, a, ratios[i][t], n, cls_mean[CLASS_OF[z["type"]], t], tight, inp["state"])
            rows.append(dict(zone_id=i, zone_code=z["code"], zone_name=z["name"], zone_type=z["type"], day=t, date=inp["dates"][t],
                             demand_mld=round(d, 2), demand_low=round(demand["wet"][i][t], 2), demand_high=round(demand["dry"][i][t], 2),
                             allocated_mld=round(a, 2), shortage_mld=round(max(0, d - a), 2), satisfaction=round(ratios[i][t], 4),
                             ration_stage=n, ration_level=name, reason_code=code, explanation=msg,
                             fairness_debt=inp["state"].get(i, {}).get("debt", 0.0)))
    d0 = [r for r in rows if r["day"] == 0]
    tot_d = sum(r["demand_mld"] for r in rows); tot_s = sum(r["shortage_mld"] for r in rows)
    res_r = [r["satisfaction"] for r in d0 if r["zone_type"] == "residential"]
    sys_ratio = sum(r["allocated_mld"] for r in d0) / max(sum(r["demand_mld"] for r in d0), 1e-9)
    daily_draw = sum(r["allocated_mld"] / (1 - ZONE_BY_ID[r["zone_id"]]["loss"]) for r in d0) * ML_TO_MCM
    twin = validate(zones, res["x"], demand, inp["inflow"], inp["storage0"], inp["reserve_mcm"], inp["state"], inp["policy"], inp["cap_factor"])
    kpis = dict(total_unmet_pct=round(tot_s / tot_d * 100, 2), protected_violation_mld=round(sum(sum(v) for v in res["violation"].values()), 3),
                worst_zone_ratio_day1=round(min(r["satisfaction"] for r in d0), 3), residential_gini_day1=round(gini(res_r), 4),
                min_dry_storage_mcm=round(min(dry), 4), reserve_mcm=round(inp["reserve_mcm"], 4), reserve_shortfall_mcm=round(max(res["reserve_slack"].get("dry", res["reserve_slack"]["expected"])), 4),
                scarcity_stage=ration_stage(sys_ratio)[0], scarcity_stage_name=ration_stage(sys_ratio)[1], system_supply_ratio_day1=round(sys_ratio, 4),
                days_of_safe_supply=round(inp["storage0"] / daily_draw, 1) if daily_draw else None, storage0_mcm=round(inp["storage0"], 3),
                mean_forecast_uncertainty=round(inp["mean_uncertainty"], 4), solver_status=res["status"], runtime_s=res["runtime_s"])
    out = dict(params={k: v for k, v in params.items() if k != "state"}, horizon=H, dates=inp["dates"], allocations=rows, kpis=kpis, twin=twin,
               storage_paths=res["storage"], inflow_mcm=inp["inflow"], model_version="jalniti-lp-1.0", policy=inp["policy"])
    if explain:
        out["counterfactuals"] = counterfactuals.build(zones, res, dict(kw, horizon=H), demand)
    return out
