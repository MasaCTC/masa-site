// Pure pieces of the Canvas sync (no server-only, no "@/" imports): which
// classes to create, import order, and the SQL for the claim and the upserts,
// so node:test can check them without a database.
//
// neon-http has no interactive transactions, so the write is a single
// db.batch (one transaction) of: class INSERT … ON CONFLICT DO NOTHING, task
// INSERT … ON CONFLICT (canvas_uid) DO UPDATE, then the settings stamp. Class
// ids are looked up inside the task INSERT by canvas_code, so nothing in the
// batch depends on an earlier statement's result. Running it twice creates
// nothing new.
import { sql, type SQL } from "drizzle-orm";
import type { CanvasAssignment } from "./canvas-parse.ts";
import { leastUsedColor, type ClassColor } from "./colors.ts";

/** Seconds since the last sync (or claim) before another may start. */
export const SYNC_WINDOW_SECONDS = {
  /** Automatic sync when the planner opens. */
  open: 120,
  /** "Try again" / "Sync now": only guards against double clicks and a sync already running. */
  manual: 15,
} as const;

const CLASS_NAME_MAX = 80; // schemas.ts class name limit

export type NewCanvasClass = { code: string; name: string; color: ClassColor };

/**
 * One class per course code that no existing class claims (matched by
 * canvas_code only; existing classes are never renamed or recolored).
 * Colors: least used among all classes, counting the ones planned here.
 */
export function planNewClasses(
  assignments: readonly CanvasAssignment[],
  existing: readonly { canvasCode: string | null; color: ClassColor }[],
): NewCanvasClass[] {
  const known = new Set(existing.map((c) => c.canvasCode).filter((c): c is string => c !== null));
  const used = existing.map((c) => c.color);
  const out: NewCanvasClass[] = [];
  for (const { courseCode } of assignments) {
    if (!courseCode || known.has(courseCode)) continue;
    known.add(courseCode);
    const color = leastUsedColor(used);
    used.push(color);
    out.push({ code: courseCode, name: courseCode.slice(0, CLASS_NAME_MAX), color });
  }
  return out;
}

const byText = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

/** Import order (new rows land at the bottom in this order): due date, undated last, then title, uid. */
export function orderForImport(assignments: readonly CanvasAssignment[]): CanvasAssignment[] {
  return [...assignments].sort(
    (x, y) =>
      (x.dueDate === y.dueDate ? 0 : x.dueDate === null ? 1 : y.dueDate === null ? -1 : byText(x.dueDate, y.dueDate)) ||
      byText(x.title, y.title) ||
      byText(x.uid, y.uid),
  );
}

export function chunk<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/**
 * Pairs each assignment (in import order) with a rank. Only uids not already
 * in the database consume a fresh bottom rank, so syncing a long feed does
 * not push the bottom rank further each time. Rows that already exist carry
 * the spare last rank as a placeholder: ON CONFLICT never writes it (and if
 * the row vanished meanwhile, it is inserted at the bottom).
 * `ranks` = bottomRanks(newCount + 1).
 */
export function importRows(
  ordered: readonly CanvasAssignment[],
  existingUids: ReadonlySet<string>,
  ranks: readonly string[],
): { a: CanvasAssignment; rank: string }[] {
  const fresh = ordered.filter((x) => !existingUids.has(x.uid)).length;
  if (ranks.length !== fresh + 1) throw new Error("need one rank per new row plus a spare");
  const spare = ranks[fresh];
  let i = 0;
  return ordered.map((a) => ({ a, rank: existingUids.has(a.uid) ? spare : ranks[i++] }));
}

export function insertClassesSql(rows: readonly NewCanvasClass[]): SQL {
  const values = sql.join(
    rows.map((c) => sql`(${c.name}, 'class', ${c.color}::class_color, ${c.code})`),
    sql`, `,
  );
  return sql`INSERT INTO classes (name, kind, color, canvas_code) VALUES ${values} ON CONFLICT (canvas_code) DO NOTHING`;
}

/**
 * Upsert by canvas_uid. `rank` is used only when the row is new (bottom of
 * the checklist). Existing rows get due_date and canvas_url refreshed always,
 * and title only when not hand-edited; rank, done, class_id and source are
 * never touched (the owner may have moved, checked or re-filed it).
 */
export function upsertTasksSql(rows: readonly { a: CanvasAssignment; rank: string }[]): SQL {
  const values = sql.join(
    rows.map(({ a, rank }) => {
      const classId = a.courseCode === null ? sql`NULL` : sql`(SELECT id FROM classes WHERE canvas_code = ${a.courseCode})`;
      return sql`(${a.title}, ${classId}, ${a.dueDate}::date, ${rank}, 'canvas', ${a.uid}, ${a.url})`;
    }),
    sql`, `,
  );
  return sql`INSERT INTO tasks (title, class_id, due_date, rank, source, canvas_uid, canvas_url) VALUES ${values} ON CONFLICT (canvas_uid) DO UPDATE SET due_date = excluded.due_date, canvas_url = excluded.canvas_url, title = CASE WHEN tasks.hand_edited THEN tasks.title ELSE excluded.title END`;
}

/**
 * Atomic claim: stamps last_synced_at only if a feed is saved and the last
 * sync/claim is older than the window, so concurrent tabs cannot both sync.
 * Timestamps come back as text: Postgres keeps microseconds, a JS Date would
 * drop them and the release's exact match would never hit.
 */
export function claimSql(windowSeconds: number): SQL {
  return sql`UPDATE settings SET last_synced_at = now() FROM (SELECT last_synced_at AS prev FROM settings WHERE id = 1) AS p WHERE settings.id = 1 AND settings.canvas_feed_enc IS NOT NULL AND (settings.last_synced_at IS NULL OR settings.last_synced_at < now() - make_interval(secs => ${windowSeconds})) RETURNING settings.canvas_feed_enc AS enc, settings.last_synced_at::text AS claimed, p.prev::text AS prev`;
}

/** After a failed sync: put back the last successful time, unless someone claimed again since. */
export function releaseSql(claimed: string, prev: string | null): SQL {
  return sql`UPDATE settings SET last_synced_at = ${prev}::timestamptz WHERE id = 1 AND last_synced_at = ${claimed}::timestamptz`;
}
