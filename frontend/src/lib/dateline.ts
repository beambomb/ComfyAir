// Masthead dateline, always in Yogyakarta time (WIB) whatever the visitor's zone.
// Only called in the browser after hydration; the server renders a placeholder.

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type Dateline = { text: string; iso: string };

/** 2026-10-03T12:40Z -> "Sabtu, 3 Oktober 2026 · 19.40 WIB" */
export function formatDateline(ms: number): Dateline {
  const date = new Date(ms);
  return {
    text: `${dateFormat.format(date)} · ${timeFormat.format(date)} WIB`,
    iso: date.toISOString(),
  };
}
