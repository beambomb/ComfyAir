"""Shared thermal comfort feature engineering and ASHRAE 55 fallback math."""

import math
from typing import List

MODE_ENCODING = {"ECO": 0, "SLEEP": 1, "COMFORT": 2}

FEATURE_NAMES = [
    "outdoor_temp",
    "humidity",
    "hour",
    "mode_encoded",
    "heat_index_c",
    "ac_power_pk",
]


def compute_heat_index_c(temp_c: float, humidity: float) -> float:
    """Compute NOAA/Rothfusz heat index in degrees Celsius."""
    rh = max(0.0, min(100.0, float(humidity)))
    temp_f = float(temp_c) * 9.0 / 5.0 + 32.0

    # Steadman simple approximation first; escalate to Rothfusz above 80 F.
    hi_f = 0.5 * (temp_f + 61.0 + (temp_f - 68.0) * 1.2 + rh * 0.094)
    if (hi_f + temp_f) / 2.0 >= 80.0:
        hi_f = (
            -42.379
            + 2.04901523 * temp_f
            + 10.14333127 * rh
            - 0.22475541 * temp_f * rh
            - 0.00683783 * temp_f * temp_f
            - 0.05481717 * rh * rh
            + 0.00122874 * temp_f * temp_f * rh
            + 0.00085282 * temp_f * rh * rh
            - 0.00000199 * temp_f * temp_f * rh * rh
        )
        if rh < 13.0 and 80.0 <= temp_f <= 112.0:
            hi_f -= ((13.0 - rh) / 4.0) * math.sqrt((17.0 - abs(temp_f - 95.0)) / 17.0)
        elif rh > 85.0 and 80.0 <= temp_f <= 87.0:
            hi_f += ((rh - 85.0) / 10.0) * ((87.0 - temp_f) / 5.0)

    return round((hi_f - 32.0) * 5.0 / 9.0, 2)


def build_feature_vector(
    outdoor_temp: float,
    humidity: float,
    hour: int,
    mode: str,
    ac_power_pk: float = 1.0,
) -> List[float]:
    """Build ordered ML feature vector aligned between training and inference."""
    mode_code = float(MODE_ENCODING.get(mode, 1))
    clamped_hour = float(max(0, min(23, int(hour))))
    heat_index = compute_heat_index_c(outdoor_temp, humidity)
    return [
        float(outdoor_temp),
        float(humidity),
        clamped_hour,
        mode_code,
        heat_index,
        float(ac_power_pk),
    ]


def adaptive_fallback_setpoint(outdoor_temp: float, humidity: float, mode: str) -> int:
    """ASHRAE 55 adaptive comfort fallback with tropical humidity compensation."""
    base = 17.8 + (0.31 * outdoor_temp)
    humidity_adj = -0.025 * max(0.0, humidity - 65.0)
    if mode == "ECO":
        target = base + humidity_adj + 1.5
    elif mode == "SLEEP":
        target = base + humidity_adj + 1.0
    else:
        target = base + humidity_adj - 0.5
    return int(max(22, min(27, round(target))))
