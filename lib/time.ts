/**
 * One timezone for the whole platform: Africa/Harare, UTC+2.
 *
 * Timestamps are stored as `timestamptz` — absolute instants, in UTC. That is
 * correct and does not change. What changes is the rendering: every date on
 * screen was formatted with no explicit zone, which means it took whichever
 * clock happened to be nearest. Server-rendered pages used the server's, and on
 * Vercel that is UTC; client-rendered ones used the viewer's. The same incident
 * could therefore carry two different times depending on which component drew
 * it, and a page rendered on the server and hydrated in the browser could show
 * one time and then silently change to another.
 *
 * A ward officer works in one timezone. Pinning it here means the platform tells
 * everybody the same time, wherever it is rendered and wherever they are.
 */
export const TZ = "Africa/Harare";
const LOCALE = "en-ZW";

/** "Mon, 31 Aug, 14:33" — the default for anything with a time of day. */
export function formatDateTime(value: Date | string | number): string {
  return new Date(value).toLocaleString(LOCALE, {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "31 Aug, 14:33" — compact, for table cells. */
export function formatShortDateTime(value: Date | string | number): string {
  return new Date(value).toLocaleString(LOCALE, {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "31 Aug 2026" — a date with no time of day. */
export function formatDate(value: Date | string | number): string {
  return new Date(value).toLocaleDateString(LOCALE, {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "Mon" — weekday only, for chart axes. */
export function formatWeekday(value: Date | string | number): string {
  return new Date(value).toLocaleDateString(LOCALE, { timeZone: TZ, weekday: "short" });
}

/** "14:33" — clock time only. */
export function formatTime(value: Date | string | number): string {
  return new Date(value).toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
