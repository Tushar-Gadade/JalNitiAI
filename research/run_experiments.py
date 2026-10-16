"""Reproduce the baseline + ablation experiments for the report.
Usage:  cd intelligence-service && python ../research/run_experiments.py
Writes research/results/{preset}.csv and a combined summary.csv. Results use SYNTHETIC/illustrative data unless real files are in data/raw/.
"""
import sys, pathlib, csv
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "intelligence-service"))
from app.simulation import scenario_runner as sr
from app.forecasting import demand_model

out = ROOT / "research" / "results"; out.mkdir(parents=True, exist_ok=True)
rows = []
for preset in sr.PRESETS:
    for r in sr.evaluate(preset):
        rows.append({k: v for k, v in r.items() if k != "zone_mean_ratio"})
        print(preset, r["method"], r["unmet_pct"], r["protected_violation_mld_days"], r["residential_gini"])
with open(out / "summary.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
import json; (out / "forecast_metrics.json").write_text(json.dumps(demand_model.metrics(), indent=2))
print("wrote", out)
