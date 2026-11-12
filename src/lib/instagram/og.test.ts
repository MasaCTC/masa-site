import { test } from "node:test";
import assert from "node:assert/strict";
import { MANUAL_STATS } from "./manual-data.ts";
import type { InstagramStats } from "./types.ts";
import { ogStatsView } from "./og.ts";

const live: InstagramStats = {
  ...MANUAL_STATS,
  source: "instagram-api",
  status: "live",
  followers: { kind: "value", value: 16_600 },
  totals: { ...MANUAL_STATS.totals, views: { kind: "value", value: 9_500_000 } },
};
const FALLBACK = { kind: "fallback", text: "@masamcodes · build in public" };
const noBracket = (o: object) => assert.ok(!JSON.stringify(o).includes("["));

test("live stats give compact followers and views", () => {
  const v = ogStatsView(live);
  assert.deepEqual(v, { kind: "stats", followers: "16.6K", views: "9.5M" });
  noBracket(v);
});

test("partial: placeholder views falls back", () => {
  const v = ogStatsView({ ...live, totals: { ...live.totals, views: { kind: "placeholder", label: "[TOTAL VIEWS]" } } });
  assert.deepEqual(v, FALLBACK);
  noBracket(v);
});

test("partial: placeholder followers falls back", () => {
  const v = ogStatsView({ ...live, followers: { kind: "placeholder", label: "[FOLLOWERS]" } });
  assert.deepEqual(v, FALLBACK);
  noBracket(v);
});

test("manual source never shows hardcoded numbers", () => {
  const v = ogStatsView({ ...live, source: "manual" });
  assert.deepEqual(v, FALLBACK);
  noBracket(v);
  noBracket(ogStatsView(MANUAL_STATS));
  assert.equal(ogStatsView(MANUAL_STATS).kind, "fallback");
});

test("error and empty status fall back (no stale numbers)", () => {
  for (const status of ["error", "empty"] as const) {
    const v = ogStatsView({ ...live, status });
    assert.deepEqual(v, FALLBACK);
    noBracket(v);
  }
});
