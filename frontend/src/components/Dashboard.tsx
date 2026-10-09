"use client";

import { useState, useSyncExternalStore } from "react";
import {
  MODE_LABEL,
  MODES,
  PERIODS,
  formatPercent,
  formatRupiah,
  monthlyBill,
  type PeriodId,
} from "@/lib/comfort";
import {
  SLEEP_FACTS,
  nextStepAfter,
  nowOffset,
  phaseAt,
  tonightOutdoor,
  wibWallClock,
  type OutdoorPoint,
} from "@/lib/night";
import { useComfortDispatch, useComfortState, type WeatherState } from "./ComfortProvider";
import { useRecommendation } from "./useRecommendation";
import SegmentDisplay from "./SegmentDisplay";
import NightChart from "./NightChart";
import styles from "./Dashboard.module.css";

// A typical cool night in Yogyakarta, used when the hourly forecast is missing.
// x is hours after 21.00; labelled "contoh" so it is never passed off as live.
const SAMPLE_OUTDOOR: OutdoorPoint[] = [
  { x: 0, temp: 27.2 },
  { x: 1, temp: 26.7 },
  { x: 2, temp: 26.1 },
  { x: 3, temp: 25.6 },
  { x: 4, temp: 25.2 },
  { x: 5, temp: 24.8 },
  { x: 6, temp: 24.5 },
  { x: 7, temp: 24.2 },
  { x: 8, temp: 24.0 },
  { x: 9, temp: 24.1 },
  { x: 10, temp: 24.8 },
];

// Minute-resolution WIB clock. Server snapshot is null, so prerender and the
// first client render both show placeholders; the real values fill after mount.
function subscribeMinute(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
}
function getMinute(): number | null {
  return Math.floor(Date.now() / 60_000);
}
function getServerMinute(): number | null {
  return null;
}

function weatherSourceLine(weather: WeatherState, touched: boolean): string {
  if (touched) return "angka kamu sendiri";
  switch (weather.status) {
    case "loading":
      return "membaca Open-Meteo…";
    case "live":
      return `Open-Meteo live · ${weather.observedAt} WIB`;
    case "sample":
      return "angka contoh · live tidak terjangkau";
  }
}

export default function Dashboard() {
  const { weather, controls } = useComfortState();
  const dispatch = useComfortDispatch();
  const { rec, link } = useRecommendation(controls.outdoorTemp, controls.humidity, controls.mode);
  const [period, setPeriod] = useState<PeriodId>("monthly");

  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute);
  const wibNow = minute === null ? null : wibWallClock(minute * 60_000);

  const live = weather.status === "live" ? weather : null;
  // Only use the real line once we are mounted (wibNow known) and the window is
  // fully covered; otherwise draw the sample curve.
  const realOutdoor = live && wibNow ? tonightOutdoor(live.hourly, wibNow) : null;
  const outdoor = realOutdoor ?? SAMPLE_OUTDOOR;
  const outdoorIsLive = realOutdoor !== null;

  const nowX = wibNow ? nowOffset(wibNow) : null;
  const phase = nowX !== null ? phaseAt(nowX) : { name: null, temp: null };
  const nextStep = nowX !== null ? nextStepAfter(nowX) : null;

  const activePeriod = PERIODS.find((p) => p.id === period) ?? PERIODS[2];
  const bill = monthlyBill(rec.savingsPercent, activePeriod.nights);
  const percent = formatPercent(rec.savingsPercent);

  const setpointLabel = controls.power ? `${rec.setpoint} derajat Celsius` : "AC mati";
  const sourceNote =
    rec.source === "api" ? "API ComfyAir terhubung" : "Offline · rumus adaptif ASHRAE 55";

  const chartCaption = outdoorIsLive
    ? "Garis suhu luar dari prakiraan Open-Meteo. Garis ComfyAir mengikuti profil tidur."
    : "Garis suhu luar adalah angka contoh. Garis ComfyAir mengikuti profil tidur.";

  const nightNowText =
    wibNow === null
      ? "memuat waktu…"
      : nowX === null
        ? "di luar jam tidur"
        : phase.name
          ? `sekarang ${phase.name.toLowerCase()} · ${phase.temp}°`
          : "AC belum menyala";

  return (
    <main className={styles.dashboard}>
      <div className="wrap">
        <div className={styles.header}>
          <h1 className={`headline ${styles.h1}`}>Malam ini</h1>
          <p className={styles.lede}>Satu lembar data: setpoint, cuaca, dan hemat.</p>
        </div>

        <div className={styles.grid}>
          {/* A. Setpoint sekarang */}
          <section aria-labelledby="panel-setpoint" className={`${styles.panel} ${styles.setpointPanel}`}>
            <p id="panel-setpoint" className={`label ${styles.panelLabel}`}>
              Setpoint sekarang
            </p>

            <div className={controls.power ? styles.lcd : `${styles.lcd} ${styles.lcdOff}`}>
              <SegmentDisplay
                setpoint={rec.setpoint}
                mode={controls.mode}
                power={controls.power}
                outdoorTemp={controls.outdoorTemp}
                humidity={controls.humidity}
              />
            </div>

            <div className={styles.setpointControls}>
              <fieldset className={styles.modeField}>
                <legend className="visually-hidden">Mode</legend>
                <div role="radiogroup" aria-label="Mode" className={styles.modes}>
                  {MODES.map((m) => (
                    <label
                      key={m}
                      className={styles.modeOption}
                      data-checked={m === controls.mode ? "" : undefined}
                    >
                      <input
                        type="radio"
                        name="dash-mode"
                        value={m}
                        checked={m === controls.mode}
                        onChange={() => dispatch({ type: "mode/set", mode: m })}
                        className={styles.radio}
                      />
                      {MODE_LABEL[m]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                className={styles.power}
                aria-pressed={controls.power}
                onClick={() => dispatch({ type: "power/toggle" })}
              >
                {controls.power ? "Matikan" : "Nyalakan"}
              </button>
            </div>

            <p className={styles.sourceNote} data-link={link}>
              {sourceNote}
            </p>
            <p className={styles.inputNote}>
              Dihitung dari {weatherSourceLine(weather, controls.touched)}. Angka ini kamu set
              sendiri di remote AC-mu; ComfyAir cuma menyarankan.
            </p>

            <p className="visually-hidden" aria-live="polite" aria-atomic="true">
              {controls.power
                ? `Setpoint ${setpointLabel}, mode ${MODE_LABEL[controls.mode]}.`
                : "AC dimatikan."}
            </p>
          </section>

          {/* B. Cuaca luar */}
          <section aria-labelledby="panel-cuaca" className={styles.panel}>
            <p id="panel-cuaca" className={`label ${styles.panelLabel}`}>
              Cuaca luar
            </p>
            <p className={styles.bigNumber}>
              {live ? Math.round(live.temp) : controls.outdoorTemp}
              <span className={styles.unit}>°C</span>
            </p>
            <p className={styles.subNumber}>
              lembap {live ? Math.round(live.humidity) : controls.humidity}%
            </p>
            <p className={styles.meta}>
              {live ? `diperbarui ${live.observedAt} WIB` : "menunggu data"}
            </p>
            <p className={styles.sourceSmall}>
              {weather.status === "live"
                ? "Open-Meteo live"
                : weather.status === "sample"
                  ? "angka contoh"
                  : "membaca…"}
            </p>
          </section>

          {/* C. Malam ini */}
          <section aria-labelledby="panel-malam" className={`${styles.panel} ${styles.nightPanel}`}>
            <p id="panel-malam" className={`label ${styles.panelLabel}`}>
              Malam ini · 21.00 sampai 07.00
            </p>
            <NightChart
              outdoor={outdoor}
              nowX={nowX}
              caption={chartCaption}
              outdoorLabel={outdoorIsLive ? "suhu luar" : "suhu luar (contoh)"}
            />
            <dl className={styles.facts}>
              <div>
                <dt>Tidur</dt>
                <dd>{SLEEP_FACTS.bed} · bangun {SLEEP_FACTS.wake}</dd>
              </div>
              <div>
                <dt>Sekarang</dt>
                <dd>{nightNowText}</dd>
              </div>
              <div>
                <dt>Berikutnya</dt>
                <dd>{nextStep ? `${nextStep.temp}° pukul ${nextStep.at}` : "—"}</dd>
              </div>
            </dl>
          </section>

          {/* D. Hemat */}
          <section aria-labelledby="panel-hemat" className={`${styles.panel} ${styles.savingsPanel}`}>
            <p id="panel-hemat" className={`label ${styles.panelLabel}`}>
              Hemat
            </p>
            <div role="radiogroup" aria-label="Periode" className={styles.periods}>
              {PERIODS.map((p) => (
                <label
                  key={p.id}
                  className={styles.periodOption}
                  data-checked={p.id === period ? "" : undefined}
                >
                  <input
                    type="radio"
                    name="dash-period"
                    value={p.id}
                    checked={p.id === period}
                    onChange={() => setPeriod(p.id)}
                    className={styles.radio}
                  />
                  {p.label}
                </label>
              ))}
            </div>

            <dl className={styles.ledger}>
              <div className={styles.ledgerRow}>
                <dt>Biaya di 20°C</dt>
                <dd>{formatRupiah(bill.baselineRp)}</dd>
              </div>
              <div className={styles.ledgerRow}>
                <dt>Biaya di {rec.setpoint}°C</dt>
                <dd>{formatRupiah(bill.optimizedRp)}</dd>
              </div>
              <div className={`${styles.ledgerRow} ${styles.ledgerTotal}`}>
                <dt>Hemat</dt>
                <dd>{formatRupiah(bill.savedRp)}</dd>
              </div>
              <div className={styles.ledgerRow}>
                <dt>Lebih hemat</dt>
                <dd>{percent}</dd>
              </div>
            </dl>
            <p className={styles.footnote}>
              Perkiraan. 1 PK ±800 W · 8 jam/malam · Rp1.444,70/kWh · {activePeriod.nights} malam.
            </p>
          </section>

          {/* E. Profil */}
          <section aria-labelledby="panel-profil" className={styles.panel}>
            <p id="panel-profil" className={`label ${styles.panelLabel}`}>
              Profil
            </p>
            <p className={styles.profil}>1 PK · Rp1.444,70/kWh · Yogyakarta</p>
            <p className={styles.sourceSmall}>Setelan tetap · tanpa penyimpanan</p>
          </section>
        </div>
      </div>
    </main>
  );
}
