// addToToday / removeFromToday against the recording fake database.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { addTask, addToToday, removeFromToday } from "./actions.ts";
import { OWNER_GITHUB_ID, setSession } from "../../test/stubs/auth.ts";
import { dbLog, resetDb, type Sent } from "../../test/stubs/db.ts";
import { cacheCalls } from "../../test/stubs/next-cache.ts";

const ID = "00000000-0000-4000-8000-000000000001";
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const taskRow = [ID, "T", null, null, null, false, null, "a0", "manual", null, null, false, null, true];
const updates = () => dbLog.filter((e): e is Extract<typeof e, { kind: "query" }> => e.kind === "query" && e.sql.startsWith('update "tasks"'));
const nowInvalidated = () =>
  cacheCalls.some((c) => c.fn === "updateTag" && c.arg === "now") &&
  cacheCalls.some((c) => c.fn === "revalidatePath" && c.arg === "/now");

beforeEach(() => {
  resetDb();
  cacheCalls.length = 0;
  setSession({ user: { githubId: OWNER_GITHUB_ID } });
});

test("addToToday sets on_today and a bottom rank, not hand_edited", async () => {
  resetDb(({ sql }: Sent) => (sql.startsWith('select "rank"') ? [["a5"]] : sql.startsWith('update "tasks"') ? [taskRow] : []));
  const r = await addToToday({ id: ID });
  assert.equal(r.ok, true);
  const [u] = updates();
  assert.ok(u, "an UPDATE was sent");
  const q = flat(u.sql);
  assert.match(q, /, "on_today" = \$2 where/);
  assert.deepEqual(u.params.slice(1), [true, ID]);
  assert.match(q, /"rank" = case when "tasks"\."on_today" then "tasks"\."rank" else \$1 end/);
  assert.ok(!/hand_edited/.test(q.split(" where ")[0]), "hand_edited untouched");
  assert.equal(typeof u.params[0], "string");
  assert.ok((u.params[0] as string) > "a5", "rank below the current bottom");
  assert.ok(nowInvalidated());
});

test("addToToday on a missing task: not_found, cache untouched", async () => {
  assert.deepEqual(await addToToday({ id: ID }), { ok: false, error: "not_found" });
  assert.deepEqual(cacheCalls, []);
});

test("addToToday rejects a bad id", async () => {
  const r = await addToToday({ id: "nope" });
  assert.equal(r.ok, false);
  assert.deepEqual(dbLog, []);
});

test("removeFromToday sets on_today false and leaves rank alone", async () => {
  resetDb(({ sql }: Sent) => (sql.startsWith('update "tasks"') ? [taskRow] : []));
  const r = await removeFromToday({ id: ID });
  assert.equal(r.ok, true);
  const [u] = updates();
  const q = flat(u.sql);
  assert.match(q, /^update "tasks" set "on_today" = \$1 where/);
  assert.deepEqual(u.params, [false, ID]);
  assert.ok(!/"rank"/.test(q.split(" where ")[0]));
  assert.ok(nowInvalidated());
});

test("removeFromToday on a missing task: not_found", async () => {
  assert.deepEqual(await removeFromToday({ id: ID }), { ok: false, error: "not_found" });
  assert.deepEqual(cacheCalls, []);
});

test("addTask puts the new task on Today", async () => {
  resetDb(({ sql }: Sent) => (sql.startsWith('insert into "tasks"') ? [taskRow] : []));
  await addTask({ title: "Quick" });
  const ins = dbLog.find((e) => e.kind === "query" && e.sql.startsWith('insert into "tasks"'));
  assert.ok(ins && ins.kind === "query");
  assert.ok(ins.params.includes(true), "on_today true in insert params");
});
