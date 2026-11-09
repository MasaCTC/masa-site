// MCP planner tools against the recording fake database.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addTaskTool,
  completeTaskTool,
  getTodaysPlanTool,
  listTasksTool,
  updateTaskTool,
  type ToolOutput,
} from "./tools.ts";
import { OWNER_GITHUB_ID } from "../../test/stubs/auth.ts";
import { dbLog, resetDb, type Sent } from "../../test/stubs/db.ts";
import { cacheCalls } from "../../test/stubs/next-cache.ts";

const OWNER = { githubId: OWNER_GITHUB_ID };
const ID = "00000000-0000-4000-8000-000000000001";
const ID2 = "00000000-0000-4000-8000-000000000002";
const CS_ID = "00000000-0000-4000-8000-0000000000c1";

// Column order of the tasks table.
const row = (id: string, o: { title?: string; classId?: string | null; due?: string | null; done?: boolean; doneAt?: string | null; onToday?: boolean } = {}) => [
  id, o.title ?? "T", o.classId ?? null, o.due ?? null, null, o.done ?? false, o.doneAt ?? null,
  "a0", "manual", null, null, false, o.onToday ?? true, "2026-01-01T00:00:00Z",
];
// Column order of the classes table.
const classRows = [[CS_ID, "CS 101", "class", "sea", null, "2026-01-01T00:00:00Z"]];

type Q = Sent & { arrayMode: boolean };
const isTasksSelect = (s: string) => s.startsWith("select") && s.includes('from "tasks"');
const isClassSelect = (s: string) => s.startsWith("select") && s.includes('from "classes"');
const writes = () =>
  dbLog.flatMap((e) => (e.kind === "batch" ? e.queries : e.sql.startsWith("select") ? [] : [e]));
const data = (r: ToolOutput) => JSON.parse(r.content[0].text);

beforeEach(() => {
  resetDb();
  cacheCalls.length = 0;
});

test("listTasksTool returns open tasks in order, filters, and rejects bad input", async () => {
  resetDb(({ sql }: Q) =>
    isClassSelect(sql)
      ? classRows
      : isTasksSelect(sql)
        ? [row(ID, { title: "A", classId: CS_ID, due: "2026-02-01" }), row(ID2, { title: "B", done: true, doneAt: "2026-01-02T00:00:00Z" }), row("00000000-0000-4000-8000-000000000003", { title: "C", due: "2026-02-02" })]
        : [],
  );
  let r = await listTasksTool(OWNER, {});
  assert.equal(r.isError, undefined);
  assert.equal(data(r).count, 2);
  assert.deepEqual(data(r).tasks.map((t: { title: string }) => t.title), ["A", "C"]);
  assert.equal(data(r).tasks[0].class, "CS 101");

  r = await listTasksTool(OWNER, { day: "2026-02-02" });
  assert.deepEqual(data(r).tasks.map((t: { title: string }) => t.title), ["C"]);

  r = await listTasksTool(OWNER, { status: "all" });
  assert.equal(data(r).count, 3);

  r = await listTasksTool(OWNER, { class: "cs 101" });
  assert.deepEqual(data(r).tasks.map((t: { title: string }) => t.title), ["A"]);

  r = await listTasksTool(OWNER, { class: "nope" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /No class or category matches/);

  r = await listTasksTool(OWNER, { day: "tomorrow" });
  assert.equal(r.isError, true);
  r = await listTasksTool(OWNER, { status: "weird" as never });
  assert.equal(r.isError, true);
  assert.deepEqual(cacheCalls, []);
});

test("getTodaysPlanTool returns checklist rows with counts", async () => {
  resetDb(({ sql }: Q) =>
    isClassSelect(sql) ? classRows : isTasksSelect(sql) ? [row(ID, { classId: CS_ID }), row(ID2, { done: true, doneAt: "2026-01-02T00:00:00Z" })] : [],
  );
  const d = data(await getTodaysPlanTool(OWNER));
  assert.match(d.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(d.total, 2);
  assert.equal(d.done, 1);
  assert.equal(d.tasks.length, 2);
});

test("getTodaysPlanTool with nothing planned", async () => {
  const d = data(await getTodaysPlanTool(OWNER));
  assert.equal(d.total, 0);
  assert.equal(d.done, 0);
  assert.deepEqual(d.tasks, []);
});

test("addTaskTool inserts, resolves class by name, invalidates once", async () => {
  resetDb(({ sql }: Q) =>
    isClassSelect(sql) ? classRows : sql.startsWith('insert into "tasks"') ? [row(ID, { title: "Read", classId: CS_ID })] : [],
  );
  const r = await addTaskTool(OWNER, { title: "Read", class: "CS 101", estMinutes: 30 });
  assert.equal(r.isError, undefined);
  assert.equal(data(r).task.class, "CS 101");
  const ins = dbLog.filter((e) => e.kind === "query" && e.sql.startsWith('insert into "tasks"'));
  assert.equal(ins.length, 1);
  assert.ok(ins[0].kind === "query" && ins[0].params.includes(CS_ID));
  assert.equal(cacheCalls.filter((c) => c.fn === "revalidateTag" && c.arg === "now").length, 1);
  assert.equal(cacheCalls.filter((c) => c.fn === "revalidatePath" && c.arg === "/now").length, 1);
});

test("addTaskTool with onToday false puts it off Today", async () => {
  resetDb(({ sql }: Q) => (sql.startsWith("insert") || sql.startsWith("update") ? [row(ID, { onToday: false })] : []));
  const r = await addTaskTool(OWNER, { title: "Later", onToday: false });
  assert.equal(data(r).task.onToday, false);
  assert.ok(writes().some((w) => /^update "tasks" set "on_today"/.test(w.sql)));
});

test("addTaskTool rejects blank title, bad date, unknown class without writing", async () => {
  resetDb(({ sql }: Q) => (isClassSelect(sql) ? classRows : []));
  for (const input of [{ title: "  " }, { title: "x", dueDate: "soon" }, { title: "x", class: "nope" }]) {
    const r = await addTaskTool(OWNER, input);
    assert.equal(r.isError, true, JSON.stringify(input));
  }
  assert.deepEqual(writes(), []);
  assert.deepEqual(cacheCalls, []);
});

test("updateTaskTool edits the title (UPDATE sent) and leaves other fields alone", async () => {
  resetDb(({ sql }: Q) => (isClassSelect(sql) ? classRows : sql.startsWith('update "tasks"') ? [row(ID, { title: "New" })] : []));
  const r = await updateTaskTool(OWNER, { id: ID, title: "New" });
  assert.equal(data(r).task.title, "New");
  const u = writes().find((w) => w.sql.startsWith('update "tasks"'));
  assert.ok(u);
  assert.ok(!/"due_date"|"class_id"|"est_minutes"/.test(u.sql.split(" where ")[0]), u.sql);
  assert.equal(cacheCalls.filter((c) => c.arg === "now" && c.fn === "revalidateTag").length, 1);
});

test("updateTaskTool class null clears the class; a name sets it", async () => {
  resetDb(({ sql }: Q) => (isClassSelect(sql) ? classRows : sql.startsWith('update "tasks"') ? [row(ID)] : []));
  await updateTaskTool(OWNER, { id: ID, class: null });
  const u = writes().find((w) => w.sql.startsWith('update "tasks"'));
  assert.ok(u && /"class_id" = \$1/.test(u.sql) && u.params[0] === null, JSON.stringify(u));

  resetDb(({ sql }: Q) => (isClassSelect(sql) ? classRows : sql.startsWith('update "tasks"') ? [row(ID, { classId: CS_ID })] : []));
  const r = await updateTaskTool(OWNER, { id: ID, class: "CS 101" });
  assert.equal(data(r).task.class, "CS 101");
  assert.ok(writes().some((w) => w.params.includes(CS_ID)));
});

test("updateTaskTool missing id is not found; bad input writes nothing", async () => {
  let r = await updateTaskTool(OWNER, { id: ID, title: "x" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /not found/i);
  assert.deepEqual(cacheCalls, []);

  resetDb(({ sql }: Q) => (isClassSelect(sql) ? classRows : []));
  for (const input of [{ id: "nope", title: "x" }, { id: ID, class: "nope" }, { id: ID }, { id: ID, estMinutes: 0 }]) {
    r = await updateTaskTool(OWNER, input);
    assert.equal(r.isError, true, JSON.stringify(input));
  }
  assert.deepEqual(writes(), []);
});

test("updateTaskTool onToday false sends the on_today UPDATE; true adds to Today", async () => {
  resetDb(({ sql }: Q) => (sql.startsWith("select") ? [] : [row(ID, { onToday: false })]));
  const r = await updateTaskTool(OWNER, { id: ID, onToday: false });
  assert.equal(data(r).task.onToday, false);
  const w = writes();
  assert.equal(w.length, 1);
  assert.match(w[0].sql, /^update "tasks" set "on_today" = \$1 where/);
  assert.deepEqual(w[0].params, [false, ID]);

  resetDb(({ sql }: Q) => (sql.startsWith('select "rank"') ? [["a5"]] : sql.startsWith("update") ? [row(ID)] : []));
  await updateTaskTool(OWNER, { id: ID, onToday: true });
  assert.ok(writes().some((x) => /"on_today"/.test(x.sql)));
});

test("completeTaskTool marks done by default, reopens with done false", async () => {
  resetDb(({ sql }: Q) => (sql.startsWith('update "tasks"') ? [row(ID, { done: true, doneAt: "2026-01-02T00:00:00Z" })] : []));
  let r = await completeTaskTool(OWNER, { id: ID });
  assert.equal(data(r).task.done, true);
  let u = writes()[0];
  assert.equal(u.params[0], true);
  assert.equal(cacheCalls.filter((c) => c.arg === "now" && c.fn === "revalidateTag").length, 1);

  resetDb(({ sql }: Q) => (sql.startsWith('update "tasks"') ? [row(ID)] : []));
  r = await completeTaskTool(OWNER, { id: ID, done: false });
  assert.equal(data(r).task.done, false);
  u = writes()[0];
  assert.equal(u.params[0], false);
});

test("completeTaskTool missing or malformed id is an error", async () => {
  cacheCalls.length = 0;
  let r = await completeTaskTool(OWNER, { id: ID });
  assert.equal(r.isError, true);
  r = await completeTaskTool(OWNER, { id: "x" });
  assert.equal(r.isError, true);
  assert.deepEqual(cacheCalls, []);
});

test("every tool rejects a non-owner and touches nothing", async () => {
  for (const ctx of [{ githubId: "999" }, {}]) {
    const outs = [
      await listTasksTool(ctx, {}),
      await getTodaysPlanTool(ctx),
      await addTaskTool(ctx, { title: "x" }),
      await updateTaskTool(ctx, { id: ID, title: "x" }),
      await completeTaskTool(ctx, { id: ID }),
    ];
    for (const o of outs) {
      assert.equal(o.isError, true);
      assert.equal(o.content[0].text, "Forbidden");
    }
    assert.deepEqual(dbLog, []);
    assert.deepEqual(cacheCalls, []);
  }
});

test("every exported tool starts with the owner check", () => {
  const src = readFileSync(new URL("./tools.ts", import.meta.url), "utf8");
  const re = /^export async function (\w+Tool)\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/gm;
  const names: string[] = [];
  for (const m of src.matchAll(re)) {
    names.push(m[1]);
    const lines = m[2].split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
    assert.equal(lines[0], "const denied = guard(ctx);", `${m[1]}: first statement`);
    assert.equal(lines[1], "if (denied) return denied;", `${m[1]}: second statement`);
  }
  assert.equal(names.length, (src.match(/^export async function \w+Tool/gm) ?? []).length);
  assert.equal(names.length, 5);
});
