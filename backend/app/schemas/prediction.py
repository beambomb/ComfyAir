from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    outdoor_temp: float = Field(..., examples=[32.5], description="Suhu luar ruangan (°C)")
    humidity: float = Field(..., ge=0, le=100, examples=[75.0], description="Kelembapan udara (%)")
    mode: Literal["ECO", "SLEEP", "COMFORT"] = Field("SLEEP", description="Mode kenyamanan")
    hour: Optional[int] = Field(None, ge=0, le=23, description="Jam lokal (0-23 WIB)")
    ac_power_pk: float = Field(1.0, ge=0.5, le=5.0, description="Kapasitas AC (PK)")
    user_id: Optional[str] = Field(None, description="UUID user jika terdaftar")


class PredictionResponse(BaseModel):
    recommended_setpoint: int = Field(..., examples=[25], description="Suhu setpoint AC (°C)")
    raw_predicted_temp: float = Field(..., examples=[25.18], description="Prediksi kontinu ML (°C)")
    heat_index_c: float = Field(..., examples=[36.2], description="Heat index NOAA (°C)")
    mode: str = Field(..., examples=["SLEEP"])
    comfort_description: str = Field(..., examples=["Stabil menyesuaikan penurunan suhu tubuh saat tidur"])
    estimated_savings_percent: float = Field(..., examples=[32.5])
    model_used: str = Field(..., examples=["GradientBoostingRegressor"])
    model_r2: Optional[float] = Field(None, examples=[0.974])
    personal_bias_c: float = Field(0.0, description="Kalibrasi preferensi suhu personal (°C)")
    feedback_count: int = Field(0, description="Jumlah umpan balik yang digunakan")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ComfortFeedbackRequest(BaseModel):
    outdoor_temp: float = Field(..., examples=[30.0])
    humidity: float = Field(..., ge=0, le=100, examples=[75.0])
    mode: Literal["ECO", "SLEEP", "COMFORT"] = Field("SLEEP")
    predicted_setpoint: int = Field(..., ge=16, le=32, examples=[26])
    rating: Literal["too_cold", "just_right", "too_warm"]


class ComfortFeedbackRecord(BaseModel):
    feedback_id: str
    outdoor_temp: float
    humidity: float
    mode: str
    predicted_setpoint: int
    rating: str
    delta_c: float
    created_at: str


class ComfortFeedbackSummary(BaseModel):
    personal_bias_c: float
    feedback_count: int
    recent: list[ComfortFeedbackRecord]
