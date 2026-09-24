import os
import joblib
from app.schemas.prediction import PredictionRequest, PredictionResponse

MODEL_PATH = os.path.join(os.path.dirname(__file__), "../../ml_models/comfyair_model.pkl")


class MLService:
    def __init__(self):
        self.model = None
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                print("[MLService] Model .pkl berhasil dimuat!")
            except Exception as e:
                print(f"[MLService] Gagal memuat model .pkl: {e}")

    def predict_setpoint(self, req: PredictionRequest) -> PredictionResponse:
        # 1. Jika model .pkl ada hasil training notebook, jalankan model.predict
        if self.model is not None:
            try:
                val = self.model.predict([[req.outdoor_temp, req.humidity]])
                setpoint = int(round(float(val[0])))
            except Exception:
                setpoint = self._adaptive_fallback(req.outdoor_temp, req.humidity, req.mode)
        else:
            # 2. Fallback cerdas: Formula Standar Kenyamanan Termal ASHRAE 55
            setpoint = self._adaptive_fallback(req.outdoor_temp, req.humidity, req.mode)

        # Hitung estimasi penghematan dibanding baseline AC konvensional (20°C)
        savings = max(0.0, (setpoint - 20) * 6.5)

        descriptions = {
            "ECO": "Optimal efisiensi energi dengan beban kompresor minimal",
            "SLEEP": "Stabil menyesuaikan penurunan suhu tubuh manusia",
            "COMFORT": "Fokus pada kenyamanan termal cepat"
        }

        return PredictionResponse(
            recommended_setpoint=setpoint,
            mode=req.mode,
            comfort_description=descriptions.get(req.mode, "Mode normal"),
            estimated_savings_percent=round(savings, 1)
        )

    def _adaptive_fallback(self, temp: float, hum: float, mode: str) -> int:
        base = 17.8 + (0.31 * temp)  # Model kenyamanan termal adaptif
        if mode == "ECO":
            target = base + 1.5
        elif mode == "SLEEP":
            target = base + 1.0
        else:
            target = base - 0.5
        return int(max(22, min(27, round(target))))


ml_service = MLService()
