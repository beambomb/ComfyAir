"""End-to-end backend API, ML calibration, auth, persistence, and WebSocket tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.storage import reset_storage  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture()
def client(tmp_path: Path):
    reset_storage(db_path=tmp_path / "test_comfyair.db")
    with TestClient(app) as test_client:
        yield test_client


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_health_and_timing_header(client: TestClient):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert "x-process-time-ms" in res.headers
    body = res.json()
    assert body["status"] == "ok"
    assert body["ml_model_loaded"] is True
    assert body["ml_model_name"] == "GradientBoostingRegressor"
    assert body["storage_backend"] in ("SQLite Lokal", "Supabase PostgreSQL")


def test_model_info_and_benchmarks(client: TestClient):
    res = client.get("/api/v1/model/info")
    assert res.status_code == 200
    info = res.json()
    assert info["loaded"] is True
    assert info["test_r2"] > 0.90
    assert info["test_mae"] < 0.4
    assert len(info["benchmarks"]) == 4


def test_ml_prediction_humidity_and_mode_sensitivity(client: TestClient):
    dry_eco = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 30.0, "humidity": 40.0, "mode": "ECO", "hour": 2},
    )
    humid_comfort = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 30.0, "humidity": 95.0, "mode": "COMFORT", "hour": 14},
    )
    assert dry_eco.status_code == 200
    assert humid_comfort.status_code == 200

    p1 = dry_eco.json()
    p2 = humid_comfort.json()
    assert 22 <= p1["recommended_setpoint"] <= 27
    assert 22 <= p2["recommended_setpoint"] <= 27
    assert p1["model_used"] == "GradientBoostingRegressor"
    assert p2["heat_index_c"] > p1["heat_index_c"]
    assert p1["raw_predicted_temp"] > p2["raw_predicted_temp"]


def test_ml_comfort_feedback_calibration_and_reset(client: TestClient):
    base_res = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 26.0, "humidity": 85.0, "mode": "SLEEP", "hour": 17},
    )
    assert base_res.status_code == 200
    base_raw = base_res.json()["raw_predicted_temp"]
    assert base_res.json()["personal_bias_c"] == 0.0
    assert base_res.json()["feedback_count"] == 0

    fb1 = client.post(
        "/api/v1/feedback",
        json={
            "outdoor_temp": 26.0,
            "humidity": 85.0,
            "mode": "SLEEP",
            "predicted_setpoint": base_res.json()["recommended_setpoint"],
            "rating": "too_cold",
        },
    )
    assert fb1.status_code == 200
    assert fb1.json()["personal_bias_c"] > 0.0
    assert fb1.json()["feedback_count"] == 1

    calibrated_res = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 26.0, "humidity": 85.0, "mode": "SLEEP", "hour": 17},
    )
    assert calibrated_res.status_code == 200
    assert calibrated_res.json()["personal_bias_c"] == fb1.json()["personal_bias_c"]
    assert calibrated_res.json()["raw_predicted_temp"] > base_raw

    summary = client.get("/api/v1/feedback")
    assert summary.status_code == 200
    assert summary.json()["feedback_count"] == 1
    assert len(summary.json()["recent"]) == 1

    reset = client.delete("/api/v1/feedback")
    assert reset.status_code == 200
    assert reset.json()["personal_bias_c"] == 0.0
    assert reset.json()["feedback_count"] == 0


def test_auth_lifecycle_and_demo_account(client: TestClient):
    bad = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@comfyair.id", "password": "wrong-password"},
    )
    assert bad.status_code == 401

    demo_login = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@comfyair.id", "password": "comfyair123"},
    )
    assert demo_login.status_code == 200
    assert demo_login.json()["user"]["email"] == "demo@comfyair.id"

    reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Tester",
            "email": "tester@ugm.ac.id",
            "password": "password123",
        },
    )
    assert reg.status_code == 201
    tokens = reg.json()
    access = tokens["access_token"]
    refresh = tokens["refresh_token"]

    me = client.get("/api/v1/auth/me", headers=_auth_headers(access))
    assert me.status_code == 200
    assert me.json()["email"] == "tester@ugm.ac.id"

    assert client.get("/api/v1/auth/me").status_code == 401

    ref = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert ref.status_code == 200
    new_refresh = ref.json()["refresh_token"]
    assert new_refresh != refresh
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 401

    out = client.post("/api/v1/auth/logout", json={"refresh_token": new_refresh})
    assert out.status_code == 200
    assert (
        client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh}).status_code
        == 401
    )


def test_preferences_and_savings_logs(client: TestClient):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@comfyair.id", "password": "comfyair123"},
    )
    token = login.json()["access_token"]
    headers = _auth_headers(token)

    pref_get = client.get("/api/v1/preferences", headers=headers)
    assert pref_get.status_code == 200
    assert pref_get.json()["preferred_city"] == "Yogyakarta"

    pref_put = client.put(
        "/api/v1/preferences",
        headers=headers,
        json={"ac_power_pk": 1.5, "electricity_rate_per_kwh": 1699.5, "preferred_city": "Jakarta"},
    )
    assert pref_put.status_code == 200
    assert pref_put.json()["ac_power_pk"] == 1.5
    assert pref_put.json()["preferred_city"] == "Jakarta"

    created = client.post(
        "/api/v1/savings/logs",
        headers=headers,
        json={
            "nights": 30,
            "hours_per_night": 8,
            "ac_power_pk": 1.0,
            "electricity_rate_per_kwh": 1444.7,
            "setpoint": 27,
        },
    )
    assert created.status_code == 201
    log_id = created.json()["log_id"]
    assert created.json()["saved_cost_idr"] == 126209

    listed = client.get("/api/v1/savings/logs?period=monthly", headers=headers)
    assert listed.status_code == 200
    assert any(row["log_id"] == log_id for row in listed.json())

    deleted = client.delete(f"/api/v1/savings/logs/{log_id}", headers=headers)
    assert deleted.status_code == 200


def test_weather_cities_and_websocket_telemetry(client: TestClient):
    cities = client.get("/api/v1/weather/cities")
    assert cities.status_code == 200
    names = [c["name"] for c in cities.json()["cities"]]
    assert "Yogyakarta" in names and "Jakarta" in names

    bad_city = client.get("/api/v1/weather?city=Atlantis")
    assert bad_city.status_code == 404

    with client.websocket_connect("/api/v1/ws/telemetry") as ws:
        welcome = ws.receive_json()
        assert welcome["type"] == "welcome"
        ws.send_json({"type": "ping"})
        pong = ws.receive_json()
        assert pong["type"] == "pong"
