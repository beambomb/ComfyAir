"use client";

import { useSyncExternalStore } from "react";
import { formatDateline } from "@/lib/dateline";
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

export default function MastheadLive() {
  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute);
  const dateline = minute === null ? null : formatDateline(minute * 60_000);

  return (
    <div className={styles.ear}>
      <p className={styles.dateline}>
        Yogyakarta ·{" "}
        {dateline ? <time dateTime={dateline.iso}>{dateline.text}</time> : "hari ini"}
      </p>
    </div>
  );
}
