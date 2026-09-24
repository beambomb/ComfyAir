from typing import Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    outdoor_temp: float = Field(..., example=32.5, description="Suhu luar ruangan (°C)")
    humidity: float = Field(..., example=75.0, description="Kelembapan udara (%)")
    mode: Literal["ECO", "SLEEP", "COMFORT"] = Field("ECO", description="Mode kenyamanan")
    user_id: Optional[str] = Field(None, description="UUID user jika terdaftar")


class PredictionResponse(BaseModel):
    recommended_setpoint: int = Field(..., example=25, description="Suhu setpoint AC (°C)")
    mode: str = Field(..., example="ECO")
    comfort_description: str = Field(..., example="Kondisi ideal hemat energi")
    estimated_savings_percent: float = Field(..., example=12.5)
    created_at: datetime = Field(default_factory=datetime.utcnow)
