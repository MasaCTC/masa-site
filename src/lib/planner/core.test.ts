// The planner core against the recording fake database: no owner check, no
// cache invalidation (callers do both).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { addTaskCore, toggleDoneCore } from "./core.ts";
import { dbLog, resetDb, type Sent } from "../../test/stubs/db.ts";
import { cacheCalls } from "../../test/stubs/next-cache.ts";

const ID = "00000000-0000-4000-8000-000000000001";
const taskRow = [ID, "T", null, null, null, false, null, "a0", "manual", null, null, false, null, true];

beforeEach(() => {
  resetDb();
  cacheCalls.length = 0;
});

test("addTaskCore inserts and returns ok without invalidating the cache", async () => {
  resetDb(({ sql }: Sent) => (sql.startsWith('insert into "tasks"') ? [taskRow] : []));
  const r = await addTaskCore({ title: "T" });
  assert.equal(r.ok, true);
  assert.ok(dbLog.some((e) => e.kind === "query" && e.sql.startsWith('insert into "tasks"')));
  assert.deepEqual(cacheCalls, []);
});

test("addTaskCore rejects a blank title before touching the database", async () => {
  const r = await addTaskCore({ title: "  " });
  assert.equal(r.ok === false && r.error, "invalid");
  assert.deepEqual(dbLog, []);
});

test("toggleDoneCore on a missing id is not_found", async () => {
  assert.deepEqual(await toggleDoneCore({ id: ID, done: true }), { ok: false, error: "not_found" });
  assert.deepEqual(cacheCalls, []);
});
