"""Zone-level demand forecasting: seasonal-naive, linear and gradient-boosting (with quantile intervals).

One pooled model across zones; target is demand / zone base demand so zones of different size share
statistical strength. Lag features are >= 7 days old, so a 1..7 day horizon never leaks the future.
"""
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from ..config import MODELS, ZONES, ZONE_BY_ID
from .. import data

FEATS = ["dow", "doy_sin", "doy_cos", "temp_c", "rain_mm", "holiday", "industry", "zone_id", "lag7", "roll7"]
_cache = {}


def _frame():
    d, w = data.load("demand"), data.load("weather")
    df = d.merge(w, on="date", how="left").sort_values(["zone_id", "date"]).reset_index(drop=True)
    df["base"] = df["zone_id"].map(lambda i: ZONE_BY_ID[i]["base_mld"])
    df["ratio"] = df["demand_mld"] / df["base"]
    g = df.groupby("zone_id")["ratio"]
    df["lag7"] = g.shift(7)
    df["roll7"] = g.shift(7).rolling(7).mean().reset_index(level=0, drop=True)
    return add_calendar(df)


def add_calendar(df):
    df = df.copy()
    doy = df["date"].dt.dayofyear
    df["dow"] = df["date"].dt.dayofweek
    df["doy_sin"], df["doy_cos"] = np.sin(2 * np.pi * doy / 365), np.cos(2 * np.pi * doy / 365)
    df["holiday"] = data._holidays(df["date"]).astype(int)
    df["industry"] = df["zone_id"].map(lambda i: int(ZONE_BY_ID[i]["type"].startswith("industry")))
    return df


def _fit(train):
    X, y = train[FEATS], train["ratio"]
    mean = GradientBoostingRegressor(n_estimators=150, max_depth=3, learning_rate=0.08, subsample=0.8, random_state=1).fit(X, y)
    lo = GradientBoostingRegressor(loss="quantile", alpha=0.10, n_estimators=100, max_depth=3, random_state=1).fit(X, y)
    hi = GradientBoostingRegressor(loss="quantile", alpha=0.90, n_estimators=100, max_depth=3, random_state=1).fit(X, y)
    lin = Ridge(alpha=1.0).fit(X, y)
    return dict(mean=mean, lo=lo, hi=hi, lin=lin)


def evaluate(holdout_days=60):
    """Backtest on the last `holdout_days` (metrics are on SYNTHETIC data unless real demand is supplied)."""
    df = _frame().dropna(subset=["lag7", "roll7"])
    cut = df["date"].max() - pd.Timedelta(days=holdout_days)
    tr, te = df[df["date"] <= cut], df[df["date"] > cut]
    m = _fit(tr)
    pred, lo, hi = m["mean"].predict(te[FEATS]), m["lo"].predict(te[FEATS]), m["hi"].predict(te[FEATS])
    y = te["ratio"].values
    def stats(p):
        e = (p - y) * te["base"].values
        return dict(mae_mld=float(np.abs(e).mean()), rmse_mld=float(np.sqrt((e ** 2).mean())),
                    mape_pct=float(np.mean(np.abs(p - y) / y) * 100))
    out = {"seasonal_naive": stats(te["lag7"].values), "ridge": stats(m["lin"].predict(te[FEATS])), "gradient_boosting": stats(pred)}
    out["gradient_boosting"]["interval_coverage_80"] = float(np.mean((y >= lo) & (y <= hi)))
    out["holdout_days"] = holdout_days
    out["data_note"] = "Metrics computed on " + ("REAL+synthetic mix" if (data.RAW / "demand_real.csv").exists() else "SYNTHETIC demand - tests pipeline, not real-world accuracy")
    return out


def train(force=False):
    MODELS.mkdir(exist_ok=True, parents=True)
    p = MODELS / "demand_gbr.joblib"
    if p.exists() and not force:
        _cache["m"] = joblib.load(p)["models"]; return
    df = _frame().dropna(subset=["lag7", "roll7"])
    models = _fit(df)
    joblib.dump({"models": models, "metrics": evaluate()}, p)
    _cache["m"] = models


def metrics():
    train()
    return joblib.load(MODELS / "demand_gbr.joblib")["metrics"]


def _climatology(hist_w, dates):
    hist_w = hist_w.assign(doy=hist_w["date"].dt.dayofyear)
    rows = []
    for d in dates:
        w = hist_w[(hist_w["doy"] - d.dayofyear).abs().le(5)]
        rows.append((float(w["temp_c"].mean()), float(w["rain_mm"].mean())))
    return rows


def forecast(horizon=7, temp_offset=0.0):
    """Return list of dict rows: zone_id, day (0-based), date, lower, predicted, upper, uncertainty (MLD)."""
    if "m" not in _cache:
        train()
    m = _cache["m"]
    full = _frame()
    last = full["date"].max()
    w = data.load("weather")
    dates = pd.date_range(last + pd.Timedelta(days=1), periods=horizon)
    clim = _climatology(w, dates)
    out = []
    for z in ZONES:
        zd = full[full["zone_id"] == z["id"]].set_index("date")["ratio"]
        for k, (d, (tmp, rn)) in enumerate(zip(dates, clim)):
            src = d - pd.Timedelta(days=7)
            lag7 = zd.get(src, zd.iloc[-7 + (k % 7)])
            r7 = zd.loc[src - pd.Timedelta(days=6): src].mean() if src <= last else zd.iloc[-7:].mean()
            row = add_calendar(pd.DataFrame([{"date": d, "zone_id": z["id"], "temp_c": tmp + temp_offset, "rain_mm": rn, "lag7": lag7, "roll7": r7}]))
            p, l, h = float(m["mean"].predict(row[FEATS])[0]), float(m["lo"].predict(row[FEATS])[0]), float(m["hi"].predict(row[FEATS])[0])
            l, h = min(l, p), max(h, p)
            b = z["base_mld"]
            out.append(dict(zone_id=z["id"], day=k, date=str(d.date()), lower=round(l * b, 2), predicted=round(p * b, 2),
                            upper=round(h * b, 2), uncertainty=round((h - l) / max(p, 1e-6) / 2, 4)))
    return out
