from fastapi import APIRouter
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.ml_service import ml_service

router = APIRouter(tags=["Prediction"])


@router.post("/predict", response_model=PredictionResponse)
def predict_ac_setpoint(req: PredictionRequest):
    """Menghitung rekomendasi suhu AC dinamis via Machine Learning"""
    return ml_service.predict_setpoint(req)
