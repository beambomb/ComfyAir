from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.storage import get_storage
from app.schemas.preferences import PreferencesResponse, PreferencesUpdate

router = APIRouter(prefix="/preferences", tags=["Preferences"])


@router.get("", response_model=PreferencesResponse)
def get_preferences(user: dict[str, Any] = Depends(get_current_user)):
    pref = get_storage().get_preferences(user["user_id"])
    return PreferencesResponse(
        ac_power_pk=float(pref["ac_power_pk"]),
        electricity_rate_per_kwh=float(pref["electricity_rate_per_kwh"]),
        default_temperature=int(pref["default_temperature"]),
        preferred_city=str(pref["preferred_city"]),
        updated_at=pref.get("updated_at"),
    )


@router.put("", response_model=PreferencesResponse)
def update_preferences(
    req: PreferencesUpdate,
    user: dict[str, Any] = Depends(get_current_user),
):
    updates = req.model_dump(exclude_none=True)
    pref = get_storage().upsert_preferences(user["user_id"], updates)
    return PreferencesResponse(
        ac_power_pk=float(pref["ac_power_pk"]),
        electricity_rate_per_kwh=float(pref["electricity_rate_per_kwh"]),
        default_temperature=int(pref["default_temperature"]),
        preferred_city=str(pref["preferred_city"]),
        updated_at=pref.get("updated_at"),
    )
