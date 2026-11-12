import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { plannerToday } from "./time.ts";

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const statements = (file: string) =>
  readFileSync(join(dir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

test("on_today migration backfills manual tasks and prunes stale Canvas tasks", async () => {
  const db = new PGlite();
  const initial = files.find((f) => f.startsWith("0000_"));
  const migration = files.find((f) => f.startsWith("0001_"));
  assert.ok(initial && migration);
  for (const s of statements(initial)) await db.exec(s);

  const today = plannerToday();
  const past = addDays(today, -3);
  const yesterday = addDays(today, -1);
  const future = addDays(today, 5);

  // [title, source, due, hand_edited, done]
  const rows: [string, string, string | null, boolean, boolean][] = [
    ["manual-past", "manual", past, false, false],
    ["manual-undated", "manual", null, false, false],
    ["manual-future", "manual", future, false, false],
    ["canvas-yesterday", "canvas", yesterday, false, false],
    ["canvas-today", "canvas", today, false, false],
    ["canvas-future", "canvas", future, false, false],
    ["canvas-undated", "canvas", null, false, false],
    ["canvas-past-hand-edited", "canvas", past, true, false],
    ["canvas-past-done", "canvas", past, false, true],
    ["canvas-past-current", "canvas", past, false, false],
    ["canvas-past-other", "canvas", past, false, false],
  ];
  let i = 0;
  for (const [title, source, due, edited, done] of rows) {
    i++;
    await db.query(
      `INSERT INTO tasks (title, rank, source, due_date, hand_edited, done) VALUES ($1, $2, $3, $4, $5, $6)`,
      [title, `r${String(i).padStart(2, "0")}`, source, due, edited, done],
    );
  }
  await db.exec(
    `INSERT INTO status (id, mode, task_id) SELECT 1, 'build', id FROM tasks WHERE title = 'canvas-past-current'`,
  );

  for (const s of statements(migration)) await db.exec(s);

  const res = await db.query<{ title: string; source: string; on_today: boolean }>(
    `SELECT title, source, on_today FROM tasks ORDER BY title`,
  );
  assert.deepEqual(
    res.rows.map((r) => r.title),
    [
      "canvas-future",
      "canvas-past-current",
      "canvas-past-done",
      "canvas-past-hand-edited",
      "canvas-today",
      "canvas-undated",
      "manual-future",
      "manual-past",
      "manual-undated",
    ],
  );
  // Canvas yesterday and past-other were pruned.
  for (const r of res.rows) assert.equal(r.on_today, r.source === "manual", r.title);

  const st = await db.query<{ title: string }>(
    `SELECT t.title FROM status s JOIN tasks t ON t.id = s.task_id WHERE s.id = 1`,
  );
  assert.deepEqual(st.rows, [{ title: "canvas-past-current" }]);
  await db.close();
});

test("on_today migration prunes stale Canvas tasks when there is no status row", async () => {
  const db = new PGlite();
  const initial = files.find((f) => f.startsWith("0000_"))!;
  const migration = files.find((f) => f.startsWith("0001_"))!;
  for (const s of statements(initial)) await db.exec(s);
  const past = addDays(plannerToday(), -3);
  await db.query(
    `INSERT INTO tasks (title, rank, source, due_date) VALUES ('stale', 'a', 'canvas', $1), ('undated', 'b', 'canvas', NULL)`,
    [past],
  );
  await db.exec(`INSERT INTO status (id, mode) VALUES (1, 'free')`); // task_id NULL
  for (const s of statements(migration)) await db.exec(s);
  const res = await db.query<{ title: string }>(`SELECT title FROM tasks`);
  assert.deepEqual(res.rows, [{ title: "undated" }]);
  await db.close();
});
