// ComfyAir comfort math, shared across the dashboard, sleep curve, and savings views.
// Matches backend/app/services/thermal.py when the backend API is unreachable.

export const MODES = ["ECO", "SLEEP", "COMFORT"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABEL: Record<Mode, string> = {
  ECO: "Hemat",
  SLEEP: "Tidur",
  COMFORT: "Nyaman",
};

export const DEFAULT_MODE: Mode = "SLEEP";

export const PERIODS = [
  { id: "daily", label: "Harian", nights: 1 },
  { id: "weekly", label: "Mingguan", nights: 7 },
  { id: "monthly", label: "Bulanan", nights: 30 },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

export const OUTDOOR = { min: 15, max: 40, step: 1, sample: 30 } as const;
export const HUMIDITY = { min: 30, max: 100, step: 5, sample: 75 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampOutdoor(temp: number): number {
  return clamp(Math.round(temp), OUTDOOR.min, OUTDOOR.max);
}

export function snapHumidity(rh: number): number {
  return clamp(Math.round(rh / HUMIDITY.step) * HUMIDITY.step, HUMIDITY.min, HUMIDITY.max);
}

export function pythonRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function computeHeatIndexC(tempC: number, humidity: number): number {
  const rh = clamp(humidity, 0, 100);
  const tempF = (tempC * 9) / 5 + 32;
  let hiF = 0.5 * (tempF + 61 + (tempF - 68) * 1.2 + rh * 0.094);
  if ((hiF + tempF) / 2 >= 80) {
    hiF =
      -42.379 +
      2.04901523 * tempF +
      10.14333127 * rh -
      0.22475541 * tempF * rh -
      0.00683783 * tempF * tempF -
      0.05481717 * rh * rh +
      0.00122874 * tempF * tempF * rh +
      0.00085282 * tempF * rh * rh -
      0.00000199 * tempF * tempF * rh * rh;
    if (rh < 13 && tempF >= 80 && tempF <= 112) {
      hiF -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17);
    } else if (rh > 85 && tempF >= 80 && tempF <= 87) {
      hiF += ((rh - 85) / 10) * ((87 - tempF) / 5);
    }
  }
  return Math.round((((hiF - 32) * 5) / 9) * 10) / 10;
}

const MODE_OFFSET: Record<Mode, number> = { ECO: 1.5, SLEEP: 1.0, COMFORT: -0.5 };

export function adaptiveSetpoint(outdoorTemp: number, mode: Mode, humidity: number = HUMIDITY.sample): number {
  const base = 17.8 + 0.31 * outdoorTemp;
  const humidityAdj = -0.025 * Math.max(0, humidity - 65);
  const target = base + humidityAdj + MODE_OFFSET[mode];
  return Math.trunc(Math.max(22, Math.min(27, pythonRound(target))));
}

export function savingsPercent(setpoint: number): number {
  return Math.round(Math.max(0, (setpoint - 20) * 6.5) * 10) / 10;
}

export type RecommendationSource = "api" | "fallback";

export type Recommendation = {
  setpoint: number;
  savingsPercent: number;
  source: RecommendationSource;
  heatIndexC: number;
  rawPredictedTemp?: number;
  modelUsed: string;
  modelR2?: number | null;
};

export function localRecommendation(
  outdoorTemp: number,
  mode: Mode,
  humidity: number = HUMIDITY.sample,
): Recommendation {
  const setpoint = adaptiveSetpoint(outdoorTemp, mode, humidity);
  return {
    setpoint,
    savingsPercent: savingsPercent(setpoint),
    source: "fallback",
    heatIndexC: computeHeatIndexC(outdoorTemp, humidity),
    modelUsed: "ASHRAE 55 Lokal",
    modelR2: null,
  };
}

export const ENERGY = {
  acPowerKw: 0.8,
  hoursPerNight: 8,
  nightsPerMonth: 30,
  tariffPerKwh: 1444.7,
  baselineSetpoint: 20,
} as const;

export const AC_POWER_OPTIONS = [
  { label: "0,5 PK", pk: 0.5, kw: 0.4 },
  { label: "0,75 PK", pk: 0.75, kw: 0.6 },
  { label: "1 PK", pk: 1.0, kw: 0.8 },
  { label: "1,5 PK", pk: 1.5, kw: 1.2 },
  { label: "2 PK", pk: 2.0, kw: 1.6 },
] as const;

export type MonthlyBill = {
  baselineKwh: number;
  optimizedKwh: number;
  baselineRp: number;
  optimizedRp: number;
  savedRp: number;
};

export function monthlyBill(
  savingsPct: number,
  nights: number = ENERGY.nightsPerMonth,
  acPowerKw: number = ENERGY.acPowerKw,
  tariffPerKwh: number = ENERGY.tariffPerKwh,
  hoursPerNight: number = ENERGY.hoursPerNight,
): MonthlyBill {
  const kwh = acPowerKw * hoursPerNight * nights;
  const optimizedKwh = kwh * (1 - savingsPct / 100);
  const baselineCost = kwh * tariffPerKwh;
  const optimizedCost = optimizedKwh * tariffPerKwh;
  const baselineRp = Math.round(baselineCost);
  const optimizedRp = Math.round(optimizedCost);
  return {
    baselineKwh: kwh,
    optimizedKwh,
    baselineRp,
    optimizedRp,
    savedRp: baselineRp - optimizedRp,
  };
}

const rupiahNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const percentNumber = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const kwhNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export function formatRupiah(value: number): string {
  return `Rp${rupiahNumber.format(value)}`;
}

export function formatPercent(value: number): string {
  return `${percentNumber.format(value)}%`;
}

export function formatKwh(value: number): string {
  return `${kwhNumber.format(value)} kWh`;
}
