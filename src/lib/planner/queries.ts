import "server-only";
import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { classes, getDb, settings, status, tasks } from "@/db";
import type { Class, ClassColor, Task } from "@/db";
import { decryptFeed } from "./crypto";
import { rankAsc } from "./ranks-db";
import { maskFeedUrl } from "./schemas";
import { statusText, type StatusMode } from "./status";
import { PLANNER_TZ } from "./time";

// Read side of the planner. Owner-only reads (everything except getNowData)
// are uncached: /planner renders per request behind requireOwner(). Callers
// must gate them; these functions do not check the session.

// Day boundaries in the owner's timezone (see time.ts), computed in SQL so
// no request-time API or server clock is needed.
const todayDate = sql`(now() AT TIME ZONE ${PLANNER_TZ}::text)::date`;
const startOfToday = sql`(date_trunc('day', now() AT TIME ZONE ${PLANNER_TZ}::text) AT TIME ZONE ${PLANNER_TZ}::text)`;

/** Today's list = open tasks + tasks done today. Change the rule here. */
const onTodaysList = or(eq(tasks.done, false), sql`${tasks.doneAt} >= ${startOfToday}`);

/** Every task, most important first (rank in byte order). */
export async function listTasks(): Promise<Task[]> {
  return getDb().select().from(tasks).orderBy(...rankAsc);
}

/** The running checklist: open tasks plus those done today, in rank order. */
export async function listChecklist(): Promise<Task[]> {
  return getDb().select().from(tasks).where(onTodaysList).orderBy(...rankAsc);
}

/** Classes first, then categories; each by name. */
export async function listClasses(): Promise<Class[]> {
  return getDb().select().from(classes).orderBy(asc(classes.kind), asc(classes.name));
}

export type StatusView = {
  mode: StatusMode;
  text: string | null;
  classId: string | null;
  className: string | null;
  classColor: ClassColor | null;
  taskId: string | null;
  /** null until a status has ever been set. */
  since: Date | null;
  /** Rendered line, e.g. "Studying for ICS 46". */
  line: string;
};

const FREE: StatusView = {
  mode: "free",
  text: null,
  classId: null,
  className: null,
  classColor: null,
  taskId: null,
  since: null,
  line: statusText({ mode: "free", text: null, className: null }),
};

export async function getStatus(): Promise<StatusView> {
  const [row] = await getDb()
    .select({
      mode: status.mode,
      text: status.text,
      classId: status.classId,
      className: classes.name,
      classColor: classes.color,
      taskId: status.taskId,
      since: status.since,
    })
    .from(status)
    .leftJoin(classes, eq(classes.id, status.classId))
    .where(eq(status.id, 1));
  if (!row) return FREE;
  return { ...row, line: statusText(row) };
}

export type SettingsView = {
  hasFeed: boolean;
  /** e.g. "https://canvas.eee.uci.edu/••••••••.ics"; null if none/unreadable. */
  feedMasked: string | null;
  /** false when a feed is stored but can't be decrypted (key changed?). */
  feedReadable: boolean;
  lastSyncedAt: Date | null;
};

/** Settings for the UI. Never returns the feed URL or its ciphertext. */
export async function getSettingsMasked(): Promise<SettingsView> {
  const [row] = await getDb().select().from(settings).where(eq(settings.id, 1));
  if (!row?.canvasFeedEnc) {
    return { hasFeed: false, feedMasked: null, feedReadable: true, lastSyncedAt: row?.lastSyncedAt ?? null };
  }
  let feedMasked: string | null = null;
  try {
    feedMasked = maskFeedUrl(decryptFeed(row.canvasFeedEnc));
  } catch {
    // Fail closed: report unreadable, never the reason or value.
  }
  return { hasFeed: true, feedMasked, feedReadable: feedMasked !== null, lastSyncedAt: row.lastSyncedAt };
}

export type DueSoonRow = { classId: string; name: string; color: ClassColor; minutes: number };

/**
 * "Due next 3 days · by hours": estimated minutes of open tasks with a class,
 * an estimate and a due date before today + `days` (overdue included),
 * grouped by class, biggest first.
 */
export async function getDueSoon(days = 3): Promise<DueSoonRow[]> {
  const minutes = sql<number>`sum(${tasks.estMinutes})::int`;
  return getDb()
    .select({ classId: classes.id, name: classes.name, color: classes.color, minutes })
    .from(tasks)
    .innerJoin(classes, eq(classes.id, tasks.classId))
    .where(
      and(
        eq(tasks.done, false),
        isNotNull(tasks.estMinutes),
        isNotNull(tasks.dueDate),
        sql`${tasks.dueDate} < ${todayDate} + ${days}::int`,
      ),
    )
    .groupBy(classes.id)
    .orderBy(desc(minutes), asc(classes.name));
}

export type TodayCounts = { done: number; total: number };

/** "X of Y done" over today's list (open + done today). */
export async function getTodayCounts(): Promise<TodayCounts> {
  const [row] = await getDb()
    .select({
      done: sql<number>`count(*) FILTER (WHERE ${tasks.done})::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(tasks)
    .where(onTodaysList);
  return row ?? { done: 0, total: 0 };
}

export type NowData = {
  mode: StatusMode;
  /** Rendered line, e.g. "Building Cofura chat". */
  line: string;
  classColor: ClassColor | null;
  since: Date | null;
  done: number;
  total: number;
};

/**
 * Public /now data. Uses no request-time APIs, so Task 6 can wrap it in
 * 'use cache' + cacheTag(TAGS.now). Exposes no task ids, titles (beyond a
 * status the owner chose to publish) or class ids. "Today" is fixed when
 * the cache entry is filled: pick a cacheLife that rolls over at midnight.
 */
export async function getNowData(): Promise<NowData> {
  const [s, counts] = await Promise.all([getStatus(), getTodayCounts()]);
  return {
    mode: s.mode,
    line: s.line,
    classColor: s.mode === "study" ? s.classColor : null,
    since: s.since,
    done: counts.done,
    total: counts.total,
  };
}
