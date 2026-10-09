// Tonight's window logic and the ComfyAir sleep profile, shared by the dashboard
// night chart. All times are Yogyakarta wall-clock (WIB); Open-Meteo hourly
// strings ("2026-10-03T21:00") are sliced and compared as strings, never parsed
// with new Date(str) which would reinterpret them in the visitor's own zone.

import type { HourlyPoint } from "./weather";

// The window runs 21.00 to 07.00: 11 hourly marks, x = hours after 21.00 (0..10).
export const WINDOW_START_HOUR = 21;
export const WINDOW_HOURS = 10;

// ComfyAir sleep profile (backend/schema.sql sleep_profiles defaults: bed 22.00,
// wake 06.00, 24 / 26 / 25 C), moved in whole-degree steps like a real remote.
// `from`/`to` are hours after 21.00. The AC turns on at 22.00 (x = 1).
export const SETPOINT_STEPS = [
  { from: 1, to: 2.5, temp: 24 },
  { from: 2.5, to: 3.5, temp: 25 },
  { from: 3.5, to: 8, temp: 26 },
  { from: 8, to: 10, temp: 25 },
] as const;

export const PHASES = [
  { from: 1, to: 3.5, name: "Mulai tidur", temp: 24 },
  { from: 3.5, to: 8, name: "Tidur nyenyak", temp: 26 },
  { from: 8, to: 10, name: "Bangun", temp: 25 },
] as const;

export const SLEEP_FACTS = { bed: "22.00", wake: "06.00" } as const;

/** Setpoint at a given hour-after-21.00, or null before the AC turns on. */
export function setpointAt(hour: number): number | null {
  if (hour < SETPOINT_STEPS[0].from) return null;
  const step = SETPOINT_STEPS.find((s) => hour >= s.from && hour < s.to);
  return (step ?? SETPOINT_STEPS[SETPOINT_STEPS.length - 1]).temp;
}

/** "21.00", "00.00", "23.30" ... for x (possibly half) hours after 21.00. */
export function hourLabel(x: number): string {
  const total = (WINDOW_START_HOUR * 60 + x * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}.${String(mm).padStart(2, "0")}`;
}

export type NightPhase = {
  /** Name of the sleep phase the given hour falls in, or null before AC turns on. */
  name: string | null;
  /** Setpoint for that phase, or null. */
  temp: number | null;
};

export function phaseAt(hour: number): NightPhase {
  const phase = PHASES.find((p) => hour >= p.from && hour < p.to);
  if (!phase) return { name: null, temp: null };
  return { name: phase.name, temp: phase.temp };
}

/** The next setpoint change after the given hour, e.g. { temp: 25, at: "05.00" }. */
export function nextStepAfter(hour: number): { temp: number; at: string } | null {
  const current = setpointAt(hour);
  const change = SETPOINT_STEPS.find((s) => s.from > hour && s.temp !== current);
  return change ? { temp: change.temp, at: hourLabel(change.from) } : null;
}

/**
 * The tonight date keys. If it is still before noon WIB, "tonight" means last
 * evening (yesterday 21.00) through this morning (today 07.00); otherwise it is
 * this evening through tomorrow morning. Returns YYYY-MM-DD strings built from
 * WIB wall-clock parts so we only ever compare Open-Meteo strings as strings.
 */
export function tonightDates(wibNow: Date): { eveningDate: string; morningDate: string; hour: number } {
  // wibNow carries WIB wall-clock in its UTC fields (see wibWallClock below).
  const hour = wibNow.getUTCHours();
  const dayMs = 24 * 60 * 60 * 1000;
  const base = Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate());
  if (hour < 12) {
    const prev = new Date(base - dayMs);
    return { eveningDate: ymd(prev), morningDate: ymd(new Date(base)), hour };
  }
  return { eveningDate: ymd(new Date(base)), morningDate: ymd(new Date(base + dayMs)), hour };
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * A Date whose UTC fields equal the current WIB (UTC+7) wall clock, so getUTCHours()
 * etc. read the Yogyakarta time without any Intl round-trip per call.
 */
export function wibWallClock(ms: number): Date {
  return new Date(ms + 7 * 60 * 60 * 1000);
}

export type OutdoorPoint = { x: number; temp: number };

/**
 * Pull the 11 marks (21.00..07.00) of tonight's outdoor line out of the hourly
 * series. Returns null if the window is not fully covered, so the caller can
 * fall back to the sample curve.
 */
export function tonightOutdoor(hourly: HourlyPoint[], wibNow: Date): OutdoorPoint[] | null {
  const { eveningDate, morningDate } = tonightDates(wibNow);
  const byTime = new Map(hourly.map((p) => [p.time, p.temp]));
  const points: OutdoorPoint[] = [];
  for (let x = 0; x <= WINDOW_HOURS; x++) {
    const clock = (WINDOW_START_HOUR + x) % 24;
    const date = clock >= WINDOW_START_HOUR ? eveningDate : morningDate;
    const key = `${date}T${String(clock).padStart(2, "0")}:00`;
    const temp = byTime.get(key);
    if (typeof temp !== "number") return null;
    points.push({ x, temp });
  }
  return points;
}

/** Current position inside the window as hours-after-21.00, or null if outside. */
export function nowOffset(wibNow: Date): number | null {
  const hour = wibNow.getUTCHours();
  const minute = wibNow.getUTCMinutes();
  const decimal = hour + minute / 60;
  // Evening side: 21.00..24.00 -> 0..3
  if (decimal >= WINDOW_START_HOUR) return decimal - WINDOW_START_HOUR;
  // Morning side: 00.00..07.00 -> 3..10
  if (decimal <= WINDOW_START_HOUR - 24 + WINDOW_HOURS) return decimal + (24 - WINDOW_START_HOUR);
  return null;
}
