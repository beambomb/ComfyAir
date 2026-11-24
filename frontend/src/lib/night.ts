import type { HourlyPoint } from "./weather";

export const WINDOW_START_HOUR = 21;
export const WINDOW_HOURS = 10;

export type SleepProfileConfig = {
  bedtime: string;
  wakeTime: string;
  startTemp: number;
  deepSleepTemp: number;
  wakeTemp: number;
  isActive: boolean;
};

export const DEFAULT_SLEEP_PROFILE: SleepProfileConfig = {
  bedtime: "22:00",
  wakeTime: "06:00",
  startTemp: 24,
  deepSleepTemp: 26,
  wakeTemp: 25,
  isActive: true,
};

export type SetpointStep = { from: number; to: number; temp: number };
export type SleepPhaseItem = {
  from: number;
  to: number;
  name: string;
  temp: number;
  detail: string;
};

export const SETPOINT_STEPS: readonly SetpointStep[] = [
  { from: 1, to: 2.5, temp: 24 },
  { from: 2.5, to: 3.5, temp: 25 },
  { from: 3.5, to: 8, temp: 26 },
  { from: 8, to: 10, temp: 25 },
];

export const PHASES: readonly SleepPhaseItem[] = [
  {
    from: 1,
    to: 3.5,
    name: "Mulai tidur",
    temp: 24,
    detail: "Suhu sejuk membantu tubuh lebih cepat terlelap.",
  },
  {
    from: 3.5,
    to: 8,
    name: "Tidur nyenyak",
    temp: 26,
    detail: "Suhu dinaikkan mengikuti metabolisme tubuh yang melambat.",
  },
  {
    from: 8,
    to: 10,
    name: "Menjelang bangun",
    temp: 25,
    detail: "Diturunkan ringan agar bangun terasa lebih segar.",
  },
];

function timeStringToOffset(hhmm: string, isWake: boolean): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr || "0");
  if (!Number.isFinite(h) || !Number.isFinite(m)) return isWake ? 9 : 1;
  const decimal = h + m / 60;
  // Window starts at 21.00 (0) through 07.00 (10).
  const raw = decimal >= WINDOW_START_HOUR ? decimal - WINDOW_START_HOUR : decimal + (24 - WINDOW_START_HOUR);
  if (isWake) {
    return Math.min(WINDOW_HOURS, Math.max(2, raw));
  }
  return Math.min(WINDOW_HOURS - 2, Math.max(0, raw));
}

export function buildSleepSchedule(profile: SleepProfileConfig): {
  steps: SetpointStep[];
  phases: SleepPhaseItem[];
} {
  const startX = timeStringToOffset(profile.bedtime, false);
  const wakeX = Math.max(startX + 2, timeStringToOffset(profile.wakeTime, true));
  const chartEnd = Math.min(WINDOW_HOURS, Math.max(wakeX, startX + 2));
  const duration = Math.max(2, chartEnd - startX);

  const p1End = Math.round((startX + duration * 0.28) * 2) / 2;
  const p2End = Math.round((startX + duration * 0.78) * 2) / 2;

  const phases: SleepPhaseItem[] = [
    {
      from: startX,
      to: p1End,
      name: "Mulai tidur",
      temp: profile.startTemp,
      detail: "Suhu sejuk membantu tubuh lebih cepat terlelap.",
    },
    {
      from: p1End,
      to: p2End,
      name: "Tidur nyenyak",
      temp: profile.deepSleepTemp,
      detail: "Suhu dinaikkan mengikuti metabolisme tubuh yang melambat.",
    },
    {
      from: p2End,
      to: WINDOW_HOURS,
      name: "Menjelang bangun",
      temp: profile.wakeTemp,
      detail: "Diturunkan ringan agar bangun terasa lebih segar.",
    },
  ];

  const steps: SetpointStep[] = [];
  const diff = profile.deepSleepTemp - profile.startTemp;
  if (Math.abs(diff) >= 2 && p1End - startX >= 1.5) {
    const mid = Math.round((p1End - 0.5) * 2) / 2;
    const midTemp = Math.round((profile.startTemp + profile.deepSleepTemp) / 2);
    steps.push({ from: startX, to: mid, temp: profile.startTemp });
    steps.push({ from: mid, to: p1End + 0.5, temp: midTemp });
    steps.push({ from: p1End + 0.5, to: p2End, temp: profile.deepSleepTemp });
  } else {
    steps.push({ from: startX, to: p1End, temp: profile.startTemp });
    steps.push({ from: p1End, to: p2End, temp: profile.deepSleepTemp });
  }
  steps.push({ from: p2End, to: WINDOW_HOURS, temp: profile.wakeTemp });

  return { steps, phases };
}

export function hourLabel(x: number): string {
  const total = Math.round((WINDOW_START_HOUR * 60 + x * 60) % (24 * 60));
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}.${String(mm).padStart(2, "0")}`;
}

export function tonightDates(wibNow: Date): { eveningDate: string; morningDate: string; hour: number } {
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

export function wibWallClock(ms: number): Date {
  return new Date(ms + 7 * 60 * 60 * 1000);
}

export type OutdoorPoint = { x: number; temp: number };

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

export function nowOffset(wibNow: Date): number | null {
  const hour = wibNow.getUTCHours();
  const minute = wibNow.getUTCMinutes();
  const decimal = hour + minute / 60;
  if (decimal >= WINDOW_START_HOUR) return decimal - WINDOW_START_HOUR;
  if (decimal <= WINDOW_START_HOUR - 24 + WINDOW_HOURS) return decimal + (24 - WINDOW_START_HOUR);
  return null;
}
