"""Shared configuration, Chennai case-study zones and default policy.

DATA HONESTY NOTE
Zone populations/demands below are ILLUSTRATIVE planning values inspired by Greater Chennai Corporation
ward groupings and the Chennai Metropolitan Water Supply & Sewerage Board (CMWSSB / Metrowater) service area.
The reservoir is the four-lake system feeding the city: Poondi (Sathyamoorthy Sagar), Cholavaram, Red Hills
(Puzhal) and Chembarambakkam. Replace with real CMWSSB / TWAD / India-WRIS data via data/raw/.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # intelligence-service/
DATA = ROOT.parent / "data"
RAW, PROCESSED = DATA / "raw", DATA / "processed"
MODELS = ROOT / "models"
ML_TO_MCM = 0.001  # 1 MLD for 1 day = 0.001 MCM

RESERVOIR = {
    "id": 1, "name": "Chennai Reservoir System (Poondi, Cholavaram, Red Hills, Chembarambakkam)", "state": "Tamil Nadu",
    "basin": "Kosasthalaiyar / Araniar / Adyar", "capacity_mcm": 313.1,   # ~11.057 TMC combined gross capacity
    "dead_storage_mcm": 0.0,
    "city_share": 0.038,   # fraction of live storage earmarked for the city's planning window (tunable)
}

# type: residential | hospital | industry_essential | industry_nonessential
ZONES = [
    dict(id=1, code="Z01", name="Tondiarpet - Royapuram", type="residential", population=480000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.80, criticality=0.5, max_cut_days=2, capacity_mld=95, loss=0.20, cost=1.0),
    dict(id=2, code="Z02", name="Anna Nagar - Kilpauk", type="residential", population=400000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.45, criticality=0.5, max_cut_days=3, capacity_mld=80, loss=0.14, cost=1.0),
    dict(id=3, code="Z03", name="T. Nagar - Mylapore", type="residential", population=380000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.40, criticality=0.5, max_cut_days=3, capacity_mld=78, loss=0.14, cost=1.1),
    dict(id=4, code="Z04", name="Adyar - Besant Nagar", type="residential", population=350000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.50, criticality=0.5, max_cut_days=3, capacity_mld=72, loss=0.16, cost=1.1),
    dict(id=5, code="Z05", name="Ambattur - Avadi", type="residential", population=520000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.75, criticality=0.5, max_cut_days=2, capacity_mld=105, loss=0.22, cost=1.2),
    dict(id=6, code="Z06", name="Velachery - Taramani", type="residential", population=450000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.70, criticality=0.5, max_cut_days=2, capacity_mld=92, loss=0.20, cost=1.3),
    dict(id=7, code="Z07", name="Tambaram - Pallavaram", type="residential", population=520000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.70, criticality=0.5, max_cut_days=3, capacity_mld=105, loss=0.21, cost=1.3),
    dict(id=8, code="Z08", name="Perambur - Kolathur", type="residential", population=400000, lpcd=135, min_lpcd=55, priority=1.0, vulnerability=0.60, criticality=0.5, max_cut_days=3, capacity_mld=80, loss=0.17, cost=1.2),
    dict(id=9, code="Z09", name="Egmore - Park Town Hospital Cluster (RGGGH / Children's)", type="hospital", population=0, base_mld=16, min_frac=0.95, priority=5.0, vulnerability=1.0, criticality=1.0, max_cut_days=0, capacity_mld=22, loss=0.05, cost=1.0),
    dict(id=10, code="Z10", name="Ambattur Industrial Estate (food/pharma)", type="industry_essential", population=0, base_mld=55, min_frac=0.60, priority=2.0, vulnerability=0.30, criticality=0.7, max_cut_days=4, capacity_mld=65, loss=0.10, cost=1.4),
    dict(id=11, code="Z11", name="OMR IT Corridor & Non-essential Industry", type="industry_nonessential", population=0, base_mld=45, min_frac=0.2, priority=0.3, vulnerability=0.10, criticality=0.1, max_cut_days=7, capacity_mld=55, loss=0.10, cost=1.5),
]
for _z in ZONES:
    if _z["type"] == "residential":
        _z["base_mld"] = round(_z["population"] * _z["lpcd"] / 1e6, 2)
        _z["min_frac"] = round(_z["min_lpcd"] / _z["lpcd"], 3)
    _z["min_mld"] = round(_z["base_mld"] * _z["min_frac"], 2)
ZONE_BY_ID = {z["id"]: z for z in ZONES}
CLASS_OF = {"residential": "residential", "hospital": "hospital",
            "industry_essential": "industry", "industry_nonessential": "industry"}

DEFAULT_POLICY = dict(
    alpha=0.8,                    # fairness-debt memory (decay)
    beta=3.0,                     # debt added per unit of missed target ratio
    debt_weight=2.5,              # how strongly debt raises protection
    target_ratio_protected=0.95,
    target_ratio_other=0.75,
    ration_ratio_threshold=0.90,  # delivered/demand below this = a "rationed" day
    reserve_days=1.0,             # strategic reserve in days of expected city demand
    uncertainty_reserve_gain=1.5, # extra reserve as forecast uncertainty grows
    inequity_weight=400.0,
    repeat_cut_weight=300.0,
    cost_weight=0.05,
    scenario_probs=dict(dry=0.3, expected=0.5, wet=0.2),
    horizon_days=7,
)
