from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.storage import get_storage
from app.schemas.sleep import (
    SleepCurveResponse,
    SleepProfileRecord,
    SleepProfileRequest,
    SleepProfileUpdate,
)
from app.services.sleep_service import sleep_service

router = APIRouter(tags=["Sleep Mode"])


def _normalize_time_db(val: str) -> str:
    trimmed = val.strip()
    if len(trimmed) == 5:
        return f"{trimmed}:00"
    return trimmed


def _to_record(row: dict[str, Any]) -> SleepProfileRecord:
    return SleepProfileRecord(
        sleep_profile_id=str(row["sleep_profile_id"]),
        profile_name=str(row["profile_name"]),
        bedtime=str(row["bedtime"])[:5],
        wake_time=str(row["wake_time"])[:5],
        start_temp=int(row["start_temp"]),
        deep_sleep_temp=int(row["deep_sleep_temp"]),
        wake_temp=int(row["wake_temp"]),
        is_active=bool(row.get("is_active", True)),
    )


@router.post("/sleep-curve", response_model=SleepCurveResponse)
def get_sleep_temperature_curve(req: SleepProfileRequest):
    """Menghitung rekomendasi kurva temperatur tidur biologis dinamis sepanjang malam."""
    return sleep_service.calculate_sleep_curve(req)


@router.get("/sleep-profiles", response_model=SleepProfileRecord)
def get_my_sleep_profile(user: dict[str, Any] = Depends(get_current_user)):
    row = get_storage().get_sleep_profile(user["user_id"])
    return _to_record(row)


@router.put("/sleep-profiles", response_model=SleepProfileRecord)
def update_my_sleep_profile(
    req: SleepProfileUpdate,
    user: dict[str, Any] = Depends(get_current_user),
):
    updates = req.model_dump(exclude_none=True)
    if "bedtime" in updates:
        updates["bedtime"] = _normalize_time_db(updates["bedtime"])
    if "wake_time" in updates:
        updates["wake_time"] = _normalize_time_db(updates["wake_time"])
    row = get_storage().upsert_sleep_profile(user["user_id"], updates)
    return _to_record(row)
