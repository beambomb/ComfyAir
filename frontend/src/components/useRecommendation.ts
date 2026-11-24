import { useEffect, useState } from "react";
import { fetchPrediction } from "@/lib/api";
import { localRecommendation, type Mode, type Recommendation } from "@/lib/comfort";
import { kwToPk } from "./ComfortProvider";

export type ApiLink = "unknown" | "online" | "offline";

const DEBOUNCE_MS = 220;

export function useRecommendation(
  outdoorTemp: number,
  humidity: number,
  mode: Mode,
  acPowerKw: number = 0.8,
  token?: string | null,
) {
  const acPowerPk = kwToPk(acPowerKw);
  const key = `${outdoorTemp}|${humidity}|${mode}|${acPowerPk}`;
  const local = localRecommendation(outdoorTemp, mode, humidity);
  const [settled, setSettled] = useState<{ key: string; rec: Recommendation } | null>(null);
  const [link, setLink] = useState<ApiLink>("unknown");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const wibHour = new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours();
      fetchPrediction(
        {
          outdoor_temp: outdoorTemp,
          humidity,
          mode,
          hour: wibHour,
          ac_power_pk: acPowerPk,
        },
        controller.signal,
        token,
      )
        .then((prediction) => {
          if (controller.signal.aborted) return;
          setSettled({
            key,
            rec: {
              setpoint: prediction.recommended_setpoint,
              savingsPercent: prediction.estimated_savings_percent,
              source: "api",
              heatIndexC: prediction.heat_index_c,
              rawPredictedTemp: prediction.raw_predicted_temp,
              modelUsed: prediction.model_used,
              modelR2: prediction.model_r2,
            },
          });
          setLink("online");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSettled({ key, rec: localRecommendation(outdoorTemp, mode, humidity) });
          setLink("offline");
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, outdoorTemp, humidity, mode, acPowerPk, token]);

  const rec = settled && (settled.key === key || link === "online") ? settled.rec : local;
  return { rec, link };
}
