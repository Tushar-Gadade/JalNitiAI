"""Convert downloaded public datasets into the files JalNiti AI reads from data/raw/.

1) Reservoir (Kaggle / India-WRIS / CWC):  python scripts/prepare_real_data.py reservoir  <input.csv> --date-col Date --storage-col "Live Storage" [--name-col Reservoir --name "Poondi"]
2) Weather   (IMD / Kaggle):               python scripts/prepare_real_data.py weather    <input.csv> --date-col Date --temp-col Tmax --rain-col Rainfall
3) Demand    (CMWSSB meter data, if obtained): python scripts/prepare_real_data.py demand     <input.csv> --date-col Date --zone-col Zone --demand-col MLD
Output: data/raw/{reservoir_real,weather_real,demand_real}.csv. Then delete data/processed/*.csv and models/*.joblib and restart the AI service.
"""
import argparse, pathlib
import pandas as pd
RAW = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw"
ap = argparse.ArgumentParser(); ap.add_argument("kind", choices=["reservoir", "weather", "demand"]); ap.add_argument("src")
ap.add_argument("--date-col", default="date"); ap.add_argument("--storage-col"); ap.add_argument("--inflow-col"); ap.add_argument("--name-col"); ap.add_argument("--name")
ap.add_argument("--temp-col"); ap.add_argument("--rain-col"); ap.add_argument("--zone-col"); ap.add_argument("--demand-col")
a = ap.parse_args()
df = pd.read_csv(a.src); df[a.date_col] = pd.to_datetime(df[a.date_col], dayfirst=True, errors="coerce"); df = df.dropna(subset=[a.date_col])
RAW.mkdir(parents=True, exist_ok=True)
if a.kind == "reservoir":
    if a.name_col and a.name: df = df[df[a.name_col].astype(str).str.contains(a.name, case=False)]
    # NOTE: convert units to MCM first (1 TMC = 28.317 MCM, 1 BCM = 1000 MCM) and scale to the whole complex if your file is per-dam.
    o = pd.DataFrame({"date": df[a.date_col], "storage_mcm": pd.to_numeric(df[a.storage_col], errors="coerce")})
    if a.inflow_col: o["inflow_mcm"] = pd.to_numeric(df[a.inflow_col], errors="coerce")
    o.dropna().sort_values("date").to_csv(RAW / "reservoir_real.csv", index=False)
elif a.kind == "weather":
    pd.DataFrame({"date": df[a.date_col], "temp_c": pd.to_numeric(df[a.temp_col], errors="coerce"), "rain_mm": pd.to_numeric(df[a.rain_col], errors="coerce").fillna(0)}).dropna(subset=["temp_c"]).to_csv(RAW / "weather_real.csv", index=False)
else:
    pd.DataFrame({"date": df[a.date_col], "zone_id": df[a.zone_col], "demand_mld": pd.to_numeric(df[a.demand_col], errors="coerce")}).dropna().to_csv(RAW / "demand_real.csv", index=False)
print("written to", RAW)
