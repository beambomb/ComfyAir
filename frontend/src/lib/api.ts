import { fetchJson } from "./http";
import type { Mode } from "./comfort";

// Inlined at `next build`. `||` (not `??`) so an empty value still falls back.
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

export type PredictionInput = { outdoor_temp: number; humidity: number; mode: Mode };

export type Prediction = { recommended_setpoint: number; estimated_savings_percent: number };

/**
 * POST /api/v1/predict on the FastAPI backend (backend/app/api/v1/predict.py).
 * Rejects on network errors, timeouts, non-2xx answers and malformed bodies, so
 * the caller has a single place to switch to the in-browser fallback.
 */
export async function fetchPrediction(
  input: PredictionInput,
  signal: AbortSignal,
): Promise<Prediction> {
  const data = await fetchJson(`${API_BASE}/api/v1/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
    timeoutMs: 2500,
    signal,
  });

  if (typeof data !== "object" || data === null) throw new Error("Unexpected prediction body");
  const { recommended_setpoint: setpoint, estimated_savings_percent: savings } = data as Record<
    string,
    unknown
  >;

  if (typeof setpoint !== "number" || !Number.isInteger(setpoint) || setpoint < 10 || setpoint > 35) {
    throw new Error("Unexpected recommended_setpoint");
  }
  if (typeof savings !== "number" || !Number.isFinite(savings) || savings < 0) {
    throw new Error("Unexpected estimated_savings_percent");
  }

  return { recommended_setpoint: setpoint, estimated_savings_percent: savings };
}
