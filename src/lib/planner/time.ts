// Planner day boundaries. Pure (no server-only, no "@/" imports).
//
// "Today" is a calendar day in the owner's timezone, not the server's (the
// host runs in UTC). Change it here; SQL reads it as a bound parameter.
export const PLANNER_TZ = "America/Los_Angeles";

/** YYYY-MM-DD for `now` in PLANNER_TZ. */
export function plannerToday(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PLANNER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
