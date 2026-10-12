import { test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  chunk,
  importRows,
  claimSql,
  insertClassesSql,
  orderForImport,
  planNewClasses,
  releaseSql,
  SYNC_WINDOW_SECONDS,
  upsertTasksSql,
} from "./canvas-plan.ts";
import type { CanvasAssignment } from "./canvas-parse.ts";

const render = (q: SQL) => new PgDialect().sqlToQuery(q);
const flat = (s: string) => s.replace(/\s+/g, " ").trim();

const a = (uid: string, over: Partial<CanvasAssignment> = {}): CanvasAssignment => ({
  uid,
  title: `T ${uid}`,
  courseCode: "ICS 46",
  dueDate: "2026-10-13",
  url: null,
  ...over,
});

test("new classes: one per unseen course code, least-used colors, existing codes reused", () => {
  const plan = planNewClasses(
    [a("1", { courseCode: "ICS 46" }), a("2", { courseCode: "ICS 51" }), a("3", { courseCode: "ICS 51" }), a("4", { courseCode: null }), a("5", { courseCode: "STATS 67" })],
    [
      { canvasCode: "ICS 46", color: "teal" },
      { canvasCode: null, color: "clay" },
    ],
  );
  assert.deepEqual(
    plan.map((c) => c.code),
    ["ICS 51", "STATS 67"],
  );
  // Names are the course code (the owner can rename; sync never renames).
  assert.deepEqual(
    plan.map((c) => c.name),
    ["ICS 51", "STATS 67"],
  );
  // Colors skip the two in use and do not repeat each other.
  assert.ok(!plan.some((c) => c.color === "teal" || c.color === "clay"));
  assert.notEqual(plan[0].color, plan[1].color);
});

test("class names are capped at 80 characters, codes kept whole", () => {
  const code = "C".repeat(150);
  const [c] = planNewClasses([a("1", { courseCode: code })], []);
  assert.equal(c.code, code);
  assert.equal(c.name.length, 80);
});

test("imports are ordered by due date (undated last), then title, then uid", () => {
  const out = orderForImport([
    a("u4", { dueDate: null, title: "Z" }),
    a("u2", { dueDate: "2026-10-20", title: "B" }),
    a("u3", { dueDate: "2026-10-13", title: "B" }),
    a("u1", { dueDate: "2026-10-13", title: "A" }),
    a("u0", { dueDate: null, title: "A" }),
  ]);
  assert.deepEqual(
    out.map((x) => x.uid),
    ["u1", "u3", "u2", "u0", "u4"],
  );
});

test("class insert never overwrites an existing class", () => {
  const { sql, params } = render(insertClassesSql([{ code: "ICS 51", name: "ICS 51", color: "teal" }]));
  assert.equal(
    flat(sql),
    "INSERT INTO classes (name, kind, color, canvas_code) VALUES ($1, 'class', $2::class_color, $3) ON CONFLICT (canvas_code) DO NOTHING",
  );
  assert.deepEqual(params, ["ICS 51", "teal", "ICS 51"]);
});

test("task upsert: rank only on insert; hand-edited rows keep their title; done/rank/class never updated", () => {
  const { sql, params } = render(
    upsertTasksSql([
      { a: a("event-assignment-1", { url: "https://x/1" }), rank: "V" },
      { a: a("event-assignment-2", { courseCode: null, dueDate: null }), rank: "W" },
    ]),
  );
  const s = flat(sql);
  assert.match(s, /^INSERT INTO tasks \(title, class_id, due_date, rank, source, canvas_uid, canvas_url\) VALUES /);
  assert.match(s, /\(\$1, \(SELECT id FROM classes WHERE canvas_code = \$2\), \$3::date, \$4, 'canvas', \$5, \$6\)/);
  assert.match(s, /\(\$7, NULL, \$8::date, \$9, 'canvas', \$10, \$11\)/);
  const set = s.slice(s.indexOf("ON CONFLICT"));
  assert.equal(
    set,
    "ON CONFLICT (canvas_uid) DO UPDATE SET due_date = excluded.due_date, canvas_url = excluded.canvas_url, title = CASE WHEN tasks.hand_edited THEN tasks.title ELSE excluded.title END",
  );
  for (const col of ["rank", "done", "class_id", "source", "hand_edited ="]) {
    assert.ok(!set.includes(`${col} =`) && !set.includes(`SET ${col}`), `must not update ${col}`);
  }
  assert.deepEqual(params, [
    "T event-assignment-1", "ICS 46", "2026-10-13", "V", "event-assignment-1", "https://x/1",
    "T event-assignment-2", null, "W", "event-assignment-2", null,
  ]);
});

test("chunk splits into fixed-size pieces", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 2), []);
});

test("claim: one atomic UPDATE gated on the window, returning the previous value as text", () => {
  assert.equal(SYNC_WINDOW_SECONDS.open, 120);
  const { sql, params } = render(claimSql(120));
  assert.equal(
    flat(sql),
    "UPDATE settings SET last_synced_at = now() FROM (SELECT last_synced_at AS prev FROM settings WHERE id = 1) AS p " +
      "WHERE settings.id = 1 AND settings.canvas_feed_enc IS NOT NULL " +
      "AND (settings.last_synced_at IS NULL OR settings.last_synced_at < now() - make_interval(secs => $1)) " +
      "RETURNING settings.canvas_feed_enc AS enc, settings.last_synced_at::text AS claimed, p.prev::text AS prev",
  );
  assert.deepEqual(params, [120]);
});

test("release: restores the previous value only if nobody re-claimed since (text timestamps, exact match)", () => {
  const { sql, params } = render(releaseSql("2026-10-12 17:00:00.123456+00", null));
  assert.equal(
    flat(sql),
    "UPDATE settings SET last_synced_at = $1::timestamptz WHERE id = 1 AND last_synced_at = $2::timestamptz",
  );
  assert.deepEqual(params, [null, "2026-10-12 17:00:00.123456+00"]);
});

test("importRows: fresh bottom ranks only for new uids, in order; existing rows carry the spare rank", () => {
  const rows = importRows([a("n1"), a("old"), a("n2")], new Set(["old"]), ["V", "W", "X"]);
  assert.deepEqual(
    rows.map((r) => [r.a.uid, r.rank]),
    [["n1", "V"], ["old", "X"], ["n2", "W"]],
  );
  assert.throws(() => importRows([a("n1")], new Set(), ["V"]), /one rank per new row/);
});
