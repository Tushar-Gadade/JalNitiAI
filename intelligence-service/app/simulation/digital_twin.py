"""Digital twin (MVP): validates a proposed plan on a source -> route -> zone graph before approval."""
from ..config import ML_TO_MCM
from ..optimization.allocation_model import gini


def validate(zones, plan_x, demand, inflow, storage0, reserve_mcm, state, policy, cap_factor=None):
    cap_factor = cap_factor or {}
    H = len(next(iter(plan_x.values())))
    Z = {z["id"]: z for z in zones}
    checks = []

    def add(name, ok, detail, warn=False):
        checks.append({"check": name, "status": "PASS" if ok else ("WARN" if warn else "FAIL"), "detail": detail})

    # 1 route capacity
    bad = [(Z[i]["code"], t) for i in plan_x for t in range(H) if plan_x[i][t] > Z[i]["capacity_mld"] * cap_factor.get(i, 1) + 1e-6]
    add("Route capacity", not bad, "All zone routes within capacity" if not bad else f"Over capacity: {bad[:4]}")
    # 2 reservoir balance per scenario (independent recomputation)
    worst, neg = {}, False
    for s, inf in inflow.items():
        sto, lo = storage0, storage0
        for t in range(H):
            sto += inf[t] - sum(plan_x[i][t] / (1 - Z[i]["loss"]) for i in plan_x) * ML_TO_MCM
            lo = min(lo, sto)
        worst[s] = round(lo, 3); neg |= lo < -1e-6
    add("Reservoir balance", not neg, "Storage stays non-negative in " + ", ".join(f"{k}: min {v} MCM" for k, v in worst.items()))
    # 3 reserve safety
    short = [s for s, v in worst.items() if v < reserve_mcm - 1e-6]
    add("Reserve safety", not short, f"Reserve {reserve_mcm:.3f} MCM kept in all scenarios" if not short else
        f"Reserve breached under: {', '.join(short)}", warn=True)
    # 4 protected minimum
    miss = [(Z[i]["code"], t) for i in plan_x for t in range(H) if Z[i]["min_mld"] > 0 and plan_x[i][t] + 1e-3 < min(Z[i]["min_mld"], demand["expected"][i][t])]
    add("Protected minimum service", not miss, "Hospital, household and essential floors met" if not miss else f"Floors missed: {miss[:4]}")
    # 5 consecutive rationing
    breaches = []
    for i in plan_x:
        z = Z[i]; run = state.get(i, {}).get("consecutive", 0)
        for t in range(H):
            r = plan_x[i][t] / max(demand["expected"][i][t], 1e-9)
            run = run + 1 if r < policy["ration_ratio_threshold"] else 0
            if z["max_cut_days"] and run > z["max_cut_days"] and z["type"] != "industry_nonessential":
                breaches.append((z["code"], t)); break
    add("Consecutive rationing limit", not breaches, "No zone exceeds its limit" if not breaches else f"Limit exceeded: {breaches[:4]} (re-optimised daily)", warn=True)
    # 6 fairness
    r0 = [plan_x[i][0] / max(demand["expected"][i][0], 1e-9) for i in plan_x if Z[i]["type"] == "residential"]
    g = gini(r0)
    add("Fairness (residential Gini, day 1)", g < 0.08, f"Gini = {g:.3f}", warn=True)
    ok = all(c["status"] != "FAIL" for c in checks)
    return {"feasible_and_safe": ok, "checks": checks}
