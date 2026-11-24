// Yogyakarta wall-clock time (WIB), only called in the browser after hydration.

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type Dateline = { text: string; iso: string };

/** 2026-10-03T12:40Z -> "19.40 WIB" */
export function formatWibTime(ms: number): Dateline {
  const date = new Date(ms);
  return {
    text: `${timeFormat.format(date)} WIB`,
    iso: date.toISOString(),
  };
}
