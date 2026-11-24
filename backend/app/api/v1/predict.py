from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_optional_user
from app.core.storage import get_storage
from app.schemas.prediction import (
    ComfortFeedbackRecord,
    ComfortFeedbackRequest,
    ComfortFeedbackSummary,
    PredictionRequest,
    PredictionResponse,
)
from app.services.ml_service import ml_service
from app.services.telemetry import telemetry_manager

router = APIRouter(tags=["Prediction"])

RATING_DELTAS = {
    "too_cold": 1.0,
    "just_right": 0.0,
    "too_warm": -1.0,
}


@router.post("/predict", response_model=PredictionResponse)
async def predict_ac_setpoint(
    req: PredictionRequest,
    user: dict[str, Any] | None = Depends(get_optional_user),
):
    """Menghitung rekomendasi suhu AC dinamis via model scikit-learn + kalibrasi personal."""
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
            "personal_bias_c": result.personal_bias_c,
            "model_used": result.model_used,
        }
    )
    return result


@router.post("/feedback")
async def submit_comfort_feedback(
    req: ComfortFeedbackRequest,
    user: dict[str, Any] | None = Depends(get_optional_user),
):
    """Mencatat umpan balik kenyamanan untuk mengkalibrasi prediksi ML pengguna."""
    user_id = user["user_id"] if user else None
    delta_c = RATING_DELTAS[req.rating]
    storage = get_storage()
    storage.create_comfort_feedback(
        user_id=user_id,
        outdoor_temp=req.outdoor_temp,
        humidity=req.humidity,
        mode=req.mode,
        predicted_setpoint=req.predicted_setpoint,
        rating=req.rating,
        delta_c=delta_c,
    )
    bias, count = storage.get_comfort_bias(user_id)
    await telemetry_manager.broadcast(
        {
            "type": "feedback",
            "rating": req.rating,
            "personal_bias_c": bias,
            "feedback_count": count,
        }
    )
    return {
        "status": "ok",
        "rating": req.rating,
        "personal_bias_c": bias,
        "feedback_count": count,
    }


@router.get("/feedback", response_model=ComfortFeedbackSummary)
def get_comfort_feedback(user: dict[str, Any] | None = Depends(get_optional_user)):
    user_id = user["user_id"] if user else None
    storage = get_storage()
    bias, count = storage.get_comfort_bias(user_id)
    recent = [
        ComfortFeedbackRecord(**row) for row in storage.list_comfort_feedback(user_id, limit=10)
    ]
    return ComfortFeedbackSummary(
        personal_bias_c=bias,
        feedback_count=count,
        recent=recent,
    )


@router.delete("/feedback")
def reset_comfort_feedback(user: dict[str, Any] | None = Depends(get_optional_user)):
    user_id = user["user_id"] if user else None
    get_storage().reset_comfort_feedback(user_id)
    return {"status": "reset", "personal_bias_c": 0.0, "feedback_count": 0}


@router.get("/model/info")
def get_model_info():
    """Metrik evaluasi dan perbandingan algoritma Machine Learning."""
    return ml_service.get_model_info()
