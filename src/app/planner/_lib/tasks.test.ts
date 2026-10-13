import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../../../db/schema.ts";
import { applyTaskAction, neighboursAfterMove, onTodaysList } from "./tasks.ts";

function t(id: string, extra: Partial<Task> = {}): Task {
  return {
    id, title: id, classId: null, dueDate: null, estMinutes: null, done: false, doneAt: null,
    rank: "V", source: "manual", canvasUid: null, canvasUrl: null, handEdited: false, onToday: true,
    createdAt: new Date(0), ...extra,
  };
}
const ids = (xs: Task[]) => xs.map((x) => x.id).join("");

test("move places the task between its new neighbours", () => {
  const list = [t("a"), t("b"), t("c"), t("d")];
  assert.equal(ids(applyTaskAction(list, { type: "move", id: "d", beforeId: "a", afterId: "b" })), "adbc");
  assert.equal(ids(applyTaskAction(list, { type: "move", id: "a", beforeId: null, afterId: null })), "abcd");
  assert.equal(ids(applyTaskAction(list, { type: "move", id: "c", beforeId: null, afterId: "a" })), "cabd");
  assert.equal(ids(applyTaskAction(list, { type: "move", id: "a", beforeId: "d", afterId: null })), "bcda");
});

test("move keeps hidden tasks around (checklist neighbours only)", () => {
  // x is done on an earlier day, so not on today's list, but still in the store.
  const list = [t("a"), t("x", { done: true }), t("b")];
  assert.equal(ids(applyTaskAction(list, { type: "move", id: "b", beforeId: null, afterId: "a" })), "bax");
});

test("toggle keeps an existing doneAt and clears it on reopen", () => {
  const at = new Date("2026-10-12T20:00:00Z");
  const old = new Date("2026-10-12T18:00:00Z");
  const [done] = applyTaskAction([t("a")], { type: "toggle", id: "a", done: true, at });
  assert.equal(done.doneAt, at);
  const [kept] = applyTaskAction([t("a", { done: true, doneAt: old })], { type: "toggle", id: "a", done: true, at });
  assert.equal(kept.doneAt, old);
  const [open] = applyTaskAction([t("a", { done: true, doneAt: old })], { type: "toggle", id: "a", done: false, at });
  assert.equal(open.doneAt, null);
});

test("edit clears class, due date and estimate with nulls, in place", () => {
  const list = [t("a"), t("b", { classId: "c1", dueDate: "2026-10-15", estMinutes: 45 }), t("c")];
  const out = applyTaskAction(list, {
    type: "edit",
    id: "b",
    patch: { title: "B2", classId: null, dueDate: null, estMinutes: null },
  });
  assert.equal(ids(out), "abc");
  assert.deepEqual(
    { title: out[1].title, classId: out[1].classId, dueDate: out[1].dueDate, estMinutes: out[1].estMinutes },
    { title: "B2", classId: null, dueDate: null, estMinutes: null },
  );
  assert.equal(out[0], list[0]); // other rows untouched
  assert.equal(list[1].classId, "c1"); // no mutation: a failed save rolls back to this
});

test("edit sets fields and leaves the ones not in the patch alone", () => {
  const list = [t("a", { classId: "c1", dueDate: "2026-10-15", estMinutes: 45 })];
  const [set] = applyTaskAction(list, { type: "edit", id: "a", patch: { classId: "c2", dueDate: "2026-11-01", estMinutes: 90 } });
  assert.deepEqual([set.classId, set.dueDate, set.estMinutes, set.title], ["c2", "2026-11-01", 90, "a"]);
  const [kept] = applyTaskAction(list, { type: "edit", id: "a", patch: { title: "New" } });
  assert.deepEqual([kept.classId, kept.dueDate, kept.estMinutes, kept.title], ["c1", "2026-10-15", 45, "New"]);
});

test("today's list: open, or done today in Los Angeles", () => {
  const today = "2026-10-12";
  assert.ok(onTodaysList(t("a"), today));
  // 2026-10-13T03:00Z is still Oct 12 in Los Angeles.
  assert.ok(onTodaysList(t("a", { done: true, doneAt: new Date("2026-10-13T03:00:00Z") }), today));
  assert.ok(!onTodaysList(t("a", { done: true, doneAt: new Date("2026-10-12T05:00:00Z") }), today));
});

test("neighbours skip unsaved (temp) rows", () => {
  assert.deepEqual(neighboursAfterMove(["a", "b", "c"], 2, 0), { beforeId: null, afterId: "a" });
  assert.deepEqual(neighboursAfterMove(["a", "b", "c"], 0, 2), { beforeId: "c", afterId: null });
  assert.deepEqual(neighboursAfterMove(["a", "temp-1", "b"], 2, 1), { beforeId: "a", afterId: null });
});

test("onTodaysList requires onToday", () => {
  const today = "2026-10-13";
  assert.ok(!onTodaysList(t("a", { onToday: false }), today));
  assert.ok(!onTodaysList(t("a", { onToday: false, done: true, doneAt: new Date("2026-10-13T03:00:00Z") }), today));
});

test("today-add moves a task to the bottom of the Today tasks and sets onToday", () => {
  const list = [t("a"), t("x", { onToday: false }), t("b"), t("y", { onToday: false }), t("c", { onToday: false })];
  const out = applyTaskAction(list, { type: "today-add", id: "x" });
  assert.equal(ids(out), "abxyc");
  assert.ok(out[2].onToday);
  assert.equal(list[1].onToday, false); // no mutation
});

test("today-add on a task already on Today leaves the list alone; with none on Today goes last", () => {
  const list = [t("a"), t("b")];
  assert.equal(applyTaskAction(list, { type: "today-add", id: "a" }), list);
  const off = [t("a", { onToday: false }), t("b", { onToday: false })];
  assert.equal(ids(applyTaskAction(off, { type: "today-add", id: "a" })), "ba");
});

test("today-remove clears onToday in place", () => {
  const list = [t("a"), t("b")];
  const out = applyTaskAction(list, { type: "today-remove", id: "a" });
  assert.equal(ids(out), "ab");
  assert.equal(out[0].onToday, false);
  assert.equal(out[1], list[1]);
});
