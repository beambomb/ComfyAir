"""Reproducible ML training and benchmarking pipeline for ComfyAir."""

from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.thermal import (  # noqa: E402
    FEATURE_NAMES,
    MODE_ENCODING,
    build_feature_vector,
    compute_heat_index_c,
)

DATASET_PATH = Path(__file__).resolve().parent / "dataset.csv"
MODELS_DIR = BACKEND_DIR / "ml_models"
MODEL_PATH = MODELS_DIR / "comfyair_model.pkl"
METADATA_PATH = MODELS_DIR / "model_metadata.json"

MODES = ("ECO", "SLEEP", "COMFORT")
PK_OPTIONS = (0.5, 0.75, 1.0, 1.5, 2.0)


def _circadian_offset(hour: int) -> float:
    """Physiological thermal comfort offset by hour of day."""
    if 0 <= hour <= 5:
        return 0.85
    if hour in (22, 23, 6):
        return 0.35
    if 12 <= hour <= 16:
        return -0.35
    return 0.0


def generate_dataset(n_samples: int = 2400, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Generate tropical Indonesian residential AC thermal comfort dataset."""
    rng = np.random.default_rng(seed)
    rows: list[list[float | int | str]] = []
    X_list: list[list[float]] = []
    y_list: list[float] = []

    mode_offsets = {"ECO": 1.5, "SLEEP": 0.9, "COMFORT": -0.6}

    for _ in range(n_samples):
        outdoor_temp = round(float(rng.uniform(18.0, 40.0)), 1)
        humidity = round(float(rng.uniform(35.0, 98.0)), 1)
        hour = int(rng.integers(0, 24))
        mode = str(rng.choice(MODES))
        ac_power_pk = float(rng.choice(PK_OPTIONS))

        heat_index = compute_heat_index_c(outdoor_temp, humidity)
        ashrae_base = 17.8 + 0.31 * outdoor_temp
        hi_strain = -0.055 * max(0.0, heat_index - outdoor_temp)
        rh_strain = -0.015 * max(0.0, humidity - 70.0)
        circadian = _circadian_offset(hour)
        pk_adj = -0.15 * (ac_power_pk - 1.0)
        noise = float(rng.normal(0.0, 0.22))

        raw_target = (
            ashrae_base
            + hi_strain
            + rh_strain
            + circadian
            + mode_offsets[mode]
            + pk_adj
            + noise
        )
        target = round(float(np.clip(raw_target, 21.5, 27.4)), 2)

        features = build_feature_vector(
            outdoor_temp=outdoor_temp,
            humidity=humidity,
            hour=hour,
            mode=mode,
            ac_power_pk=ac_power_pk,
        )
        X_list.append(features)
        y_list.append(target)
        rows.append(
            [
                outdoor_temp,
                humidity,
                hour,
                mode,
                MODE_ENCODING[mode],
                heat_index,
                ac_power_pk,
                target,
            ]
        )

    DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DATASET_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "outdoor_temp",
                "humidity",
                "hour",
                "mode",
                "mode_encoded",
                "heat_index_c",
                "ac_power_pk",
                "target_setpoint",
            ]
        )
        writer.writerows(rows)

    return np.array(X_list, dtype=np.float64), np.array(y_list, dtype=np.float64)


def _extract_feature_importances(pipeline: Pipeline) -> dict[str, float]:
    model = pipeline.named_steps["model"]
    if hasattr(model, "feature_importances_"):
        raw = np.asarray(model.feature_importances_, dtype=np.float64)
    elif hasattr(model, "coef_"):
        raw = np.abs(np.asarray(model.coef_, dtype=np.float64))
    else:
        raw = np.ones(len(FEATURE_NAMES), dtype=np.float64)

    total = float(raw.sum()) or 1.0
    return {
        name: round(float(val / total), 4)
        for name, val in zip(FEATURE_NAMES, raw, strict=True)
    }


def train_and_evaluate() -> dict:
    """Train candidate models, evaluate on CV + holdout split, and export best artifact."""
    X, y = generate_dataset(n_samples=2400, seed=42)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    candidates = {
        "LinearRegression": LinearRegression(),
        "Ridge": Ridge(alpha=1.0),
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=150, max_depth=12, random_state=42, n_jobs=-1
        ),
        "GradientBoostingRegressor": GradientBoostingRegressor(
            n_estimators=180, max_depth=4, learning_rate=0.06, random_state=42
        ),
    }

    benchmarks: list[dict] = []
    trained_pipelines: dict[str, Pipeline] = {}

    for name, estimator in candidates.items():
        pipe = Pipeline([("scaler", StandardScaler()), ("model", estimator)])
        cv_scores = cross_val_score(pipe, X_train, y_train, cv=5, scoring="r2")
        pipe.fit(X_train, y_train)
        preds = pipe.predict(X_test)

        entry = {
            "model_name": name,
            "cv_r2_mean": round(float(cv_scores.mean()), 4),
            "cv_r2_std": round(float(cv_scores.std()), 4),
            "test_r2": round(float(r2_score(y_test, preds)), 4),
            "test_mae": round(float(mean_absolute_error(y_test, preds)), 4),
            "test_rmse": round(float(root_mean_squared_error(y_test, preds)), 4),
        }
        benchmarks.append(entry)
        trained_pipelines[name] = pipe

    benchmarks.sort(key=lambda item: item["test_rmse"])
    best = benchmarks[0]
    best_name = best["model_name"]
    best_pipeline = trained_pipelines[best_name]

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_pipeline, MODEL_PATH)

    metadata = {
        "model_name": best_name,
        "version": "2.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_size": int(len(X)),
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "features": FEATURE_NAMES,
        "cv_r2_mean": best["cv_r2_mean"],
        "cv_r2_std": best["cv_r2_std"],
        "test_r2": best["test_r2"],
        "test_mae": best["test_mae"],
        "test_rmse": best["test_rmse"],
        "feature_importances": _extract_feature_importances(best_pipeline),
        "benchmarks": benchmarks,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


if __name__ == "__main__":
    summary = train_and_evaluate()
    print(json.dumps(summary, indent=2))
