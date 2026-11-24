"use client";

import { useState, useSyncExternalStore } from "react";
import { saveSleepProfile, triggerSleepCurve } from "@/lib/api";
import {
  buildSleepSchedule,
  nowOffset,
  tonightOutdoor,
  wibWallClock,
  type OutdoorPoint,
} from "@/lib/night";
import { useComfortDispatch, useComfortState } from "./ComfortProvider";
import NightChart from "./NightChart";
import styles from "./GraphView.module.css";

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

const BEDTIME_OPTIONS = ["20:00", "21:00", "22:00", "23:00", "00:00", "01:00"];
const WAKE_OPTIONS = ["04:00", "05:00", "06:00", "07:00", "08:00", "09:00"];
const TEMP_OPTIONS = [20, 21, 22, 23, 24, 25, 26, 27, 28];

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

export default function GraphView() {
  const { city, weather, sleepProfile, auth } = useComfortState();
  const dispatch = useComfortDispatch();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute);
  const wibNow = minute === null ? null : wibWallClock(minute * 60_000);

  const live = weather.status === "live" ? weather : null;
  const realOutdoor = live && wibNow ? tonightOutdoor(live.hourly, wibNow) : null;
  const outdoor = realOutdoor ?? SAMPLE_OUTDOOR;
  const outdoorIsLive = realOutdoor !== null;
  const nowX = wibNow ? nowOffset(wibNow) : null;

  const schedule = buildSleepSchedule(sleepProfile);

  async function handleSaveProfile() {
    setSaving(true);
    setStatusMessage(null);
    try {
      await triggerSleepCurve({
        bedtime: sleepProfile.bedtime,
        wake_time: sleepProfile.wakeTime,
        start_temp: sleepProfile.startTemp,
        deep_sleep_temp: sleepProfile.deepSleepTemp,
        wake_temp: sleepProfile.wakeTemp,
      }).catch(() => null);

      if (auth.accessToken) {
        await saveSleepProfile(auth.accessToken, {
          bedtime: sleepProfile.bedtime,
          wake_time: sleepProfile.wakeTime,
          start_temp: sleepProfile.startTemp,
          deep_sleep_temp: sleepProfile.deepSleepTemp,
          wake_temp: sleepProfile.wakeTemp,
          is_active: sleepProfile.isActive,
        });
        setStatusMessage("Profil tidur tersimpan di akun");
      } else {
        setStatusMessage("Kurva tidur diperbarui");
      }
    } catch {
      setStatusMessage("Gagal menyimpan ke server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main id="main-content" className={styles.main}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.heading}>Kurva Suhu Tidur</h1>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.legendSetpoint}`} />
              Target ComfyAir
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.legendOutdoor}`} />
              {outdoorIsLive ? `Suhu luar ${city}` : "Suhu luar (contoh)"}
            </span>
          </div>
        </div>

        <p className={styles.desc}>
          Perbandingan prakiraan suhu luar {city} dengan target suhu AC ComfyAir pukul 21.00 sampai
          07.00 WIB. Suhu AC dinaikkan bertahap mengikuti penurunan metabolisme tubuh saat tidur
          nyenyak agar tetap nyaman sekaligus hemat daya.
        </p>

        <NightChart
          outdoor={outdoor}
          nowX={nowX}
          steps={schedule.steps}
          phases={schedule.phases}
          isActive={sleepProfile.isActive}
        />

        <section aria-labelledby="sleep-config-heading" className={styles.configSection}>
          <div className={styles.configHeader}>
            <h2 id="sleep-config-heading" className={styles.configTitle}>
              Profil Tidur
            </h2>

            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={sleepProfile.isActive}
                onChange={(e) => {
                  dispatch({
                    type: "sleepProfile/set",
                    patch: { isActive: e.target.checked },
                  });
                  setStatusMessage(null);
                }}
              />
              <span>Aktifkan kurva</span>
            </label>
          </div>

          <div className={styles.configGrid}>
            <div className={styles.fieldGroup}>
              <label htmlFor="sleep-bedtime" className={styles.fieldLabel}>
                Jam tidur
              </label>
              <select
                id="sleep-bedtime"
                className={styles.fieldControl}
                value={sleepProfile.bedtime}
                onChange={(e) => {
                  dispatch({ type: "sleepProfile/set", patch: { bedtime: e.target.value } });
                  setStatusMessage(null);
                }}
              >
                {BEDTIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="sleep-waketime" className={styles.fieldLabel}>
                Jam bangun
              </label>
              <select
                id="sleep-waketime"
                className={styles.fieldControl}
                value={sleepProfile.wakeTime}
                onChange={(e) => {
                  dispatch({ type: "sleepProfile/set", patch: { wakeTime: e.target.value } });
                  setStatusMessage(null);
                }}
              >
                {WAKE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="sleep-start-temp" className={styles.fieldLabel}>
                Suhu awal
              </label>
              <select
                id="sleep-start-temp"
                className={styles.fieldControl}
                value={sleepProfile.startTemp}
                onChange={(e) => {
                  dispatch({
                    type: "sleepProfile/set",
                    patch: { startTemp: Number(e.target.value) },
                  });
                  setStatusMessage(null);
                }}
              >
                {TEMP_OPTIONS.map((temp) => (
                  <option key={temp} value={temp}>
                    {temp}°C
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="sleep-deep-temp" className={styles.fieldLabel}>
                Tidur nyenyak
              </label>
              <select
                id="sleep-deep-temp"
                className={styles.fieldControl}
                value={sleepProfile.deepSleepTemp}
                onChange={(e) => {
                  dispatch({
                    type: "sleepProfile/set",
                    patch: { deepSleepTemp: Number(e.target.value) },
                  });
                  setStatusMessage(null);
                }}
              >
                {TEMP_OPTIONS.map((temp) => (
                  <option key={temp} value={temp}>
                    {temp}°C
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="sleep-wake-temp" className={styles.fieldLabel}>
                Bangun
              </label>
              <select
                id="sleep-wake-temp"
                className={styles.fieldControl}
                value={sleepProfile.wakeTemp}
                onChange={(e) => {
                  dispatch({
                    type: "sleepProfile/set",
                    patch: { wakeTemp: Number(e.target.value) },
                  });
                  setStatusMessage(null);
                }}
              >
                {TEMP_OPTIONS.map((temp) => (
                  <option key={temp} value={temp}>
                    {temp}°C
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.configActions}>
            <button
              type="button"
              className={styles.saveButton}
              disabled={saving}
              onClick={handleSaveProfile}
            >
              {saving ? "Menyimpan" : "Simpan profil"}
            </button>
            {statusMessage ? <span className={styles.statusText}>{statusMessage}</span> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
