import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../../../db/schema.ts";
import { applyTaskAction, neighboursAfterMove, onTodaysList } from "./tasks.ts";

function t(id: string, extra: Partial<Task> = {}): Task {
  return {
    id, title: id, classId: null, dueDate: null, estMinutes: null, done: false, doneAt: null,
    rank: "V", source: "manual", canvasUid: null, canvasUrl: null, handEdited: false,
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
