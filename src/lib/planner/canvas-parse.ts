// Canvas calendar feed -> assignments. Pure (no server-only, no "@/"
// imports) so node:test can load it; server code only (ical.js is ~1 MB and
// must not reach the client bundle). ical.js only parses text here: it never
// fetches anything.
//
// Canvas feeds: one VEVENT per assignment (UID "event-assignment-<id>") or
// calendar event ("event-calendar-event-<id>", skipped: not a task). SUMMARY
// is "Title [COURSE CODE]"; URL links to the assignment; DTSTART is a DATE
// (all-day) or a UTC DATE-TIME (due time).
import ICAL from "ical.js";
import { plannerToday } from "./time.ts";

export type CanvasAssignment = {
  uid: string;
  title: string;
  /** Trailing [ … ] of the SUMMARY, or null. */
  courseCode: string | null;
  /** YYYY-MM-DD in PLANNER_TZ, or null. */
  dueDate: string | null;
  /** http(s) link to the assignment, or null. */
  url: string | null;
};

export class CanvasFeedError extends Error {
  readonly reason = "not_ics" as const;
  constructor() {
    // Never include the feed text: it can carry private course data.
    super("Canvas feed is not a calendar");
    this.name = "CanvasFeedError";
  }
}

const ASSIGNMENT_UID = /^event-assignment-/;
const TITLE_MAX = 300; // schemas.ts task title limit
const CODE_MAX = 200;
const UID_MAX = 255;
const URL_MAX = 2048;

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** "HW 3 [ICS 31 FALL 2026]" -> { title: "HW 3", courseCode: "ICS 31 FALL 2026" }. */
export function splitSummary(summary: string): { title: string; courseCode: string | null } {
  const s = squash(summary);
  const m = /^(.*?)\s*\[([^[\]]*[^[\]\s][^[\]]*)\]$/.exec(s);
  if (!m) return { title: s, courseCode: null };
  return { title: m[1], courseCode: squash(m[2]) };
}

function safeUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > URL_MAX) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const ymd = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** Offset (ms) of `tz` from UTC at instant `t`. Throws RangeError on an unknown zone. */
function tzOffset(t: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(t));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - t;
}

function dueDateOf(ev: ICAL.Component): string | null {
  const prop = ev.getFirstProperty("dtstart") ?? ev.getFirstProperty("due");
  const v = prop?.getFirstValue();
  if (!(v instanceof ICAL.Time)) return null;
  // All-day: the date as written.
  if (v.isDate) return ymd(v.year, v.month, v.day);
  const wall = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  if (v.zone?.tzid === "UTC") return plannerToday(new Date(wall));
  const tzid = prop!.getParameter("tzid");
  if (typeof tzid === "string" && tzid) {
    try {
      // Wall time in tzid -> instant (two passes settle DST edges).
      let t = wall - tzOffset(wall, tzid);
      t = wall - tzOffset(t, tzid);
      return plannerToday(new Date(t));
    } catch {
      // Unknown zone: fall through to the wall date.
    }
  }
  // Floating time: read as planner-local, so the wall date is the due date.
  return ymd(v.year, v.month, v.day);
}

/**
 * Parses the whole feed (throws before anything is written if it is not a
 * calendar) and returns its assignments, first occurrence per UID.
 */
export function parseCanvasFeed(text: string): CanvasAssignment[] {
  if (!/^﻿?\s*BEGIN:VCALENDAR/i.test(text)) throw new CanvasFeedError();
  let root: ICAL.Component;
  try {
    const jcal = ICAL.parse(text);
    // A feed is one VCALENDAR; ICAL.parse returns an array for several.
    root = new ICAL.Component(Array.isArray(jcal[0]) ? jcal[0] : jcal);
  } catch {
    // ical.js errors quote the offending line: never pass them on.
    throw new CanvasFeedError();
  }
  if (root.name !== "vcalendar") throw new CanvasFeedError();

  const seen = new Set<string>();
  const out: CanvasAssignment[] = [];
  for (const ev of root.getAllSubcomponents("vevent")) {
    const uidRaw = ev.getFirstPropertyValue("uid");
    const uid = typeof uidRaw === "string" ? uidRaw.trim() : "";
    if (!ASSIGNMENT_UID.test(uid) || uid.length > UID_MAX || seen.has(uid)) continue;
    seen.add(uid);

    const summary = ev.getFirstPropertyValue("summary");
    const { title, courseCode } = splitSummary(typeof summary === "string" ? summary : "");
    out.push({
      uid,
      title: (title || "Untitled assignment").slice(0, TITLE_MAX),
      courseCode: courseCode ? courseCode.slice(0, CODE_MAX) : null,
      dueDate: dueDateOf(ev),
      url: safeUrl(ev.getFirstPropertyValue("url")),
    });
  }
  return out;
}
