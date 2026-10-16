"""Penalty tiers approximating a lexicographic objective (1 emergency >> 2 critical >> 3 fairness >> 4 shortage >> 5 cost)."""
W_EMERGENCY = 1e5     # unmet protected minimum, per MLD
W_CONSEC = 5e4        # breaching a max-consecutive-rationing limit
W_RESERVE = 1500.0    # reserve shortfall, per MCM
LADDER = [(0.98, 0, "NORMAL"), (0.90, 1, "CONSERVATION_ADVISORY"), (0.75, 2, "MILD_REDUCTION"),
          (0.55, 3, "TIME_WINDOW_RATIONING"), (0.35, 4, "SEVERE_RESTRICTION"), (-1, 5, "EMERGENCY_PROTECTED_MINIMUM")]


def ration_stage(ratio):
    for th, n, name in LADDER:
        if ratio >= th:
            return n, name
    return 5, LADDER[-1][2]


def zone_weight(z, debt, consec, d0, policy, use_fairness=True):
    w = z["priority"] * (1 + z["vulnerability"]) * (1 + 2 * z["criticality"])
    if use_fairness:
        w *= 1 + policy["debt_weight"] * debt
        w += policy["repeat_cut_weight"] * (consec / max(1, z["max_cut_days"] or 1)) / max(d0, 1.0)
    return w
