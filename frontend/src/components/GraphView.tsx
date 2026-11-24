"use client";

import { useSyncExternalStore } from "react";
import {
  nowOffset,
  tonightOutdoor,
  wibWallClock,
  type OutdoorPoint,
} from "@/lib/night";
import { useComfortState } from "./ComfortProvider";
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
  const { weather } = useComfortState();

  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute);
  const wibNow = minute === null ? null : wibWallClock(minute * 60_000);

  const live = weather.status === "live" ? weather : null;
  const realOutdoor = live && wibNow ? tonightOutdoor(live.hourly, wibNow) : null;
  const outdoor = realOutdoor ?? SAMPLE_OUTDOOR;
  const outdoorIsLive = realOutdoor !== null;
  const nowX = wibNow ? nowOffset(wibNow) : null;

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
              {outdoorIsLive ? "Suhu luar (Open-Meteo)" : "Suhu luar (contoh)"}
            </span>
          </div>
        </div>

        <p className={styles.desc}>
          Perbandingan prakiraan suhu luar Yogyakarta dengan target suhu AC ComfyAir pukul 21.00
          sampai 07.00 WIB. Suhu AC dinaikkan bertahap mengikuti penurunan metabolisme tubuh saat
          tidur nyenyak agar tetap nyaman sekaligus hemat daya.
        </p>

        <NightChart outdoor={outdoor} nowX={nowX} />
      </div>
    </main>
  );
}
