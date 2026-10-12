import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addTaskSchema,
  canvasFeedSchema,
  createClassSchema,
  editTaskSchema,
  maskFeedUrl,
  reorderTaskSchema,
  setStatusSchema,
} from "./schemas.ts";
import { leastUsedColor } from "./colors.ts";

const ID = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const ID2 = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d";

test("addTask: title required and trimmed; optional fields may be empty", () => {
  assert.equal(addTaskSchema.safeParse({ title: "" }).success, false);
  assert.equal(addTaskSchema.safeParse({ title: "   " }).success, false);
  assert.equal(addTaskSchema.safeParse({}).success, false);
  const r = addTaskSchema.parse({ title: "  Read ch. 6 ", classId: "", dueDate: "", estMinutes: "" });
  assert.deepEqual(r, { title: "Read ch. 6", classId: null, dueDate: null, estMinutes: null });
  const full = addTaskSchema.parse({ title: "PS4", classId: ID, dueDate: "2026-10-15", estMinutes: "90" });
  assert.deepEqual(full, { title: "PS4", classId: ID, dueDate: "2026-10-15", estMinutes: 90 });
});

test("addTask: rejects bad optional fields", () => {
  assert.equal(addTaskSchema.safeParse({ title: "x", classId: "nope" }).success, false);
  assert.equal(addTaskSchema.safeParse({ title: "x", dueDate: "2026-13-40" }).success, false);
  assert.equal(addTaskSchema.safeParse({ title: "x", dueDate: "10/12/2026" }).success, false);
  assert.equal(addTaskSchema.safeParse({ title: "x", estMinutes: -5 }).success, false);
  assert.equal(addTaskSchema.safeParse({ title: "x", estMinutes: 1.5 }).success, false);
  assert.equal(addTaskSchema.safeParse({ title: "x", estMinutes: 100000 }).success, false);
  assert.equal(addTaskSchema.safeParse({ title: "x".repeat(301) }).success, false);
});

test("editTask: id required, only given fields change", () => {
  assert.equal(editTaskSchema.safeParse({ title: "x" }).success, false);
  assert.deepEqual(editTaskSchema.parse({ id: ID, title: " y " }), { id: ID, title: "y" });
  assert.deepEqual(editTaskSchema.parse({ id: ID, dueDate: "" }), { id: ID, dueDate: null });
  assert.equal(editTaskSchema.safeParse({ id: ID, title: "" }).success, false);
});

test("reorder: neighbours optional, no self-reference", () => {
  assert.ok(reorderTaskSchema.safeParse({ id: ID, beforeId: null, afterId: ID2 }).success);
  assert.ok(reorderTaskSchema.safeParse({ id: ID, beforeId: ID2, afterId: null }).success);
  assert.equal(reorderTaskSchema.safeParse({ id: ID, beforeId: null, afterId: null }).success, false);
  assert.equal(reorderTaskSchema.safeParse({ id: ID, beforeId: ID, afterId: null }).success, false);
  assert.equal(reorderTaskSchema.safeParse({ id: ID, beforeId: ID2, afterId: ID2 }).success, false);
});

test("class: color must be a class color; kind class|category", () => {
  assert.ok(createClassSchema.safeParse({ name: "Personal", kind: "category" }).success);
  assert.ok(createClassSchema.safeParse({ name: "Personal", kind: "category", color: "sea" }).success);
  assert.equal(createClassSchema.safeParse({ name: "P", kind: "category", color: "red" }).success, false);
  assert.equal(createClassSchema.safeParse({ name: "P", kind: "cat" }).success, false);
  assert.equal(createClassSchema.safeParse({ name: " ", kind: "class" }).success, false);
});

test("status: study needs a class, build needs text, free needs nothing, or a task", () => {
  assert.ok(setStatusSchema.safeParse({ mode: "study", classId: ID }).success);
  assert.equal(setStatusSchema.safeParse({ mode: "study" }).success, false);
  assert.deepEqual(setStatusSchema.parse({ mode: "build", text: " Cofura chat " }), { mode: "build", text: "Cofura chat" });
  assert.equal(setStatusSchema.safeParse({ mode: "build", text: "" }).success, false);
  assert.ok(setStatusSchema.safeParse({ mode: "free" }).success);
  assert.ok(setStatusSchema.safeParse({ taskId: ID }).success);
  assert.equal(setStatusSchema.safeParse({ mode: "sleep" }).success, false);
});

test("canvas feed: https only, empty clears", () => {
  assert.deepEqual(canvasFeedSchema.parse({ url: "" }), { url: null });
  assert.deepEqual(canvasFeedSchema.parse({ url: "  " }), { url: null });
  const u = "https://canvas.eee.uci.edu/feeds/calendars/user_abc.ics";
  assert.deepEqual(canvasFeedSchema.parse({ url: ` ${u} ` }), { url: u });
  for (const bad of ["http://canvas.x/feed.ics", "webcal://canvas.x/f.ics", "javascript:alert(1)", "not a url", "https://", "https://u:p@canvas.x/f.ics"]) {
    assert.equal(canvasFeedSchema.safeParse({ url: bad }).success, false, bad);
  }
  assert.equal(canvasFeedSchema.safeParse({ url: "https://a.b/" + "x".repeat(2100) }).success, false);
});

test("maskFeedUrl shows scheme+host and last 4 chars only", () => {
  const m = maskFeedUrl("https://canvas.eee.uci.edu/feeds/calendars/user_SECRETTOKEN123.ics");
  assert.equal(m, "https://canvas.eee.uci.edu/••••••••.ics");
  assert.ok(!m.includes("SECRET"));
  assert.ok(!maskFeedUrl("https://canvas.x/feeds/abcdefgh?token=SECRET9876").includes("SECRET"));
});

test("leastUsedColor picks the least used color, ties in palette order", () => {
  assert.equal(leastUsedColor([]), "clay");
  assert.equal(leastUsedColor(["clay"]), "moss");
  assert.equal(leastUsedColor(["clay", "moss", "sea", "plum", "ochre", "slate", "rose", "teal"]), "clay");
  assert.equal(leastUsedColor(["clay", "clay", "moss", "sea", "plum", "ochre", "slate", "rose", "teal"]), "moss");
});
