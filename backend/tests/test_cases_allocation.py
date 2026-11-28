"""Automated 24 test cases matching the Test Case Estimation & Allocation table."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.storage import reset_storage  
from app.services.weather_service import weather_service  
from main import app  


@pytest.fixture()
def client(tmp_path: Path):
    reset_storage(db_path=tmp_path / "test_comfyair_24.db")
    with TestClient(app) as test_client:
        yield test_client


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login_demo(client: TestClient) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@comfyair.id", "password": "comfyair123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


# 1. Prediksi Rekomendasi Suhu AC (ML) - 6 Test Cases


def test_tc01_predict_eco_normal_condition(client: TestClient):
    res = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 30.0, "humidity": 40.0, "mode": "ECO", "hour": 2},
    )
    assert res.status_code == 200
    body = res.json()
    assert 22 <= body["recommended_setpoint"] <= 27
    assert body["model_used"] == "GradientBoostingRegressor"


def test_tc02_predict_comfort_high_humidity(client: TestClient):
    dry = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 30.0, "humidity": 40.0, "mode": "ECO", "hour": 2},
    ).json()
    humid = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 30.0, "humidity": 95.0, "mode": "COMFORT", "hour": 14},
    )
    assert humid.status_code == 200
    body = humid.json()
    assert body["heat_index_c"] > dry["heat_index_c"]
    assert body["raw_predicted_temp"] < dry["raw_predicted_temp"]


def test_tc03_predict_sleep_night_mode(client: TestClient):
    res = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 26.0, "humidity": 85.0, "mode": "SLEEP", "hour": 23},
    )
    assert res.status_code == 200
    body = res.json()
    assert 22 <= body["recommended_setpoint"] <= 27
    assert body["estimated_savings_percent"] >= 0


def test_tc04_model_info_and_benchmarks(client: TestClient):
    res = client.get("/api/v1/model/info")
    assert res.status_code == 200
    info = res.json()
    assert info["loaded"] is True
    assert info["test_r2"] > 0.90
    assert info["test_mae"] < 0.4
    assert len(info["benchmarks"]) == 4


def test_tc05_predict_invalid_payload_returns_422(client: TestClient):
    res = client.post(
        "/api/v1/predict",
        json={"outdoor_temp": 100.0, "humidity": 150.0, "mode": "TURBO", "hour": 25},
    )
    assert res.status_code == 422


def test_tc06_predict_with_authenticated_personal_bias(client: TestClient):
    token = _login_demo(client)
    headers = _auth_headers(token)
    base = client.post(
        "/api/v1/predict",
        headers=headers,
        json={"outdoor_temp": 28.0, "humidity": 80.0, "mode": "SLEEP", "hour": 22},
    ).json()
    client.post(
        "/api/v1/feedback",
        headers=headers,
        json={
            "outdoor_temp": 28.0,
            "humidity": 80.0,
            "mode": "SLEEP",
            "predicted_setpoint": base["recommended_setpoint"],
            "rating": "too_cold",
        },
    )
    calibrated = client.post(
        "/api/v1/predict",
        headers=headers,
        json={"outdoor_temp": 28.0, "humidity": 80.0, "mode": "SLEEP", "hour": 22},
    )
    assert calibrated.status_code == 200
    assert calibrated.json()["personal_bias_c"] > 0.0
    assert calibrated.json()["raw_predicted_temp"] > base["raw_predicted_temp"]


# 2. Autentikasi Pengguna (Register, Login, Refresh, Logout) - 5 Test Cases


def test_tc07_auth_register_new_user(client: TestClient):
    res = client.post(
        "/api/v1/auth/register",
        json={"name": "Tester", "email": "tester@ugm.ac.id", "password": "password123"},
    )
    assert res.status_code == 201
    body = res.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["user"]["email"] == "tester@ugm.ac.id"


def test_tc08_auth_login_valid_demo(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@comfyair.id", "password": "comfyair123"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "demo@comfyair.id"


def test_tc09_auth_login_wrong_password(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@comfyair.id", "password": "wrong-password"},
    )
    assert res.status_code == 401


def test_tc10_auth_me_protected_route(client: TestClient):
    assert client.get("/api/v1/auth/me").status_code == 401
    token = _login_demo(client)
    me = client.get("/api/v1/auth/me", headers=_auth_headers(token))
    assert me.status_code == 200
    assert me.json()["email"] == "demo@comfyair.id"


def test_tc11_auth_refresh_rotation_and_logout(client: TestClient):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@comfyair.id", "password": "comfyair123"},
    ).json()
    refresh = login["refresh_token"]
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


# 3. Kalkulasi, Filter & Pencatatan Penghematan Listrik - 4 Test Cases


def test_tc12_savings_create_log_calculation(client: TestClient):
    headers = _auth_headers(_login_demo(client))
    res = client.post(
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
    assert res.status_code == 201
    assert res.json()["saved_cost_idr"] == 126209


def test_tc13_savings_filter_by_period(client: TestClient):
    headers = _auth_headers(_login_demo(client))
    created = client.post(
        "/api/v1/savings/logs",
        headers=headers,
        json={
            "nights": 7,
            "hours_per_night": 8,
            "ac_power_pk": 1.0,
            "electricity_rate_per_kwh": 1444.7,
            "setpoint": 26,
        },
    )
    log_id = created.json()["log_id"]
    for period in ("daily", "weekly", "monthly"):
        res = client.get(f"/api/v1/savings/logs?period={period}", headers=headers)
        assert res.status_code == 200
        assert any(row["log_id"] == log_id for row in res.json())


def test_tc14_savings_delete_log(client: TestClient):
    headers = _auth_headers(_login_demo(client))
    created = client.post(
        "/api/v1/savings/logs",
        headers=headers,
        json={
            "nights": 1,
            "hours_per_night": 8,
            "ac_power_pk": 1.0,
            "electricity_rate_per_kwh": 1444.7,
            "setpoint": 25,
        },
    )
    log_id = created.json()["log_id"]
    deleted = client.delete(f"/api/v1/savings/logs/{log_id}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"


def test_tc15_savings_unauthorized_and_not_found(client: TestClient):
    assert client.get("/api/v1/savings/logs").status_code == 401
    headers = _auth_headers(_login_demo(client))
    res = client.delete("/api/v1/savings/logs/nonexistent-id", headers=headers)
    assert res.status_code == 404


# 4. Kalibrasi Umpan Balik Kenyamanan (Feedback ML) - 3 Test Cases


def test_tc16_feedback_too_cold_increases_bias(client: TestClient):
    res = client.post(
        "/api/v1/feedback",
        json={
            "outdoor_temp": 29.0,
            "humidity": 80.0,
            "mode": "ECO",
            "predicted_setpoint": 24,
            "rating": "too_cold",
        },
    )
    assert res.status_code == 200
    assert res.json()["personal_bias_c"] > 0.0
    assert res.json()["feedback_count"] == 1


def test_tc17_feedback_too_warm_decreases_bias_and_lists_recent(client: TestClient):
    res = client.post(
        "/api/v1/feedback",
        json={
            "outdoor_temp": 31.0,
            "humidity": 75.0,
            "mode": "COMFORT",
            "predicted_setpoint": 25,
            "rating": "too_warm",
        },
    )
    assert res.status_code == 200
    assert res.json()["personal_bias_c"] < 0.0
    summary = client.get("/api/v1/feedback")
    assert summary.status_code == 200
    assert summary.json()["feedback_count"] == 1
    assert summary.json()["recent"][0]["rating"] == "too_warm"


def test_tc18_feedback_reset_clears_bias(client: TestClient):
    client.post(
        "/api/v1/feedback",
        json={
            "outdoor_temp": 30.0,
            "humidity": 75.0,
            "mode": "SLEEP",
            "predicted_setpoint": 24,
            "rating": "too_cold",
        },
    )
    reset = client.delete("/api/v1/feedback")
    assert reset.status_code == 200
    assert reset.json()["personal_bias_c"] == 0.0
    assert reset.json()["feedback_count"] == 0


# 5. Pengambilan Data Cuaca Real-Time Multi-Kota - 3 Test Cases


def test_tc19_weather_list_supported_cities(client: TestClient):
    res = client.get("/api/v1/weather/cities")
    assert res.status_code == 200
    names = [c["name"] for c in res.json()["cities"]]
    assert "Yogyakarta" in names and "Jakarta" in names


def test_tc20_weather_get_valid_city(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    mock_snapshot = {
        "city": "Yogyakarta",
        "temp": 30.2,
        "humidity": 76.0,
        "observed_at": "2026-11-28T02:00:00Z",
        "source": "open-meteo",
        "upstream_latency_ms": 42.5,
    }
    monkeypatch.setattr(weather_service, "get_weather", AsyncMock(return_value=mock_snapshot))
    res = client.get("/api/v1/weather?city=Yogyakarta")
    assert res.status_code == 200
    assert res.json()["city"] == "Yogyakarta"
    assert res.json()["temp"] == 30.2


def test_tc21_weather_unsupported_city_returns_404(client: TestClient):
    res = client.get("/api/v1/weather?city=Atlantis")
    assert res.status_code == 404


# 6. Pengelolaan Profil & Preferensi AC - 2 Test Cases


def test_tc22_preferences_get_default(client: TestClient):
    headers = _auth_headers(_login_demo(client))
    res = client.get("/api/v1/preferences", headers=headers)
    assert res.status_code == 200
    assert res.json()["preferred_city"] == "Yogyakarta"


def test_tc23_preferences_update_profile(client: TestClient):
    headers = _auth_headers(_login_demo(client))
    res = client.put(
        "/api/v1/preferences",
        headers=headers,
        json={
            "ac_power_pk": 1.5,
            "electricity_rate_per_kwh": 1699.5,
            "preferred_city": "Jakarta",
        },
    )
    assert res.status_code == 200
    assert res.json()["ac_power_pk"] == 1.5
    assert res.json()["preferred_city"] == "Jakarta"


# 7. Diagnostik Sistem & Telemetri WebSocket - 1 Test Case

def test_tc24_health_and_websocket_telemetry(client: TestClient):
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert "x-process-time-ms" in health.headers
    assert health.json()["status"] == "ok"

    with client.websocket_connect("/api/v1/ws/telemetry") as ws:
        welcome = ws.receive_json()
        assert welcome["type"] == "welcome"
        ws.send_json({"type": "ping"})
        pong = ws.receive_json()
        assert pong["type"] == "pong"
