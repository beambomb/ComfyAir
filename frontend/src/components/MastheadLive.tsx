"use client";

import { useSyncExternalStore } from "react";
import { formatDateline } from "@/lib/dateline";
import { useComfortState, type WeatherState } from "./ComfortProvider";
import styles from "./Masthead.module.css";

// Minute-resolution clock. The server snapshot is null, so the prerendered HTML
// and the hydration pass both show the placeholder; the date fills in right after.
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

function readingText(weather: WeatherState): string {
  switch (weather.status) {
    case "loading":
      return "membaca cuaca…";
    case "live":
      return `Di luar ${Math.round(weather.temp)}°C · lembap ${Math.round(weather.humidity)}%`;
    case "sample":
      return "cuaca live tidak terjangkau";
  }
}

export default function MastheadLive() {
  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute);
  const { weather } = useComfortState();
  const dateline = minute === null ? null : formatDateline(minute * 60_000);

  return (
    <div className={styles.ear}>
      <p className={styles.dateline}>
        Yogyakarta ·{" "}
        {dateline ? <time dateTime={dateline.iso}>{dateline.text}</time> : "hari ini"}
      </p>
      <p className={styles.reading} data-status={weather.status}>
        {readingText(weather)}
      </p>
    </div>
  );
}
