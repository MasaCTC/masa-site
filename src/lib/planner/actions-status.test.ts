// The /now status follows the task it shows: deleteTask frees it and a title
// edit renames it, each in the same db.batch (one transaction) as the task
// write. Runs the real actions against the recording fake database from
// src/test/stubs (nothing reaches a real database).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { deleteTask, editTask, toggleDone } from "./actions.ts";
import { OWNER_GITHUB_ID, setSession } from "../../test/stubs/auth.ts";
import { dbLog, resetDb, type Sent } from "../../test/stubs/db.ts";
import { cacheCalls } from "../../test/stubs/next-cache.ts";

const ID = "00000000-0000-4000-8000-000000000001";
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const touchesStatus = (q: Sent) => /"status"/.test(q.sql);

// A tasks row in column order (array mode), for UPDATE … RETURNING.
const taskRow = (title: string) => [ID, title, null, null, null, false, null, "a0", "manual", null, null, false, null];

const nowInvalidated = () =>
  cacheCalls.some((c) => c.fn === "updateTag" && c.arg === "now") &&
  cacheCalls.some((c) => c.fn === "revalidatePath" && c.arg === "/now");

beforeEach(() => {
  resetDb();
  cacheCalls.length = 0;
  setSession({ user: { githubId: OWNER_GITHUB_ID } });
});

test("deleteTask frees the status in the same batch, before the DELETE", async () => {
  resetDb(({ sql }) => (sql.startsWith('delete from "tasks"') ? [[ID]] : []));
  assert.deepEqual(await deleteTask({ id: ID }), { ok: true, id: ID });

  assert.equal(dbLog.length, 1, "one round trip");
  const [entry] = dbLog;
  assert.equal(entry.kind, "batch");
  if (entry.kind !== "batch") return;
  const [statusUpdate, del] = entry.queries;
  assert.equal(entry.queries.length, 2);
  // status.task_id is ON DELETE SET NULL: the UPDATE must run first.
  assert.equal(
    flat(statusUpdate.sql),
    'update "status" set "mode" = $1, "class_id" = $2, "text" = $3, "task_id" = $4, "since" = now() where "status"."task_id" = $5',
  );
  assert.deepEqual(statusUpdate.params, ["free", null, null, null, ID]);
  assert.match(del.sql, /^delete from "tasks" where "tasks"\."id" = \$1 returning/);
  assert.deepEqual(del.params, [ID]);
  assert.ok(nowInvalidated(), "/now cache invalidated");
});

test("deleteTask of a missing task: not_found, cache untouched", async () => {
  assert.deepEqual(await deleteTask({ id: ID }), { ok: false, error: "not_found" });
  assert.deepEqual(cacheCalls, []);
});

test("editTask with a new title renames the status in the same batch", async () => {
  resetDb(({ sql }) => (sql.startsWith('update "tasks"') ? [taskRow("Renamed")] : []));
  const result = await editTask({ id: ID, title: "  Renamed  " });
  assert.equal(result.ok, true);

  assert.equal(dbLog.length, 1, "one round trip");
  const [entry] = dbLog;
  assert.equal(entry.kind, "batch");
  if (entry.kind !== "batch") return;
  assert.equal(entry.queries.length, 2);
  const [taskUpdate, statusUpdate] = entry.queries;
  assert.match(taskUpdate.sql, /^update "tasks" set "title" = \$1/);
  // Trimmed title; `since` is left alone on a rename.
  assert.equal(flat(statusUpdate.sql), 'update "status" set "text" = $1 where "status"."task_id" = $2');
  assert.deepEqual(statusUpdate.params, ["Renamed", ID]);
  assert.ok(nowInvalidated(), "/now cache invalidated");
});

test("editTask without a title leaves the status alone", async () => {
  resetDb(({ sql }) => (sql.startsWith('update "tasks"') ? [taskRow("Same")] : []));
  const result = await editTask({ id: ID, dueDate: "2026-10-20" });
  assert.equal(result.ok, true);
  assert.equal(dbLog.length, 1);
  assert.equal(dbLog[0].kind, "query");
  if (dbLog[0].kind === "query") assert.equal(touchesStatus(dbLog[0]), false);
});

test("toggleDone does not touch the status (unchanged behaviour)", async () => {
  resetDb(({ sql }) => (sql.startsWith('update "tasks"') ? [taskRow("Essay")] : []));
  const result = await toggleDone({ id: ID, done: true });
  assert.equal(result.ok, true);
  const sent = dbLog.flatMap((e) => (e.kind === "batch" ? e.queries : [e]));
  assert.equal(sent.some(touchesStatus), false);
});
