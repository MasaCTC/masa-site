// Date-only helpers for the planner UI. Pure (no "@/" imports) so node:test
// can load it. Due dates are calendar days ("YYYY-MM-DD"), not instants: all
// math runs in UTC on noon-free date-only values, and every formatter passes
// timeZone "UTC" so the browser's zone can never shift a day.

const DAY_MS = 86_400_000;

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return toIso(new Date(toUtc(iso).getTime() + n * DAY_MS));
}

/** Whole days from `from` to `to` (to - from). */
export function dayDiff(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS);
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const dow = (toUtc(iso).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(iso, -dow);
}

/** First day of the month `n` months after the month of `iso`. */
export function addMonths(iso: string, n: number): string {
  const dt = toUtc(iso);
  return toIso(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + n, 1)));
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * The month grid: Monday-first, starting on or before the 1st. 5 rows, or 6
 * when the month spills into a sixth week.
 */
export function monthGrid(iso: string): string[] {
  const first = addMonths(iso, 0);
  const start = weekStart(first);
  const days: string[] = [];
  for (let k = 0; k < 42; k++) {
    const d = addDays(start, k);
    // A sixth row only when the month reaches into it (then it is drawn whole).
    if (k === 35 && monthOf(d) !== monthOf(first)) break;
    days.push(d);
  }
  return days;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return toUtc(iso).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** "due today" · "due tomorrow" · "due Wed" (this week) · "due Oct 27". */
export function dueLabel(due: string, today: string): string {
  const days = dayDiff(today, due);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days > 0 && days < 7) return "due " + fmtDate(due, { weekday: "short" });
  return "due " + fmtDate(due, { month: "short", day: "numeric" });
}

/** 90 -> "1h 30m", 60 -> "1h", 15 -> "15m". null/0 -> "". */
export function fmtMinutes(m: number | null | undefined): string {
  if (!m) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return (h ? h + "h" : "") + (r ? (h ? " " : "") + r + "m" : "");
}
