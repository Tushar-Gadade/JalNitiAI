"""Fairness-debt memory: debt[t+1] = alpha*debt[t] + beta*max(0, target_ratio - delivered_ratio)."""
from ..config import ZONE_BY_ID

PROTECTED_TYPES = {"residential", "hospital", "industry_essential"}


def target_ratio(zone, policy):
    return policy["target_ratio_protected"] if zone["type"] in ("residential", "hospital") else policy["target_ratio_other"]


def update_state(state, delivered, demand, policy):
    """state: {zone_id: {debt, consecutive}}; delivered/demand: {zone_id: MLD} for the day just executed."""
    new = {}
    for zid, z in ZONE_BY_ID.items():
        s = state.get(zid, {"debt": 0.0, "consecutive": 0})
        ratio = min(1.0, delivered[zid] / demand[zid]) if demand[zid] > 0 else 1.0
        debt = policy["alpha"] * s["debt"] + policy["beta"] * max(0.0, target_ratio(z, policy) - ratio)
        consec = s["consecutive"] + 1 if ratio < policy["ration_ratio_threshold"] else 0
        new[zid] = {"debt": round(debt, 4), "consecutive": consec, "last_ratio": round(ratio, 4)}
    return new
