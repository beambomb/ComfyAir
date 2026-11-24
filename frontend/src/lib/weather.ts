import { findCity, type CityInfo } from "./cities";
import { fetchJson } from "./http";

export type WeatherSnapshot = {
  city: string;
  temp: number;
  humidity: number;
  observedAt: string;
};

export async function fetchWeatherSnapshot(
  signal: AbortSignal,
  cityInfo: CityInfo = findCity("Yogyakarta"),
): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${cityInfo.latitude}&longitude=${cityInfo.longitude}` +
    "&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FJakarta";

  const data = await fetchJson(url, { timeoutMs: 3000, signal });
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

  return {
    city: cityInfo.name,
    temp,
    humidity,
    observedAt: time.slice(11, 16).replace(":", "."),
  };
}
