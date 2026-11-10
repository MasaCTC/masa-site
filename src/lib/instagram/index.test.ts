import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveStats } from "./index.ts";
import { MANUAL_STATS } from "./manual-data.ts";
import { InstagramApiError } from "./graph.ts";
import type { InstagramStats } from "./types.ts";

const TOKEN = "EAAFAKE_TOKEN_123";
const cfg = { token: TOKEN, userId: "17841000000000001" };
const liveStats = { ...MANUAL_STATS, source: "instagram-api" } as unknown as InstagramStats;

async function captureErrors<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const orig = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  try {
    return { result: await fn(), logs: lines.join("\n") };
  } finally {
    console.error = orig;
  }
}

test("success returns live stats with ok=true", async () => {
  const r = await resolveStats(async () => liveStats, cfg);
  assert.equal(r.ok, true);
  assert.equal(r.stats, liveStats);
});

test("throwing fetcher returns exactly MANUAL_STATS with ok=false", async () => {
  const { result, logs } = await captureErrors(() =>
    resolveStats(async () => {
      throw new InstagramApiError("boom", 500);
    }, cfg),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.stats, MANUAL_STATS);
  assert.ok(result.stats.topReels.every((r) => !("thumbnailUrl" in r)));
  assert.ok(logs.includes("boom"));
});

test("missing config returns MANUAL_STATS without calling the fetcher or logging", async () => {
  let called = 0;
  const { result, logs } = await captureErrors(() =>
    resolveStats(async () => {
      called++;
      return liveStats;
    }, null),
  );
  assert.equal(called, 0);
  assert.equal(result.ok, false);
  assert.deepEqual(result.stats, MANUAL_STATS);
  assert.equal(logs, "");
});

test("logged message never contains the token, even when the error echoes it", async () => {
  const { logs } = await captureErrors(() =>
    resolveStats(async () => {
      throw new Error(`GET failed access_token=${TOKEN} Authorization: Bearer ${TOKEN} ${TOKEN}`);
    }, cfg),
  );
  assert.ok(logs.length > 0);
  assert.ok(!logs.includes(TOKEN));
});
