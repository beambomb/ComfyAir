"use client";

import { useState } from "react";
import {
  resetComfortFeedback,
  submitComfortFeedback,
  type ComfortRating,
} from "@/lib/api";
import { CITIES } from "@/lib/cities";
import { HUMIDITY, MODE_LABEL, MODES, OUTDOOR } from "@/lib/comfort";
import { useComfortDispatch, useComfortState } from "./ComfortProvider";
import { useRecommendation } from "./useRecommendation";
import styles from "./Dashboard.module.css";

const FEEDBACK_OPTIONS: readonly { rating: ComfortRating; label: string }[] = [
  { rating: "too_cold", label: "Terlalu dingin" },
  { rating: "just_right", label: "Pas" },
  { rating: "too_warm", label: "Terlalu panas" },
];

export default function Dashboard() {
  const { city, weather, controls, auth, feedbackVersion } = useComfortState();
  const dispatch = useComfortDispatch();
  const { rec, link } = useRecommendation(
    controls.outdoorTemp,
    controls.humidity,
    controls.mode,
    controls.acPowerKw,
    auth.accessToken,
    feedbackVersion,
  );

  const [fbBusy, setFbBusy] = useState(false);
  const [fbNote, setFbNote] = useState<string | null>(null);

  const atMinTemp = controls.outdoorTemp <= OUTDOOR.min;
  const atMaxTemp = controls.outdoorTemp >= OUTDOOR.max;
  const atMinHum = controls.humidity <= HUMIDITY.min;
  const atMaxHum = controls.humidity >= HUMIDITY.max;

  const biasSuffix =
    rec.personalBiasC !== 0
      ? `, kalibrasi ${rec.personalBiasC > 0 ? "+" : ""}${rec.personalBiasC}°C`
      : "";

  async function handleFeedback(rating: ComfortRating) {
    setFbBusy(true);
    setFbNote(null);
    try {
      await submitComfortFeedback(
        {
          outdoor_temp: controls.outdoorTemp,
          humidity: controls.humidity,
          mode: controls.mode,
          predicted_setpoint: rec.setpoint,
          rating,
        },
        auth.accessToken,
      );
      dispatch({ type: "feedback/bump" });
      setFbNote("Preferensi dicatat");
    } catch {
      setFbNote("Perlu koneksi API untuk kalibrasi");
    } finally {
      setFbBusy(false);
    }
  }

  async function handleResetCalibration() {
    setFbBusy(true);
    setFbNote(null);
    try {
      await resetComfortFeedback(auth.accessToken);
      dispatch({ type: "feedback/bump" });
      setFbNote("Kalibrasi direset");
    } catch {
      setFbNote("Gagal mereset kalibrasi");
    } finally {
      setFbBusy(false);
    }
  }

  return (
    <main id="main-content" className={styles.main}>
      <div className="container">
        <h1 className="visually-hidden">Dasbor ComfyAir</h1>

        <div className={styles.dashboardGrid}>
          <section aria-labelledby="section-setpoint" className={styles.setpointCol}>
            <h2 id="section-setpoint" className={styles.blockLabel}>
              Setpoint
            </h2>

            <p
              className={styles.setpointValue}
              data-off={controls.power ? undefined : ""}
            >
              {controls.power ? rec.setpoint : "--"}
              <span className={styles.setpointUnit}>°C</span>
            </p>

            <div className={styles.controlRow}>
              <fieldset className={styles.modeField}>
                <legend className="visually-hidden">Mode</legend>
                <div role="radiogroup" aria-label="Mode" className={styles.segmented}>
                  {MODES.map((m) => (
                    <label
                      key={m}
                      className={styles.segmentOption}
                      data-checked={m === controls.mode ? "" : undefined}
                    >
                      <input
                        type="radio"
                        name="dash-mode"
                        value={m}
                        checked={m === controls.mode}
                        onChange={() => dispatch({ type: "mode/set", mode: m })}
                        className={styles.radioInput}
                      />
                      {MODE_LABEL[m]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                className={styles.powerButton}
                aria-pressed={controls.power}
                onClick={() => dispatch({ type: "power/toggle" })}
              >
                {controls.power ? "Matikan" : "Nyalakan"}
              </button>
            </div>

            <p className={styles.modelNote}>
              {controls.power
                ? `Indeks panas ${rec.heatIndexC}°C, ${rec.modelUsed}${biasSuffix}`
                : "AC dalam keadaan mati"}
            </p>

            {controls.power && link !== "offline" ? (
              <div className={styles.feedbackSection}>
                <div className={styles.feedbackHeader}>
                  <span className={styles.feedbackLabel}>Bagaimana suhu ini?</span>
                  {rec.feedbackCount > 0 ? (
                    <button
                      type="button"
                      className={styles.resetButton}
                      disabled={fbBusy}
                      onClick={handleResetCalibration}
                    >
                      Reset kalibrasi
                    </button>
                  ) : null}
                </div>

                <div className={styles.feedbackRow}>
                  {FEEDBACK_OPTIONS.map((opt) => (
                    <button
                      key={opt.rating}
                      type="button"
                      className={styles.feedbackBtn}
                      disabled={fbBusy}
                      onClick={() => handleFeedback(opt.rating)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {fbNote ? <p className={styles.feedbackNote}>{fbNote}</p> : null}
              </div>
            ) : null}

            <p className="visually-hidden" aria-live="polite" aria-atomic="true">
              {controls.power
                ? `Setpoint ${rec.setpoint} derajat Celsius, mode ${MODE_LABEL[controls.mode]}.`
                : "AC dimatikan."}
            </p>
          </section>

          <section aria-labelledby="section-cuaca" className={styles.weatherCol}>
            <div className={styles.weatherHeader}>
              <h2 id="section-cuaca" className={styles.blockLabel}>
                Cuaca
              </h2>

              <div className={styles.weatherActions}>
                {controls.touched ? (
                  <button
                    type="button"
                    className={styles.resetButton}
                    onClick={() => dispatch({ type: "weather/reset" })}
                  >
                    Reset
                  </button>
                ) : weather.status === "sample" ? (
                  <span className={styles.sampleTag}>Contoh</span>
                ) : null}

                <select
                  aria-label="Pilih kota"
                  className={styles.citySelect}
                  value={city}
                  onChange={(e) => dispatch({ type: "city/set", city: e.target.value })}
                >
                  {CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.metricRows}>
              <div className={styles.metricRow}>
                <div className={styles.metricReadout}>
                  <span className={styles.metricLabel} id="label-sim-temp">
                    Suhu
                  </span>
                  <output className={styles.metricValue}>{controls.outdoorTemp}°C</output>
                </div>
                <div className={styles.stepper} role="group" aria-labelledby="label-sim-temp">
                  <button
                    type="button"
                    className={styles.stepButton}
                    aria-label="Turunkan suhu luar 1 derajat"
                    aria-disabled={atMinTemp}
                    onClick={() => {
                      if (!atMinTemp) dispatch({ type: "temp/step", delta: -1 });
                    }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.stepButton}
                    aria-label="Naikkan suhu luar 1 derajat"
                    aria-disabled={atMaxTemp}
                    onClick={() => {
                      if (!atMaxTemp) dispatch({ type: "temp/step", delta: 1 });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className={styles.metricRow}>
                <div className={styles.metricReadout}>
                  <span className={styles.metricLabel} id="label-sim-humidity">
                    Kelembapan
                  </span>
                  <output className={styles.metricValue}>{controls.humidity}%</output>
                </div>
                <div
                  className={styles.stepper}
                  role="group"
                  aria-labelledby="label-sim-humidity"
                >
                  <button
                    type="button"
                    className={styles.stepButton}
                    aria-label="Turunkan kelembapan 5 persen"
                    aria-disabled={atMinHum}
                    onClick={() => {
                      if (!atMinHum) dispatch({ type: "humidity/step", delta: -5 });
                    }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={styles.stepButton}
                    aria-label="Naikkan kelembapan 5 persen"
                    aria-disabled={atMaxHum}
                    onClick={() => {
                      if (!atMaxHum) dispatch({ type: "humidity/step", delta: 5 });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
