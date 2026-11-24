from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.core.storage import get_storage
from app.schemas.savings import SavingsLogCreate, SavingsLogResponse

router = APIRouter(prefix="/savings", tags=["Savings"])


@router.get("/logs", response_model=list[SavingsLogResponse])
def list_savings_logs(
    period: Optional[Literal["daily", "weekly", "monthly"]] = Query(None),
    user: dict[str, Any] = Depends(get_current_user),
):
    rows = get_storage().list_savings_logs(user["user_id"], period=period)
    return [SavingsLogResponse(**r) for r in rows]


@router.post("/logs", response_model=SavingsLogResponse, status_code=status.HTTP_201_CREATED)
def create_savings_log(
    req: SavingsLogCreate,
    user: dict[str, Any] = Depends(get_current_user),
):
    kwh_baseline = (req.ac_power_pk * 0.8) * req.hours_per_night * req.nights
    savings_pct = max(0.0, (req.setpoint - 20) * 6.5)
    kwh_optimized = kwh_baseline * (1.0 - savings_pct / 100.0)
    saved_cost_idr = round(kwh_baseline * req.electricity_rate_per_kwh) - round(
        kwh_optimized * req.electricity_rate_per_kwh
    )

    row = get_storage().create_savings_log(
        user_id=user["user_id"],
        estimated_kwh_baseline=kwh_baseline,
        estimated_kwh_optimized=kwh_optimized,
        saved_cost_idr=saved_cost_idr,
        log_date=req.log_date,
    )
    return SavingsLogResponse(**row)


@router.delete("/logs/{log_id}")
def delete_savings_log(
    log_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    deleted = get_storage().delete_savings_log(user["user_id"], log_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catatan penghematan tidak ditemukan",
        )
    return {"status": "deleted", "log_id": log_id}
