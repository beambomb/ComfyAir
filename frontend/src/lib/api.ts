import type { Mode, PeriodId } from "./comfort";
import { fetchJson } from "./http";
import type { HourlyPoint } from "./weather";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

export const WS_TELEMETRY_URL = `${API_BASE.replace(/^http/, "ws")}/api/v1/ws/telemetry`;

export type PredictionInput = {
  outdoor_temp: number;
  humidity: number;
  mode: Mode;
  hour?: number;
  ac_power_pk?: number;
};

export type Prediction = {
  recommended_setpoint: number;
  raw_predicted_temp: number;
  heat_index_c: number;
  estimated_savings_percent: number;
  model_used: string;
  model_r2: number | null;
};

export type ModelBenchmark = {
  model_name: string;
  cv_r2_mean: number;
  cv_r2_std: number;
  test_r2: number;
  test_mae: number;
  test_rmse: number;
};

export type ModelInfo = {
  loaded: boolean;
  model_name: string;
  version: string;
  trained_at: string | null;
  dataset_size: number;
  train_size: number;
  test_size: number;
  features: string[];
  cv_r2_mean: number | null;
  cv_r2_std: number | null;
  test_r2: number | null;
  test_mae: number | null;
  test_rmse: number | null;
  feature_importances: Record<string, number>;
  benchmarks: ModelBenchmark[];
};

export type HealthInfo = {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp_utc: string;
  client_ip: string;
  server_hostname: string;
  storage_backend: string;
  ml_model_loaded: boolean;
  ml_model_name: string;
  ws_connections: number;
  weather_cache_entries: number;
  latencyMs: number;
};

export type UserProfile = {
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_verified: boolean;
};

export type AuthTokensResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
};

export type PreferencesPayload = {
  ac_power_pk: number;
  electricity_rate_per_kwh: number;
  default_temperature: number;
  preferred_city: string;
  updated_at?: string | null;
};

export type SleepProfilePayload = {
  sleep_profile_id?: string;
  profile_name?: string;
  bedtime: string;
  wake_time: string;
  start_temp: number;
  deep_sleep_temp: number;
  wake_temp: number;
  is_active: boolean;
};

export type SavingsLogItem = {
  log_id: string;
  log_date: string;
  estimated_kwh_baseline: number;
  estimated_kwh_optimized: number;
  saved_cost_idr: number;
  created_at: string;
};

export type BackendWeatherResponse = {
  city: string;
  temp: number;
  humidity: number;
  observed_at: string;
  hourly: HourlyPoint[];
  source: string;
  upstream_latency_ms: number | null;
};

function authHeader(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchPrediction(
  input: PredictionInput,
  signal: AbortSignal,
  token?: string | null,
): Promise<Prediction> {
  const data = await fetchJson(`${API_BASE}/api/v1/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...authHeader(token),
    },
    body: JSON.stringify(input),
    timeoutMs: 2500,
    signal,
  });

  if (typeof data !== "object" || data === null) throw new Error("Unexpected prediction body");
  const d = data as Record<string, unknown>;
  if (typeof d.recommended_setpoint !== "number" || !Number.isInteger(d.recommended_setpoint)) {
    throw new Error("Unexpected recommended_setpoint");
  }
  if (typeof d.estimated_savings_percent !== "number") {
    throw new Error("Unexpected estimated_savings_percent");
  }
  return {
    recommended_setpoint: d.recommended_setpoint,
    raw_predicted_temp:
      typeof d.raw_predicted_temp === "number" ? d.raw_predicted_temp : d.recommended_setpoint,
    heat_index_c: typeof d.heat_index_c === "number" ? d.heat_index_c : input.outdoor_temp,
    estimated_savings_percent: d.estimated_savings_percent,
    model_used: typeof d.model_used === "string" ? d.model_used : "GradientBoostingRegressor",
    model_r2: typeof d.model_r2 === "number" ? d.model_r2 : null,
  };
}

export async function fetchBackendWeather(
  city: string,
  signal: AbortSignal,
): Promise<BackendWeatherResponse> {
  const data = await fetchJson(
    `${API_BASE}/api/v1/weather?city=${encodeURIComponent(city)}`,
    { timeoutMs: 2500, signal },
  );
  if (typeof data !== "object" || data === null) throw new Error("Unexpected weather response");
  return data as BackendWeatherResponse;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthInfo> {
  const started = performance.now();
  const data = await fetchJson(`${API_BASE}/api/v1/health`, { timeoutMs: 2500, signal });
  const latencyMs = Math.round(performance.now() - started);
  return { ...(data as Omit<HealthInfo, "latencyMs">), latencyMs };
}

export async function fetchModelInfo(signal?: AbortSignal): Promise<ModelInfo> {
  const data = await fetchJson(`${API_BASE}/api/v1/model/info`, { timeoutMs: 2500, signal });
  return data as ModelInfo;
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        typeof body === "object" && body !== null && "detail" in body && typeof body.detail === "string"
          ? body.detail
          : `HTTP ${res.status}`;
      throw new Error(detail);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export function loginUser(email: string, password: string): Promise<AuthTokensResponse> {
  return apiRequest<AuthTokensResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<AuthTokensResponse> {
  return apiRequest<AuthTokensResponse>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
}

export async function logoutUser(refreshToken: string | null): Promise<void> {
  await apiRequest("/api/v1/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).catch(() => {});
}

export function fetchMe(token: string): Promise<UserProfile> {
  return apiRequest<UserProfile>("/api/v1/auth/me", {
    headers: authHeader(token),
  });
}

export function fetchPreferences(token: string): Promise<PreferencesPayload> {
  return apiRequest<PreferencesPayload>("/api/v1/preferences", {
    headers: authHeader(token),
  });
}

export function savePreferences(
  token: string,
  payload: Partial<PreferencesPayload>,
): Promise<PreferencesPayload> {
  return apiRequest<PreferencesPayload>("/api/v1/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(payload),
  });
}

export function fetchSleepProfile(token: string): Promise<SleepProfilePayload> {
  return apiRequest<SleepProfilePayload>("/api/v1/sleep-profiles", {
    headers: authHeader(token),
  });
}

export function saveSleepProfile(
  token: string,
  payload: Partial<SleepProfilePayload>,
): Promise<SleepProfilePayload> {
  return apiRequest<SleepProfilePayload>("/api/v1/sleep-profiles", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(payload),
  });
}

export function fetchSavingsLogs(
  token: string,
  period?: PeriodId,
): Promise<SavingsLogItem[]> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : "";
  return apiRequest<SavingsLogItem[]>(`/api/v1/savings/logs${qs}`, {
    headers: authHeader(token),
  });
}

export function createSavingsLog(
  token: string,
  payload: {
    nights: number;
    hours_per_night: number;
    ac_power_pk: number;
    electricity_rate_per_kwh: number;
    setpoint: number;
  },
): Promise<SavingsLogItem> {
  return apiRequest<SavingsLogItem>("/api/v1/savings/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(payload),
  });
}

export function deleteSavingsLog(token: string, logId: string): Promise<void> {
  return apiRequest(`/api/v1/savings/logs/${encodeURIComponent(logId)}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export function triggerSleepCurve(payload: {
  bedtime: string;
  wake_time: string;
  start_temp: number;
  deep_sleep_temp: number;
  wake_temp: number;
}): Promise<unknown> {
  return apiRequest("/api/v1/sleep-curve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
