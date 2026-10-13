import { test } from "node:test";
import assert from "node:assert/strict";
import { needsNewLink, syncErrorCopy, syncLineText } from "./sync-copy.ts";

test("sync line copy follows the prototype", () => {
  assert.equal(syncLineText({ phase: "idle" }), "");
  assert.equal(syncLineText({ phase: "syncing" }), "Syncing Canvas…");
  assert.equal(syncLineText({ phase: "synced", count: 14 }), "Canvas synced just now · 14 upcoming");
  assert.equal(syncLineText({ phase: "synced", count: 1 }), "Canvas synced just now · 1 upcoming");
  assert.equal(syncLineText({ phase: "synced", count: 0 }), "Canvas synced just now · 0 upcoming");
  assert.equal(syncLineText({ phase: "fresh" }), "Canvas synced just now");
  assert.equal(syncLineText({ phase: "failed" }), "Canvas sync failed");
});

test("a 401 on open uses the prototype's error copy", () => {
  assert.deepEqual(syncErrorCopy({ ok: false, error: "sync", reason: "http", httpStatus: 401 }, "open"), {
    lead: "Canvas sync failed when you opened the planner.",
    detail: "The feed returned 401. Canvas may have reset the link; paste a fresh one. Your existing tasks are untouched.",
  });
});

test("a manual retry has a shorter lead", () => {
  assert.equal(syncErrorCopy({ ok: false, error: "sync", reason: "timeout" }, "manual").lead, "Canvas sync failed.");
});

test("every reason has copy that ends with the reassurance and never echoes a URL", () => {
  const reasons = ["unreadable", "blocked", "network", "timeout", "http", "redirects", "too_large", "not_ics", "save_failed"] as const;
  for (const reason of reasons) {
    const { lead, detail } = syncErrorCopy({ ok: false, error: "sync", reason, httpStatus: 503 }, "open");
    assert.ok(lead.length > 0 && detail.endsWith("Your existing tasks are untouched."), reason);
    assert.doesNotMatch(lead + detail, /https?:|\/\//, reason);
  }
  assert.match(syncErrorCopy({ ok: false, error: "sync", reason: "http", httpStatus: 503 }, "open").detail, /returned 503\. Canvas may be down/);
});

test("session and network failures", () => {
  assert.equal(syncErrorCopy({ ok: false, error: "unauthorized" }, "open").lead, "Your session ended.");
  assert.equal(syncErrorCopy({ ok: false, error: "network" }, "manual").detail, "Couldn't reach the server. Check your connection. Your existing tasks are untouched.");
});

test("which failures are fixed by pasting a new link", () => {
  const f = (reason: Parameters<typeof needsNewLink>[0]["reason"], httpStatus?: number) =>
    needsNewLink({ ok: false, error: "sync", reason, httpStatus });
  assert.equal(f("http", 401), true);
  assert.equal(f("http", 404), true);
  assert.equal(f("http", 503), false);
  assert.equal(f("unreadable"), true);
  assert.equal(f("not_ics"), true);
  assert.equal(f("blocked"), true);
  assert.equal(f("timeout"), false);
});
