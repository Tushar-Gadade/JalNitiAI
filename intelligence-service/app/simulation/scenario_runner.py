"""Rolling-horizon simulation: plan 7 days ahead, execute day 1 against *actual* demand/inflow, update state, repeat.
Used for baseline comparison and the ablation study (fairness debt, uncertainty scenarios)."""
import numpy as np
from ..config import ZONES, ZONE_BY_ID, DEFAULT_POLICY, ML_TO_MCM, CLASS_OF
from ..optimization.allocation_model import solve_plan, baseline_day, gini
from ..optimization.fairness_debt import update_state
from .. import planner

METHODS = ["fcfs", "fixed_priority", "proportional", "cost_only", "jalniti_no_fairness", "jalniti_no_uncertainty", "jalniti_full"]
LABELS = {"fcfs": "First-come-first-served", "fixed_priority": "Fixed priority", "proportional": "Proportional rationing",
          "cost_only": "Cost-only optimisation", "jalniti_no_fairness": "JalNiti - no fairness debt",
          "jalniti_no_uncertainty": "JalNiti - no uncertainty scenarios", "jalniti_full": "JalNiti AI (full)"}
PRESETS = {  # cover = usable storage as a fraction of the gross water needed to serve ALL demand for the whole run; growth = demand uplift; inflow_true = actual inflow factor vs expected
    "normal":         dict(cover=1.00, growth=0.00, inflow_true=1.0, label="Normal pre-monsoon drawdown, normal demand"),
    "heatwave":       dict(cover=0.97, growth=0.12, inflow_true=1.0, label="Heatwave demand surge (+12%)"),
    "delayed_monsoon": dict(cover=0.95, growth=0.05, inflow_true=0.0, label="Delayed NE monsoon: forecast inflow never arrives"),
    "severe_drought": dict(cover=0.85, growth=0.08, inflow_true=0.0, label="Multi-day severe drought"),
}


def simulate(method, preset="delayed_monsoon", days=14, seed=11, horizon=7, policy=None):
    P = PRESETS[preset]
    rng = np.random.default_rng(seed)
    pol = {**DEFAULT_POLICY, **(policy or {})}
    H = horizon
    base_inp = planner.build_inputs({"horizon": days + H, "demand_growth": P["growth"], "policy": pol})
    zones = base_inp["zones"]; ids = [z["id"] for z in zones]
    mean = base_inp["demand"]["expected"]
    actual = {i: [mean[i][t] * float(rng.lognormal(0, 0.04)) for t in range(days)] for i in ids}
    inflow_exp = base_inp["inflow"]["expected"]
    S = P["cover"] * sum(mean[i][t] / (1 - ZONE_BY_ID[i]["loss"]) for i in ids for t in range(days)) * ML_TO_MCM
    state, rec = {}, {i: [] for i in ids}
    viol_mld, res_viol, cost, rt = 0.0, 0, 0.0, []
    for k in range(days):
        win = slice(k, k + H)
        # forecasts for the planning window carry a persistent bias (forecast error)
        bias = {i: float(rng.normal(1.0, 0.03)) for i in ids}
        dem = {s: {i: [v * bias[i] * f for v in mean[i][win]] for i in ids} for s, f in (("dry", 1.05), ("expected", 1.0), ("wet", 0.95))}
        inf = {s: [v * P["inflow_true"] if False else v for v in base_inp["inflow"][s][win]] for s in ("dry", "expected", "wet")}
        reserve = pol["reserve_days"] * sum(dem["expected"][i][0] for i in ids) * ML_TO_MCM * (1 + pol["uncertainty_reserve_gain"] * 0.05)
        if method.startswith("jalniti") or method == "cost_only":
            res = solve_plan(zones, dem, inf, S, reserve, state, pol, use_fairness=(method == "jalniti_full"),
                             use_scenarios=(method not in ("jalniti_no_uncertainty", "cost_only")), horizon=H,
                             objective="cost_only" if method == "cost_only" else "full")
            plan = {i: res["x"][i][0] for i in ids}; rt.append(res["runtime_s"])
        else:
            avail = max(0.0, S + sum(inf["expected"]) - reserve) / H / ML_TO_MCM
            plan = baseline_day(method, zones, {i: dem["expected"][i][0] for i in ids}, avail)
        draw = sum(plan[i] / (1 - ZONE_BY_ID[i]["loss"]) for i in ids) * ML_TO_MCM
        true_inflow = base_inp["inflow"]["expected"][k] * P["inflow_true"]
        if draw > S + true_inflow:                       # physical limit: cannot release water that is not there
            f = max(0.0, (S + true_inflow) / draw); plan = {i: v * f for i, v in plan.items()}; draw *= f
        S = S + true_inflow - draw
        res_viol += int(S < reserve - 1e-9)
        for i in ids:
            z = ZONE_BY_ID[i]
            r = min(1.0, plan[i] / actual[i][k]); rec[i].append(r)
            if z["min_mld"] > 0: viol_mld += max(0.0, min(z["min_mld"], actual[i][k]) - plan[i])
            cost += z["cost"] * plan[i] / (1 - z["loss"])
        state = update_state(state, plan, {i: actual[i][k] for i in ids}, pol)
    resid = [i for i in ids if ZONE_BY_ID[i]["type"] == "residential"]
    def max_run(seq, th=pol["ration_ratio_threshold"]):
        best = run = 0
        for r in seq:
            run = run + 1 if r < th else 0; best = max(best, run)
        return best
    zone_mean = {i: float(np.mean(rec[i])) for i in ids}
    unmet = sum(max(0, actual[i][k] * (1 - rec[i][k])) for i in ids for k in range(days)) / sum(sum(actual[i]) for i in ids) * 100
    return dict(method=method, label=LABELS[method], preset=preset, days=days, unmet_pct=round(unmet, 2),
                protected_violation_mld_days=round(viol_mld, 2), worst_zone_mean_ratio=round(min(zone_mean[i] for i in resid), 3),
                worst_residential_day_ratio=round(min(min(rec[i]) for i in resid), 3), max_consecutive_rationing_days=max(max_run(rec[i]) for i in resid),
                residential_gini=round(gini([zone_mean[i] for i in resid]), 4), reserve_violation_days=res_viol,
                end_storage_mcm=round(S, 3), delivery_cost=round(cost, 1), avg_solver_runtime_s=round(float(np.mean(rt)), 3) if rt else 0.0,
                zone_mean_ratio={str(i): round(zone_mean[i], 3) for i in ids})


def evaluate(preset="delayed_monsoon", days=14, methods=None):
    return [simulate(m, preset, days) for m in (methods or METHODS)]
