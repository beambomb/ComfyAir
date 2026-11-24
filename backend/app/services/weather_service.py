"""Server-side Open-Meteo HTTPS weather client with TTL caching across 8 Indonesian cities."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.storage import get_storage

WIB = timezone(timedelta(hours=7))
CACHE_TTL_SECONDS = 600.0

CITIES: list[dict[str, Any]] = [
    {"name": "Yogyakarta", "latitude": -7.7956, "longitude": 110.3695, "timezone": "Asia/Jakarta"},
    {"name": "Jakarta", "latitude": -6.2088, "longitude": 106.8456, "timezone": "Asia/Jakarta"},
    {"name": "Surabaya", "latitude": -7.2575, "longitude": 112.7521, "timezone": "Asia/Jakarta"},
    {"name": "Bandung", "latitude": -6.9175, "longitude": 107.6191, "timezone": "Asia/Jakarta"},
    {"name": "Semarang", "latitude": -6.9667, "longitude": 110.4167, "timezone": "Asia/Jakarta"},
    {"name": "Denpasar", "latitude": -8.6500, "longitude": 115.2167, "timezone": "Asia/Jakarta"},
    {"name": "Medan", "latitude": 3.5952, "longitude": 98.6722, "timezone": "Asia/Jakarta"},
    {"name": "Makassar", "latitude": -5.1477, "longitude": 119.4327, "timezone": "Asia/Jakarta"},
]

_CITY_MAP = {c["name"].lower(): c for c in CITIES}


class WeatherService:
    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}

    @property
    def cache_size(self) -> int:
        return len(self._cache)

    def list_cities(self) -> list[dict[str, Any]]:
        return CITIES

    def resolve_city(self, name: str) -> dict[str, Any] | None:
        return _CITY_MAP.get(name.strip().lower())

    @staticmethod
    def _sample_snapshot(city: dict[str, Any]) -> dict[str, Any]:
        now_wib = datetime.now(WIB)
        return {
            "city": city["name"],
            "latitude": city["latitude"],
            "longitude": city["longitude"],
            "timezone": city["timezone"],
            "temp": 30.0,
            "humidity": 75.0,
            "observed_at": now_wib.strftime("%H.%M"),
            "source": "sample",
            "upstream_latency_ms": None,
        }

    async def get_weather(self, city_name: str = "Yogyakarta") -> dict[str, Any] | None:
        city = self.resolve_city(city_name)
        if city is None:
            return None

        key = city["name"].lower()
        cached = self._cache.get(key)
        now_mono = time.monotonic()
        if cached is not None and (now_mono - cached[0]) < CACHE_TTL_SECONDS:
            return {**cached[1], "source": "cache"}

        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={city['latitude']}&longitude={city['longitude']}"
            "&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FJakarta"
        )
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
            latency_ms = round((time.perf_counter() - start) * 1000.0, 1)

            current = data["current"]
            temp = float(current["temperature_2m"])
            humidity = float(current["relative_humidity_2m"])
            observed_at = str(current["time"])[11:16].replace(":", ".")

            snapshot = {
                "city": city["name"],
                "latitude": city["latitude"],
                "longitude": city["longitude"],
                "timezone": city["timezone"],
                "temp": temp,
                "humidity": humidity,
                "observed_at": observed_at,
                "source": "open-meteo",
                "upstream_latency_ms": latency_ms,
            }
            self._cache[key] = (now_mono, snapshot)
            try:
                get_storage().log_weather(city["name"], temp, humidity, "Open-Meteo")
            except Exception:
                pass
            return snapshot
        except Exception:
            if cached is not None:
                return {**cached[1], "source": "cache"}
            return self._sample_snapshot(city)


weather_service = WeatherService()
