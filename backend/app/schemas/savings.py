from typing import Optional
from pydantic import BaseModel, Field


class SavingsLogCreate(BaseModel):
    nights: int = Field(30, ge=1, le=365)
    hours_per_night: float = Field(8.0, ge=1.0, le=24.0)
    ac_power_pk: float = Field(1.0, ge=0.5, le=5.0)
    electricity_rate_per_kwh: float = Field(1444.70, gt=0)
    setpoint: int = Field(..., ge=16, le=30)
    log_date: Optional[str] = None


class SavingsLogResponse(BaseModel):
    log_id: str
    log_date: str
    estimated_kwh_baseline: float
    estimated_kwh_optimized: float
    saved_cost_idr: float
    created_at: str
