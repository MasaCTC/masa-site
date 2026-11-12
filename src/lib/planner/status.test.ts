import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTaskChange, FREE_STATUS, statusPatchFor, statusText } from "./status.ts";

test("statusText matches the prototype wording", () => {
  assert.equal(statusText({ mode: "study", text: null, className: "ICS 46" }), "Studying for ICS 46");
  assert.equal(statusText({ mode: "build", text: "Cofura chat", className: null }), "Building Cofura chat");
  assert.equal(statusText({ mode: "free", text: null, className: null }), "Free right now");
});

test("statusText degrades when the class or text is gone", () => {
  // Deleting a class nulls status.class_id.
  assert.equal(statusText({ mode: "study", text: null, className: null }), "Studying");
  assert.equal(statusText({ mode: "build", text: null, className: null }), "Building something");
});

// ---------- status follows the task it shows

const shown = { mode: "build", text: "Essay draft", classId: null, taskId: "t1" } as const;

test("deleting the shown task frees the status", () => {
  assert.deepEqual(applyTaskChange(shown, { kind: "deleted", taskId: "t1" }), {
    mode: "free",
    text: null,
    classId: null,
    taskId: null,
  });
  assert.equal(statusText({ ...applyTaskChange(shown, { kind: "deleted", taskId: "t1" }), className: null }), "Free right now");
  assert.deepEqual(statusPatchFor({ kind: "deleted", taskId: "t1" }), { set: FREE_STATUS, resetSince: true });
});

test("renaming the shown task updates the status text, nothing else", () => {
  assert.deepEqual(applyTaskChange(shown, { kind: "renamed", taskId: "t1", title: "Final essay" }), {
    ...shown,
    text: "Final essay",
  });
  assert.deepEqual(statusPatchFor({ kind: "renamed", taskId: "t1", title: "Final essay" }), {
    set: { text: "Final essay" },
    resetSince: false,
  });
});

test("changes to other tasks leave the status untouched", () => {
  const study = { mode: "study", text: null, classId: "c1", taskId: null } as const;
  const build = { mode: "build", text: "Cofura chat", classId: null, taskId: null } as const;
  for (const s of [shown, study, build, FREE_STATUS]) {
    assert.equal(applyTaskChange(s, { kind: "deleted", taskId: "t2" }), s);
    assert.equal(applyTaskChange(s, { kind: "renamed", taskId: "t2", title: "X" }), s);
  }
});
