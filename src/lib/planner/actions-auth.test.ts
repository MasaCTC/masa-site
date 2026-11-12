// Behavioural guard (complements the source-text check in
// actions-owner.test.ts): calls every REAL exported server action with no
// session and with a non-owner session, and checks that each one returns
// "unauthorized" without touching the database or the cache. "@/db",
// "@/auth" and "next/cache" are the recording stubs from src/test/stubs
// (wired by src/test/hooks.mjs), so nothing here can reach a real database.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as actions from "./actions.ts";
import { OWNER_GITHUB_ID, setSession } from "../../test/stubs/auth.ts";
import { dbLog, dbStats, resetDb } from "../../test/stubs/db.ts";
import { cacheCalls } from "../../test/stubs/next-cache.ts";

const ID = "00000000-0000-4000-8000-000000000001";
const ID2 = "00000000-0000-4000-8000-000000000002";

// One valid call per exported action: valid input means that without the
// owner check each of these would go on to read or write the database
// (the owner control test below proves it).
const calls: Record<keyof typeof actions, () => Promise<unknown>> = {
  addTask: () => actions.addTask({ title: "Write essay" }),
  toggleDone: () => actions.toggleDone({ id: ID, done: true }),
  editTask: () => actions.editTask({ id: ID, title: "Renamed" }),
  deleteTask: () => actions.deleteTask({ id: ID }),
  addToToday: () => actions.addToToday({ id: ID }),
  removeFromToday: () => actions.removeFromToday({ id: ID }),
  reorderTask: () => actions.reorderTask({ id: ID, beforeId: ID2, afterId: null }),
  createClass: () => actions.createClass({ name: "ICS 46", kind: "class", color: "sea" }),
  renameClass: () => actions.renameClass({ id: ID, name: "ICS 51" }),
  setClassColor: () => actions.setClassColor({ id: ID, color: "moss" }),
  deleteClass: () => actions.deleteClass({ id: ID }),
  setStatus: () => actions.setStatus({ mode: "free" }),
  saveCanvasFeed: () => actions.saveCanvasFeed({ url: "https://canvas.example.edu/feeds/calendars/user_x.ics" }),
  syncCanvas: () => actions.syncCanvas({ manual: true }),
};

const extraCalls: [string, () => Promise<unknown>][] = [
  ["setStatus (show task on /now)", () => actions.setStatus({ taskId: ID })],
  ["setStatus (study)", () => actions.setStatus({ mode: "study", classId: ID })],
  ["setStatus (build)", () => actions.setStatus({ mode: "build", text: "Cofura chat" })],
  ["syncCanvas (no input)", () => actions.syncCanvas()],
];

const allCalls: [string, () => Promise<unknown>][] = [...Object.entries(calls), ...extraCalls];

const nonOwners = {
  "no session": null,
  "session without a GitHub id": { user: { name: "someone" } },
  "another GitHub account": { user: { githubId: "1" } },
  "owner id with extra characters": { user: { githubId: ` ${OWNER_GITHUB_ID}` } },
};

beforeEach(() => {
  resetDb();
  cacheCalls.length = 0;
  setSession(null);
});

test("the table covers every exported action", () => {
  assert.deepEqual(Object.keys(calls).sort(), Object.keys(actions).sort());
});

test("the auth stub's owner id matches src/auth.ts", () => {
  const src = readFileSync(new URL("../../auth.ts", import.meta.url), "utf8");
  assert.match(src, new RegExp(`export const OWNER_GITHUB_ID = "${OWNER_GITHUB_ID}";`));
});

for (const [who, session] of Object.entries(nonOwners)) {
  for (const [name, call] of allCalls) {
    test(`${name} rejects ${who} and writes nothing`, async () => {
      setSession(session);
      const result = await call();
      assert.deepEqual(result, { ok: false, error: "unauthorized" });
      assert.equal(dbStats.getDbCalls, 0, "getDb() was called");
      assert.deepEqual(dbLog, [], "statements were sent to the database");
      assert.deepEqual(cacheCalls, [], "the cache was invalidated");
    });
  }
}

// Control: with the owner signed in, the same calls do reach the (fake)
// database, so the zero counts above are not vacuous.
test("owner control: every call reaches the database", async () => {
  const prevKey = process.env.PLANNER_ENCRYPTION_KEY;
  process.env.PLANNER_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  try {
    for (const [name, call] of allCalls) {
      resetDb();
      setSession({ user: { githubId: OWNER_GITHUB_ID } });
      const result = (await call()) as { ok: boolean; error?: string };
      assert.notEqual(result.error, "unauthorized", name);
      assert.ok(dbStats.getDbCalls > 0 && dbLog.length > 0, `${name}: no statement sent`);
    }
  } finally {
    if (prevKey === undefined) delete process.env.PLANNER_ENCRYPTION_KEY;
    else process.env.PLANNER_ENCRYPTION_KEY = prevKey;
  }
});
