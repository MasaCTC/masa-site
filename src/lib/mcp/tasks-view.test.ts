import { test } from "node:test";
import assert from "node:assert/strict";
import type { Class, Task } from "../../db/schema.ts";
import { filterTasks, resolveClass, toTaskView } from "./tasks-view.ts";

const D = new Date("2026-01-01T00:00:00Z");
const cls = (id: string, name: string, kind: "class" | "category" = "class"): Class =>
  ({ id, name, kind, color: "sea", canvasCode: null, createdAt: D }) as Class;
const task = (id: string, o: Partial<Task> = {}): Task =>
  ({
    id,
    title: `t${id}`,
    classId: null,
    dueDate: null,
    estMinutes: null,
    done: false,
    doneAt: null,
    rank: "a",
    source: "manual",
    canvasUid: null,
    canvasUrl: null,
    handEdited: false,
    onToday: false,
    createdAt: D,
    ...o,
  }) as Task;

const CS = cls("c1", "CS 101");
const CHORES = cls("c2", "Chores", "category");
const classes = [CS, CHORES];

test("day filter keeps only matching dueDate", () => {
  const ts = [task("1", { dueDate: "2026-02-01" }), task("2", { dueDate: "2026-02-02" }), task("3")];
  const r = filterTasks(ts, classes, { day: "2026-02-01" });
  assert.ok(r.ok);
  assert.deepEqual(r.tasks.map((t) => t.id), ["1"]);
});

test("status defaults to open; done and all work", () => {
  const ts = [task("1"), task("2", { done: true })];
  const open = filterTasks(ts, classes, {});
  assert.ok(open.ok);
  assert.deepEqual(open.tasks.map((t) => t.id), ["1"]);
  const done = filterTasks(ts, classes, { status: "done" });
  assert.ok(done.ok);
  assert.deepEqual(done.tasks.map((t) => t.id), ["2"]);
  const all = filterTasks(ts, classes, { status: "all" });
  assert.ok(all.ok);
  assert.equal(all.tasks.length, 2);
});

test("class filter by name (any case) and by id", () => {
  const ts = [task("1", { classId: "c1" }), task("2", { classId: "c2" }), task("3")];
  for (const ref of ["cs 101", "CS 101", "c1"]) {
    const r = filterTasks(ts, classes, { class: ref });
    assert.ok(r.ok);
    assert.deepEqual(r.tasks.map((t) => t.id), ["1"]);
  }
});

test("category filters the same way", () => {
  const ts = [task("1", { classId: "c1" }), task("2", { classId: "c2" })];
  const r = filterTasks(ts, classes, { class: "chores" });
  assert.ok(r.ok);
  assert.deepEqual(r.tasks.map((t) => t.id), ["2"]);
});

test("unknown class is an error listing available names", () => {
  const r = filterTasks([task("1")], classes, { class: "Nope" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.message, /CS 101/);
    assert.match(r.message, /Chores/);
  }
});

test("duplicate names are ambiguous, message has ids", () => {
  const dup = [cls("x1", "Math"), cls("x2", "math", "category")];
  const r = resolveClass(dup, "MATH");
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.message, /x1/);
    assert.match(r.message, /x2/);
  }
  assert.ok(resolveClass(dup, "x2").ok);
});

test("order preserved", () => {
  const ts = [task("3"), task("1"), task("2")];
  const r = filterTasks(ts, classes, {});
  assert.ok(r.ok);
  assert.deepEqual(r.tasks.map((t) => t.id), ["3", "1", "2"]);
});

test("toTaskView maps class name and omits internals", () => {
  const t = task("1", {
    classId: "c2",
    done: true,
    doneAt: D,
    dueDate: "2026-02-01",
    estMinutes: 30,
    onToday: true,
    source: "canvas",
    canvasUrl: "https://x",
    canvasUid: "u",
    handEdited: true,
  });
  const v = toTaskView(t, classes);
  assert.deepEqual(v, {
    id: "1",
    title: "t1",
    class: "Chores",
    classKind: "category",
    dueDate: "2026-02-01",
    estMinutes: 30,
    done: true,
    doneAt: D.toISOString(),
    onToday: true,
    source: "canvas",
    canvasUrl: "https://x",
  });
  const none = toTaskView(task("2"), classes);
  assert.equal(none.class, null);
  assert.equal(none.classKind, null);
  assert.equal(none.doneAt, null);
});
