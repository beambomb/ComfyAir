"""ML inference service with trained scikit-learn model and adaptive user calibration."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.core.storage import get_storage
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.thermal import (
    FEATURE_NAMES,
    adaptive_fallback_setpoint,
    build_feature_vector,
    compute_heat_index_c,
)

MODELS_DIR = Path(__file__).resolve().parents[2] / "ml_models"
MODEL_PATH = MODELS_DIR / "comfyair_model.pkl"
METADATA_PATH = MODELS_DIR / "model_metadata.json"
WIB = timezone(timedelta(hours=7))

MODE_DESCRIPTIONS = {
    "ECO": "Efisiensi energi optimal dengan beban kompresor minimal",
    "SLEEP": "Stabil menyesuaikan penurunan suhu tubuh saat tidur",
    "COMFORT": "Fokus pada kenyamanan termal dan pendinginan cepat",
}


class MLService:
    def __init__(self) -> None:
        self.model: Any = None
        self.metadata: dict[str, Any] = {}
        self._load_artifacts()

    def _load_artifacts(self) -> None:
        if MODEL_PATH.exists():
            try:
                self.model = joblib.load(MODEL_PATH)
            except Exception as exc:
                print(f"[MLService] Gagal memuat model .pkl: {exc}")
                self.model = None

        if METADATA_PATH.exists():
            try:
                self.metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
            except Exception as exc:
                print(f"[MLService] Gagal memuat model_metadata.json: {exc}")
                self.metadata = {}

    def get_model_info(self) -> dict[str, Any]:
        return {
            "loaded": self.model is not None,
            "model_name": self.metadata.get("model_name", "ASHRAE 55 Fallback"),
            "version": self.metadata.get("version", "2.0.0"),
            "trained_at": self.metadata.get("trained_at"),
            "dataset_size": self.metadata.get("dataset_size", 0),
            "train_size": self.metadata.get("train_size", 0),
            "test_size": self.metadata.get("test_size", 0),
            "features": self.metadata.get("features", FEATURE_NAMES),
            "cv_r2_mean": self.metadata.get("cv_r2_mean"),
            "cv_r2_std": self.metadata.get("cv_r2_std"),
            "test_r2": self.metadata.get("test_r2"),
            "test_mae": self.metadata.get("test_mae"),
            "test_rmse": self.metadata.get("test_rmse"),
            "feature_importances": self.metadata.get("feature_importances", {}),
            "benchmarks": self.metadata.get("benchmarks", []),
        }

    def predict_setpoint(
        self, req: PredictionRequest, user_id: str | None = None
    ) -> PredictionResponse:
        hour = req.hour if req.hour is not None else datetime.now(WIB).hour
        heat_index = compute_heat_index_c(req.outdoor_temp, req.humidity)

        model_used = self.metadata.get("model_name", "GradientBoostingRegressor")
        model_r2 = self.metadata.get("test_r2")

        target_user = user_id or req.user_id
        try:
            personal_bias_c, feedback_count = get_storage().get_comfort_bias(target_user)
        except Exception:
            personal_bias_c, feedback_count = (0.0, 0)

        if self.model is not None:
            try:
                features = build_feature_vector(
                    outdoor_temp=req.outdoor_temp,
                    humidity=req.humidity,
                    hour=hour,
                    mode=req.mode,
                    ac_power_pk=req.ac_power_pk,
                )
                raw_pred = float(
                    self.model.predict(np.asarray([features], dtype=np.float64))[0]
                )
            except Exception:
                raw_pred = float(
                    adaptive_fallback_setpoint(req.outdoor_temp, req.humidity, req.mode)
                )
                model_used = "ASHRAE 55 Fallback"
                model_r2 = None
        else:
            raw_pred = float(
                adaptive_fallback_setpoint(req.outdoor_temp, req.humidity, req.mode)
            )
            model_used = "ASHRAE 55 Fallback"
            model_r2 = None

        calibrated_pred = raw_pred + personal_bias_c
        setpoint = int(max(22, min(27, round(calibrated_pred))))
        savings = max(0.0, (setpoint - 20) * 6.5)

        try:
            get_storage().log_recommendation(
                user_id=target_user,
                recommended_setpoint=setpoint,
                mode=req.mode,
            )
        except Exception:
            pass

        return PredictionResponse(
            recommended_setpoint=setpoint,
            raw_predicted_temp=round(calibrated_pred, 2),
            heat_index_c=heat_index,
            mode=req.mode,
            comfort_description=MODE_DESCRIPTIONS.get(req.mode, "Mode normal"),
            estimated_savings_percent=round(savings, 1),
            model_used=model_used,
            model_r2=model_r2,
            personal_bias_c=personal_bias_c,
            feedback_count=feedback_count,
        )


ml_service = MLService()
