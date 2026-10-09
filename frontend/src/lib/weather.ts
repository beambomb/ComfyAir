import { fetchJson } from "./http";

// Current conditions for Yogyakarta. Open-Meteo answers in local Jakarta time
// (e.g. "2026-10-03T20:15") and refreshes the current block every 15 minutes.
export const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-7.7956&longitude=110.3695" +
  "&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FJakarta";

// Current conditions plus an hourly outdoor line that spans yesterday evening to
// tomorrow morning, so the dashboard can draw tonight's 21.00-07.00 window
// whatever the current hour is. One request keeps the single network round-trip.
export const OPEN_METEO_HOURLY_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-7.7956&longitude=110.3695" +
  "&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m" +
  "&past_days=1&forecast_days=2&timezone=Asia%2FJakarta";

export type CurrentWeather = {
  temp: number;
  humidity: number;
  /** Observation time as printed on the page, "20.15". */
  observedAt: string;
};

/** One hourly reading. `time` is the Open-Meteo wall-clock string, "2026-10-03T21:00". */
export type HourlyPoint = { time: string; temp: number };

export type WeatherSnapshot = CurrentWeather & { hourly: HourlyPoint[] };

function readCurrent(data: unknown): CurrentWeather {
  const current =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).current : null;
  if (typeof current !== "object" || current === null) throw new Error("Missing current block");

  const {
    temperature_2m: temp,
    relative_humidity_2m: humidity,
    time,
  } = current as Record<string, unknown>;

  if (typeof temp !== "number" || !Number.isFinite(temp) || temp < -10 || temp > 50) {
    throw new Error("Unexpected temperature_2m");
  }
  if (typeof humidity !== "number" || !Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
    throw new Error("Unexpected relative_humidity_2m");
  }
  if (typeof time !== "string" || time.length < 16) throw new Error("Unexpected time");

  return { temp, humidity, observedAt: time.slice(11, 16).replace(":", ".") };
}

export async function fetchCurrentWeather(signal: AbortSignal): Promise<CurrentWeather> {
  const data = await fetchJson(OPEN_METEO_URL, { timeoutMs: 3000, signal });
  return readCurrent(data);
}

/**
 * Current conditions and the hourly outdoor forecast in one request. Falls back
 * to throwing on any malformed field, so the dashboard can switch to its sample
 * curve. Only ever runs in the browser (3s timeout), never at build time.
 */
export async function fetchWeatherSnapshot(signal: AbortSignal): Promise<WeatherSnapshot> {
  const data = await fetchJson(OPEN_METEO_HOURLY_URL, { timeoutMs: 3000, signal });
  const current = readCurrent(data);

  const hourlyBlock =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>).hourly : null;
  if (typeof hourlyBlock !== "object" || hourlyBlock === null) throw new Error("Missing hourly block");

  const { time: times, temperature_2m: temps } = hourlyBlock as Record<string, unknown>;
  if (!Array.isArray(times) || !Array.isArray(temps) || times.length !== temps.length) {
    throw new Error("Unexpected hourly arrays");
  }

  const hourly: HourlyPoint[] = [];
  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    const temp = temps[i];
    // Compare these as plain strings; never new Date(time), which would reinterpret
    // the WIB wall-clock in the visitor's own time zone.
    if (typeof time !== "string" || time.length < 16) continue;
    if (typeof temp !== "number" || !Number.isFinite(temp)) continue;
    hourly.push({ time, temp });
  }
  if (hourly.length === 0) throw new Error("Empty hourly series");

  return { ...current, hourly };
}
