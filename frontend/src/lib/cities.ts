export type CityInfo = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export const CITIES: readonly CityInfo[] = [
  { name: "Yogyakarta", latitude: -7.7956, longitude: 110.3695, timezone: "Asia/Jakarta" },
  { name: "Jakarta", latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
  { name: "Surabaya", latitude: -7.2575, longitude: 112.7521, timezone: "Asia/Jakarta" },
  { name: "Bandung", latitude: -6.9175, longitude: 107.6191, timezone: "Asia/Jakarta" },
  { name: "Semarang", latitude: -6.9667, longitude: 110.4167, timezone: "Asia/Jakarta" },
  { name: "Denpasar", latitude: -8.65, longitude: 115.2167, timezone: "Asia/Jakarta" },
  { name: "Medan", latitude: 3.5952, longitude: 98.6722, timezone: "Asia/Jakarta" },
  { name: "Makassar", latitude: -5.1477, longitude: 119.4327, timezone: "Asia/Jakarta" },
] as const;

export const DEFAULT_CITY = "Yogyakarta";

export function findCity(name: string): CityInfo {
  const norm = name.trim().toLowerCase();
  return CITIES.find((c) => c.name.toLowerCase() === norm) ?? CITIES[0];
}
