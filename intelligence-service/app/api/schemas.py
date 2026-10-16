from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class PlanParams(BaseModel):
    horizon: int = Field(7, ge=3, le=14)
    policy: Optional[Dict] = None
    state: Optional[Dict[int, Dict]] = None          # {zone_id: {debt, consecutive}}
    demand_growth: float = Field(0.0, ge=-0.5, le=1.0)
    inflow_factor: float = Field(1.0, ge=0.0, le=3.0)
    storage_factor: float = Field(1.0, ge=0.0, le=3.0)
    storage_override_mcm: Optional[float] = Field(None, ge=0)
    reserve_days: Optional[float] = Field(None, ge=0, le=10)
    temp_offset: float = 0.0
    outages: Optional[Dict[int, float]] = None        # {zone_id: capacity factor 0..1}
    use_fairness: bool = True
    use_scenarios: bool = True


class ScenarioItem(BaseModel):
    name: str
    params: PlanParams


class CompareRequest(BaseModel):
    base: PlanParams = PlanParams()
    scenarios: Optional[List[ScenarioItem]] = None


class FairnessUpdate(BaseModel):
    state: Dict[int, Dict] = {}
    delivered: Dict[int, float]
    demand: Dict[int, float]
    policy: Optional[Dict] = None


class EvalRequest(BaseModel):
    preset: str = "delayed_monsoon"
    days: int = Field(14, ge=7, le=21)
