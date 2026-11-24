from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_optional_user
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.ml_service import ml_service
from app.services.telemetry import telemetry_manager

router = APIRouter(tags=["Prediction"])


@router.post("/predict", response_model=PredictionResponse)
async def predict_ac_setpoint(
    req: PredictionRequest,
    user: dict[str, Any] | None = Depends(get_optional_user),
):
    """Menghitung rekomendasi suhu AC dinamis via model scikit-learn."""
    user_id = user["user_id"] if user else None
    result = ml_service.predict_setpoint(req, user_id=user_id)
    await telemetry_manager.broadcast(
        {
            "type": "prediction",
            "outdoor_temp": req.outdoor_temp,
            "humidity": req.humidity,
            "mode": req.mode,
            "recommended_setpoint": result.recommended_setpoint,
            "heat_index_c": result.heat_index_c,
            "model_used": result.model_used,
        }
    )
    return result


@router.get("/model/info")
def get_model_info():
    """Metrik evaluasi dan perbandingan algoritma Machine Learning."""
    return ml_service.get_model_info()
