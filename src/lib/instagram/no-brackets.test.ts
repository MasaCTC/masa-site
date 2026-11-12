import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLiveStats } from "./live.ts";
import { MANUAL_STATS } from "./manual-data.ts";
import { metricCompact, formatMonthYear } from "./format.ts";
import type { InstagramStats } from "./types.ts";
import {
  engagementBars,
  followersTile,
  growthViews,
  followerHistoryOf,
  interactionsTile,
  percentMeter,
  reelViews,
  statusView,
  topShareText,
  totalTile,
  viewsBars,
  viewsTotalText,
} from "./view.ts";
import { STATS_COPY } from "../../content/site.ts";
import { ENTRIES } from "../../content/resume.ts";

const NOW = new Date("2026-11-11T00:30:00Z");

// A live reply with every optional field missing: no followers, no caption, no thumbnail,
// no permalink/timestamp, no per-reel insights, empty account insights.
const EMPTY_LIVE = mapLiveStats(
  {
    profile: {},
    media: { data: [1, 2, 3, 4].map((n) => ({ id: `r${n}`, media_product_type: "REELS" })) },
    reelInsights: {},
    account90d: [{ data: [] }, { data: [] }, { data: [] }],
  },
  NOW,
);

/** Every string value in a structure (JSON.stringify would add "[" for arrays). */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

/** Everything a visitor can see on Home, Stats and Resume, built from the view layer. */
function visibleText(stats: InstagramStats): string[] {
  const { reels } = reelViews(stats);
  const stack = ENTRIES.filter((e) => e.stackFromStats).map((e) =>
    e.stack.replace("{followers}", metricCompact(stats.followers)).replace("{views}", metricCompact(stats.totals.views)),
  );
  const history = followerHistoryOf(stats);
  return strings({
    status: statusView(stats),
    tiles: [
      followersTile(stats),
      totalTile(stats, STATS_COPY.tileLabels.views, stats.totals.views, "views"),
      interactionsTile(stats),
    ],
    viewsBars: viewsBars(stats),
    engagementBars: engagementBars(stats),
    engagementRate: percentMeter(stats.engagementRate),
    topShareMeter: percentMeter(stats.topReelShare, true),
    topShareText: topShareText(stats),
    viewsTotal: viewsTotalText(stats),
    reels,
    stack,
    startedOn: formatMonthYear(stats.startDate),
    growth: growthViews(history, stats.startDate) ?? null,
  });
}

const cases: [string, InstagramStats][] = [
  ["live, every optional field missing", EMPTY_LIVE],
  ["live, missing, status error (cached)", { ...EMPTY_LIVE, status: "error", lastGoodAt: "2026-11-10" }],
  ["live, missing, status empty", { ...EMPTY_LIVE, status: "empty" }],
  ["manual fallback", MANUAL_STATS],
];

for (const [name, stats] of cases) {
  test(`no bracket placeholder reaches visitors: ${name}`, () => {
    const texts = visibleText(stats);
    assert.ok(texts.length > 5, "the view layer produced text to check");
    const bad = texts.filter((t) => t.includes("["));
    assert.deepEqual(bad, []);
  });
}

test("missing values render as an em dash and missing text is hidden", () => {
  const { reels } = reelViews(EMPTY_LIVE);
  assert.equal(reels[0].viewsText, "—");
  assert.equal(reels[0].caption, undefined);
  assert.equal(reels[0].thumbError, true);
  assert.equal(topShareText(EMPTY_LIVE), "—");
  assert.equal(viewsTotalText(EMPTY_LIVE), "of — total");
  assert.equal(totalTile(EMPTY_LIVE, "Views", EMPTY_LIVE.totals.views, "views").valueText, undefined);
});
