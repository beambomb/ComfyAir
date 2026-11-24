from typing import Optional
from pydantic import BaseModel, Field


class PreferencesResponse(BaseModel):
    ac_power_pk: float
    electricity_rate_per_kwh: float
    default_temperature: int
    preferred_city: str
    updated_at: Optional[str] = None


class PreferencesUpdate(BaseModel):
    ac_power_pk: Optional[float] = Field(None, ge=0.5, le=5.0)
    electricity_rate_per_kwh: Optional[float] = Field(None, gt=0)
    default_temperature: Optional[int] = Field(None, ge=18, le=30)
    preferred_city: Optional[str] = Field(None, min_length=2, max_length=100)
