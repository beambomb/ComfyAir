import { useEffect, useState } from "react";
import { fetchPrediction } from "@/lib/api";
import { localRecommendation, type Mode, type Recommendation } from "@/lib/comfort";

export type ApiLink = "unknown" | "online" | "offline";

const DEBOUNCE_MS = 250;

/**
 * Setpoint for the current inputs.
 *
 * The in-browser port answers instantly. A debounced POST to the backend runs
 * after every change; once the API has answered at least once, its last value
 * stays on screen while the next request is pending, so the display never
 * flips between the two sources. Any failure switches to the local formula.
 */
export function useRecommendation(outdoorTemp: number, humidity: number, mode: Mode) {
  const key = `${outdoorTemp}|${humidity}|${mode}`;
  const local = localRecommendation(outdoorTemp, mode);
  const [settled, setSettled] = useState<{ key: string; rec: Recommendation } | null>(null);
  const [link, setLink] = useState<ApiLink>("unknown");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchPrediction({ outdoor_temp: outdoorTemp, humidity, mode }, controller.signal)
        .then((prediction) => {
          if (controller.signal.aborted) return;
          setSettled({
            key,
            rec: {
              setpoint: prediction.recommended_setpoint,
              savingsPercent: prediction.estimated_savings_percent,
              source: "api",
            },
          });
          setLink("online");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSettled({ key, rec: localRecommendation(outdoorTemp, mode) });
          setLink("offline");
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, outdoorTemp, humidity, mode]);

  const rec = settled && (settled.key === key || link === "online") ? settled.rec : local;
  return { rec, link };
}
