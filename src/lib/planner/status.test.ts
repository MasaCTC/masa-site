import { test } from "node:test";
import assert from "node:assert/strict";
import { statusText } from "./status.ts";

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
