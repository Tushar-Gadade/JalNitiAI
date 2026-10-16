"""Reason codes and plain-language explanations for every zone-day allocation."""

def explain_row(z, day, demand, alloc, ratio, st, class_mean, reserve_tight, state):
    debt = state.get(z["id"], {}).get("debt", 0.0)
    pct = round(ratio * 100)
    if ratio >= 0.98:
        return "FULL_SUPPLY", f"{z['name']} receives its full request ({pct}%)."
    if z["min_mld"] > 0 and abs(alloc - min(z["min_mld"], demand)) <= 0.01 * max(demand, 1):
        return "PROTECTED_FLOOR_BINDING", (f"{z['name']} is held at its protected minimum of {z['min_mld']:.1f} MLD ({pct}% of demand); "
                                           "the service floor is the binding constraint.")
    if debt >= 0.5 and ratio > class_mean + 0.02:
        return "FAIRNESS_DEBT_PROTECTION", (f"{z['name']} was rationed recently (fairness debt {debt:.2f}), so it is cut less than similar zones "
                                            f"({pct}% vs {round(class_mean * 100)}% class average).")
    if reserve_tight:
        return "RESERVE_HOLD", (f"{z['name']} receives {pct}% because water is being held back as a safety reserve against the dry-inflow scenario.")
    return "PROPORTIONAL_SHARE", f"{z['name']} receives {pct}% of demand as its fair share of the limited supply."
