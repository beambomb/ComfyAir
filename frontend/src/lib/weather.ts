import { findCity, type CityInfo } from "./cities";
import { fetchJson } from "./http";

export type CurrentWeather = {
  temp: number;
  humidity: number;
  observedAt: string;
};

export type HourlyPoint = { time: string; temp: number };

export type WeatherSnapshot = CurrentWeather & {
  city: string;
  hourly: HourlyPoint[];
};

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

export async function fetchWeatherSnapshot(
  signal: AbortSignal,
  cityInfo: CityInfo = findCity("Yogyakarta"),
): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${cityInfo.latitude}&longitude=${cityInfo.longitude}` +
    "&current=temperature_2m,relative_humidity_2m&hourly=temperature_2m" +
    "&past_days=1&forecast_days=2&timezone=Asia%2FJakarta";

  const data = await fetchJson(url, { timeoutMs: 3000, signal });
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
    if (typeof time !== "string" || time.length < 16) continue;
    if (typeof temp !== "number" || !Number.isFinite(temp)) continue;
    hourly.push({ time, temp });
  }
  if (hourly.length === 0) throw new Error("Empty hourly series");

  return { ...current, city: cityInfo.name, hourly };
}
