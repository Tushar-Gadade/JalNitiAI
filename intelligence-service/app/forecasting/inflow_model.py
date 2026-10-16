"""Inflow scenarios from historical percentiles (deliberately simple: weak inflow models are not pretended to be accurate)."""
import numpy as np
import pandas as pd
from .. import data


def inflow_scenarios(horizon=7):
    """Complex-level inflow in MCM/day per scenario: dry=p20, expected=p50, wet=p80 of same-season history,
    scaled by a persistence factor from the last 30 days (clipped 0.3..1.5)."""
    r = data.load("reservoir")
    last = r["date"].max()
    r = r.assign(doy=r["date"].dt.dayofyear)
    dates = pd.date_range(last + pd.Timedelta(days=1), periods=horizon)
    hist = r[r["date"] < last - pd.Timedelta(days=30)]
    recent = r[r["date"] > last - pd.Timedelta(days=30)]["inflow_mcm"].mean()
    out = {"dry": [], "expected": [], "wet": []}
    ratios = []
    for d in dates:
        w = hist[(hist["doy"] - d.dayofyear).abs().le(10)]["inflow_mcm"]
        clim = float(w.mean()) if len(w) else 0.0
        ratios.append(clim)
        for k, q in (("dry", 20), ("expected", 50), ("wet", 80)):
            out[k].append(float(np.percentile(w, q)) if len(w) else 0.0)
    clim_recent = hist[(hist["doy"] - last.dayofyear).abs().le(25)]["inflow_mcm"].mean()
    persist = float(np.clip(recent / clim_recent, 0.3, 1.5)) if clim_recent and clim_recent > 0.05 else 1.0
    for k in out:
        out[k] = [round(v * persist, 3) for v in out[k]]
    return {"dates": [str(d.date()) for d in dates], "persistence_factor": round(persist, 3), "scenarios_mcm_per_day": out}
