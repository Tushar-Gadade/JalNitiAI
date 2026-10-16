"""Multi-period, scenario-based LP for fair, risk-aware reservoir allocation (PuLP + CBC).

Decisions x[i,t] are scenario-independent ("here and now"); storage and shortage are tracked per scenario,
so the plan must keep reserve safe under dry/expected/wet futures. Rationing ladder stages are derived
from satisfaction ratios (LP stays continuous; no cliff-edge cutoffs).
"""
import time
import numpy as np
import pulp
from ..config import ML_TO_MCM, CLASS_OF
from .objectives import W_EMERGENCY, W_CONSEC, W_RESERVE, zone_weight, ration_stage

SCEN = ("dry", "expected", "wet")


def solve_plan(zones, demand, inflow, storage0, reserve_mcm, state, policy, *, use_fairness=True,
               use_scenarios=True, protect_min=True, cap_factor=None, horizon=7, objective="full"):
    """demand[s][zid]=[MLD per day], inflow[s]=[city MCM/day], state[zid]={debt, consecutive}.
    objective: 'full' | 'cost_only' (baseline: no priorities/fairness)."""
    t0 = time.time()
    H = horizon
    cap_factor = cap_factor or {}
    scen = list(SCEN) if use_scenarios else ["expected"]
    probs = {s: policy["scenario_probs"][s] for s in scen}
    tot = sum(probs.values()); probs = {s: p / tot for s, p in probs.items()}
    m = pulp.LpProblem("jalniti", pulp.LpMinimize)
    ids = [z["id"] for z in zones]
    Z = {z["id"]: z for z in zones}
    cap = {i: Z[i]["capacity_mld"] * cap_factor.get(i, 1.0) for i in ids}
    x = {(i, t): pulp.LpVariable(f"x_{i}_{t}", 0, min(cap[i], max(demand["expected"][i][t], 0))) for i in ids for t in range(H)}
    viol = {(i, t): pulp.LpVariable(f"v_{i}_{t}", 0) for i in ids for t in range(H)}
    short = {(i, t, s): pulp.LpVariable(f"s_{i}_{t}_{s}", 0) for i in ids for t in range(H) for s in scen}
    stor = {(t, s): pulp.LpVariable(f"st_{t}_{s}", 0) for t in range(H) for s in scen}
    rsl = {(t, s): pulp.LpVariable(f"rs_{t}_{s}", 0) for t in range(H) for s in scen}
    classes = sorted({CLASS_OF[Z[i]["type"]] for i in ids})
    ineq = {(c, t): pulp.LpVariable(f"u_{c}_{t}", 0, 1) for c in classes for t in range(H)}
    cutviol = {i: pulp.LpVariable(f"cv_{i}", 0) for i in ids}

    obj = []
    for i in ids:
        z = Z[i]
        st = state.get(i, {"debt": 0.0, "consecutive": 0})
        d0 = demand["expected"][i][0]
        w = zone_weight(z, st["debt"], st["consecutive"], d0, policy, use_fairness) if objective == "full" else 1.0
        for t in range(H):
            mn = z["min_mld"] if z["min_mld"] > 0 and protect_min else 0.0
            mn = min(mn, demand["expected"][i][t])
            m += x[i, t] + viol[i, t] >= mn
            obj.append(W_EMERGENCY * viol[i, t])
            for s in scen:
                m += short[i, t, s] >= demand[s][i][t] - x[i, t]
                obj.append(probs[s] * w * short[i, t, s])
            if objective == "full" and demand["expected"][i][t] > 0 and z["type"] != "industry_nonessential":
                m += ineq[CLASS_OF[z["type"]], t] >= (1.0 / demand["expected"][i][t]) * (demand["expected"][i][t] - x[i, t])
        obj.append(policy["cost_weight"] * z["cost"] * pulp.lpSum(x[i, t] * (1.0 / (1 - z["loss"])) for t in range(H)) * (1.0 / H))
        # hard-ish consecutive-rationing cap on day 0
        if objective == "full" and use_fairness and z["max_cut_days"] and st["consecutive"] >= z["max_cut_days"]:
            m += x[i, 0] + cutviol[i] >= policy["ration_ratio_threshold"] * demand["expected"][i][0]
            obj.append(W_CONSEC * cutviol[i])
    if objective == "full":
        for c in classes:
            for t in range(H):
                obj.append((policy["inequity_weight"] / H) * ineq[c, t])

    for s in scen:
        for t in range(H):
            prev = storage0 if t == 0 else stor[t - 1, s]
            draw = pulp.lpSum(x[i, t] * (ML_TO_MCM / (1 - Z[i]["loss"])) for i in ids)
            m += stor[t, s] == prev + inflow[s][t] - draw
            m += stor[t, s] + rsl[t, s] >= reserve_mcm
            if objective == "full":
                obj.append((probs[s] * W_RESERVE / H) * rsl[t, s])
    m += pulp.lpSum(obj)
    status = m.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=30))
    stname = pulp.LpStatus[status]

    out_x = {i: [round(x[i, t].value() or 0.0, 3) for t in range(H)] for i in ids}
    return dict(
        status=stname, runtime_s=round(time.time() - t0, 3), x=out_x,
        violation={i: [round(viol[i, t].value() or 0.0, 3) for t in range(H)] for i in ids},
        storage={s: [round(stor[t, s].value() or 0.0, 4) for t in range(H)] for s in scen},
        reserve_slack={s: [round(rsl[t, s].value() or 0.0, 4) for t in range(H)] for s in scen},
        objective=round(pulp.value(m.objective) or 0.0, 3), scenarios=scen,
        consec_breach={i: round(cutviol[i].value() or 0.0, 3) for i in ids},
    )


# ---------------- baselines (single-day budget rules used in rolling simulation) ----------------
def baseline_day(method, zones, demand_today, budget_mld, order=None):
    """Return {zid: delivered_net_mld}. budget_mld is gross reservoir release; losses are applied per zone."""
    alloc = {z["id"]: 0.0 for z in zones}
    Z = {z["id"]: z for z in zones}
    gross_need = {i: min(demand_today[i], Z[i]["capacity_mld"]) / (1 - Z[i]["loss"]) for i in alloc}
    if method == "proportional":
        tot = sum(gross_need.values()); f = min(1.0, budget_mld / tot) if tot else 0
        return {i: gross_need[i] * f * (1 - Z[i]["loss"]) for i in alloc}
    seq = list(order) if order else sorted(alloc)
    if method == "fixed_priority":
        seq = sorted(alloc, key=lambda i: (-Z[i]["priority"], i))
    rem = budget_mld
    for i in seq:
        g = min(gross_need[i], rem); alloc[i] = g * (1 - Z[i]["loss"]); rem -= g
    return alloc


def gini(values):
    v = np.sort(np.asarray(values, dtype=float))
    if v.sum() == 0:
        return 0.0
    n = len(v)
    return float((2 * np.arange(1, n + 1) - n - 1).dot(v) / (n * v.sum()))
