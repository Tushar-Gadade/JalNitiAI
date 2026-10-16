"""Counterfactual what-ifs by re-solving the model with one policy lever changed."""
from ..optimization.allocation_model import solve_plan


def _total_short(res, demand, ids, H):
    return sum(max(0, demand["expected"][i][t] - res["x"][i][t]) for i in ids for t in range(H))


def build(zones, base, kw, demand):
    """kw = the kwargs used for the base solve. Returns list of counterfactual dicts."""
    ids, H = [z["id"] for z in zones], kw["horizon"]
    out, base_short = [], _total_short(base, demand, ids, H)
    # 1. reserve relaxed by 5 %
    r = solve_plan(zones, demand, kw["inflow"], kw["storage0"], kw["reserve_mcm"] * 0.95, kw["state"], kw["policy"],
                   use_fairness=kw["use_fairness"], use_scenarios=kw["use_scenarios"], cap_factor=kw["cap_factor"], horizon=H)
    dry_min = lambda res: min(res["storage"].get("dry", res["storage"]["expected"]))
    out.append(dict(lever="Reserve threshold -5%", extra_supply_mld_days=round(base_short - _total_short(r, demand, ids, H), 2),
                    dry_min_storage_change_mcm=round(dry_min(r) - dry_min(base), 4),
                    message=f"Lowering the reserve by 5% frees {max(0, base_short - _total_short(r, demand, ids, H)):.1f} MLD-days of supply "
                            f"over the horizon but cuts the lowest dry-scenario storage by {max(0, dry_min(base) - dry_min(r)):.3f} MCM."))
    # 2. fairness debt switched off
    if kw["use_fairness"] and any(v["debt"] > 0 for v in kw["state"].values()):
        r2 = solve_plan(zones, demand, kw["inflow"], kw["storage0"], kw["reserve_mcm"], kw["state"], kw["policy"],
                        use_fairness=False, use_scenarios=kw["use_scenarios"], cap_factor=kw["cap_factor"], horizon=H)
        moved = sorted(((i, base["x"][i][0] - r2["x"][i][0]) for i in ids), key=lambda p: -abs(p[1]))[:2]
        out.append(dict(lever="Ignore fairness debt", moved=[{"zone_id": i, "delta_day1_mld": round(d, 2)} for i, d in moved],
                        message="Without fairness memory, day-1 allocation would shift by " + ", ".join(f"{d:+.1f} MLD for zone {i}" for i, d in moved) + "."))
    return out
