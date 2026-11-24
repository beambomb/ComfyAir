from typing import List, Optional
from pydantic import BaseModel, Field


class SleepProfileRequest(BaseModel):
    bedtime: str = Field(
        default="22:00",
        examples=["22:00"],
        description="Jam tidur (format HH:MM)",
    )
    wake_time: str = Field(
        default="06:00",
        examples=["06:00"],
        description="Jam bangun (format HH:MM)",
    )
    start_temp: int = Field(
        default=24,
        ge=18,
        le=30,
        examples=[24],
        description="Suhu awal menjelang tidur (°C)",
    )
    deep_sleep_temp: int = Field(
        default=26,
        ge=18,
        le=30,
        examples=[26],
        description="Suhu saat fase deep sleep (°C)",
    )
    wake_temp: int = Field(
        default=25,
        ge=18,
        le=30,
        examples=[25],
        description="Suhu saat bangun tidur (°C)",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="UUID pengguna dari Supabase jika terdaftar",
    )


class SleepProfileRecord(BaseModel):
    sleep_profile_id: str
    profile_name: str
    bedtime: str
    wake_time: str
    start_temp: int
    deep_sleep_temp: int
    wake_temp: int
    is_active: bool


class SleepProfileUpdate(BaseModel):
    profile_name: Optional[str] = Field(None, min_length=1, max_length=100)
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None
    start_temp: Optional[int] = Field(None, ge=18, le=30)
    deep_sleep_temp: Optional[int] = Field(None, ge=18, le=30)
    wake_temp: Optional[int] = Field(None, ge=18, le=30)
    is_active: Optional[bool] = None


class SleepHourlyPoint(BaseModel):
    time: str = Field(..., examples=["23:00"], description="Jam tertentu")
    recommended_temp: int = Field(
        ..., examples=[25], description="Rekomendasi setpoint suhu AC (°C)"
    )
    phase: str = Field(
        ...,
        examples=["Fase Awal Tidur (Sleep Onset)"],
        description="Fase biologis tidur",
    )


class SleepCurveResponse(BaseModel):
    summary: str = Field(
        ..., examples=["Kurva temperatur tidur biologis berhasil dihitung"]
    )
    total_sleep_hours: int = Field(
        ..., examples=[8], description="Durasi tidur dalam jam"
    )
    curve: List[SleepHourlyPoint] = Field(
        ..., description="Daftar titik rekomendasi suhu per jam"
    )
    estimated_energy_saving: str = Field(
        ..., examples=["Estimasi penghematan energi ~15-20% dibanding suhu flat"]
    )
