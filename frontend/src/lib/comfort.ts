// ComfyAir comfort math, shared by every part of the page.
//
// This file is a straight port of backend/app/services/ml_service.py
// (`_adaptive_fallback` plus the savings line in `predict_setpoint`). The page
// uses it when the FastAPI backend cannot be reached, so the operation order is
// kept identical to the Python code and float64 results match bit for bit.
//
// No imports on purpose: the module stays pure and can be checked in plain Node.

export const MODES = ["ECO", "SLEEP", "COMFORT"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABEL: Record<Mode, string> = {
  ECO: "Hemat",
  SLEEP: "Tidur",
  COMFORT: "Nyaman",
};

export const DEFAULT_MODE: Mode = "SLEEP";

/** ECO -> SLEEP -> COMFORT -> ECO, the order the MODE button cycles through. */
export function nextMode(mode: Mode): Mode {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}

// Input bounds for the sentence form. `sample` is shown when live weather is unavailable.
export const OUTDOOR = { min: 15, max: 40, step: 1, sample: 30 } as const;
export const HUMIDITY = { min: 30, max: 100, step: 5, sample: 75 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Live readings arrive as decimals (26.4); the form works in whole degrees. */
export function clampOutdoor(temp: number): number {
  return clamp(Math.round(temp), OUTDOOR.min, OUTDOOR.max);
}

/** Humidity is stepped by 5 % in the form, so live readings snap to that grid. */
export function snapHumidity(rh: number): number {
  return clamp(Math.round(rh / HUMIDITY.step) * HUMIDITY.step, HUMIDITY.min, HUMIDITY.max);
}

/**
 * Python 3 `round()`: round half to even. `x - floor(x)` is exact for these
 * magnitudes, so ties are detected exactly, like CPython does on the double.
 */
export function pythonRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

// Offsets from ml_service.py: ECO `base + 1.5`, SLEEP `base + 1.0`, else `base - 0.5`.
// Adding -0.5 is the same IEEE operation as subtracting 0.5.
const MODE_OFFSET: Record<Mode, number> = { ECO: 1.5, SLEEP: 1.0, COMFORT: -0.5 };

/**
 * Adaptive comfort fallback (ASHRAE 55 style), same as `_adaptive_fallback`:
 * base = 17.8 + 0.31 * outdoor, plus the mode offset, rounded half to even,
 * clamped to 22..27 and truncated to an int. Humidity is not used by the formula.
 */
export function adaptiveSetpoint(outdoorTemp: number, mode: Mode): number {
  const base = 17.8 + 0.31 * outdoorTemp;
  const target = base + MODE_OFFSET[mode];
  return Math.trunc(Math.max(22, Math.min(27, pythonRound(target))));
}

/**
 * Savings versus a 20 C habit, same as `max(0.0, (setpoint - 20) * 6.5)` then
 * `round(savings, 1)`. The setpoint is an int, so the value is a multiple of 0.5
 * and rounding through tenths gives exactly what Python returns.
 */
export function savingsPercent(setpoint: number): number {
  return Math.round(Math.max(0, (setpoint - 20) * 6.5) * 10) / 10;
}

export type RecommendationSource = "api" | "fallback";

export type Recommendation = {
  setpoint: number;
  savingsPercent: number;
  source: RecommendationSource;
};

/** What the backend would answer without a trained model, computed in the browser. */
export function localRecommendation(outdoorTemp: number, mode: Mode): Recommendation {
  const setpoint = adaptiveSetpoint(outdoorTemp, mode);
  return { setpoint, savingsPercent: savingsPercent(setpoint), source: "fallback" };
}

// Monthly bill simulation.
// Defaults from backend/schema.sql `user_preferences`:
//   ac_power_pk 1.0 (a 1 PK split AC draws roughly 0.8 kW),
//   electricity_rate_per_kwh 1444.70 (Rupiah per kWh).
// Usage assumption: 8 hours per night, 30 nights per month.
// Baseline habit: AC at 20 C, the same baseline ml_service.py uses for savings.
export const ENERGY = {
  acPowerKw: 0.8,
  hoursPerNight: 8,
  nightsPerMonth: 30,
  tariffPerKwh: 1444.7,
  baselineSetpoint: 20,
} as const;

// Daya AC options for the dashboard "Spesifikasi AC" panel. The kW figures match
// the ENERGY.acPowerKw convention (a 1 PK split AC draws roughly 0.8 kW).
export const AC_POWER_OPTIONS = [
  { label: "0,5 PK", kw: 0.4 },
  { label: "0,75 PK", kw: 0.6 },
  { label: "1 PK", kw: 0.8 },
  { label: "1,5 PK", kw: 1.2 },
  { label: "2 PK", kw: 1.6 },
] as const;

export type MonthlyBill = {
  baselineKwh: number;
  baselineRp: number;
  optimizedRp: number;
  savedRp: number;
};

/**
 * Energy bill for a given number of nights. `nights` defaults to the 30-night
 * month, so existing callers (the Presentasi receipt) keep their exact numbers.
 * The dashboard passes 1 / 7 / 30. One consistent rule: cost = kWh x tariff,
 * round the baseline and optimized lines, then subtract so the printed total
 * always adds up.
 */
export function monthlyBill(
  savingsPct: number,
  nights: number = ENERGY.nightsPerMonth,
  acPowerKw: number = ENERGY.acPowerKw,
  tariffPerKwh: number = ENERGY.tariffPerKwh,
): MonthlyBill {
  const kwh = acPowerKw * ENERGY.hoursPerNight * nights;
  // 192 kWh x Rp1.444,70 = Rp277.382,40 for the 30-night month at 20 C.
  const baselineCost = kwh * tariffPerKwh;
  const optimizedCost = baselineCost * (1 - savingsPct / 100);
  const baselineRp = Math.round(baselineCost);
  const optimizedRp = Math.round(optimizedCost);
  return {
    baselineKwh: kwh,
    baselineRp,
    optimizedRp,
    // Subtract the rounded lines so the printed receipt always adds up.
    savedRp: baselineRp - optimizedRp,
  };
}

// Decimal formatting only. `style: "currency"` inserts spacing characters that
// differ between ICU versions (Node prerender vs. the visitor's browser).
const rupiahNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const tariffNumber = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentNumber = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const kwhNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** 277382 -> "Rp277.382" */
export function formatRupiah(value: number): string {
  return `Rp${rupiahNumber.format(value)}`;
}

/** "Rp1.444,70" */
export function formatTariff(): string {
  return `Rp${tariffNumber.format(ENERGY.tariffPerKwh)}`;
}

/** 45.5 -> "45,5%" */
export function formatPercent(value: number): string {
  return `${percentNumber.format(value)}%`;
}

/** 192 -> "192 kWh" */
export function formatKwh(value: number): string {
  return `${kwhNumber.format(value)} kWh`;
}
