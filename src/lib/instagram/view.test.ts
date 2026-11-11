import { test } from "node:test";
import assert from "node:assert/strict";
import { MANUAL_STATS } from "./manual-data.ts";
import type { InstagramStats } from "./types.ts";
import { compact } from "./format.ts";
import { followersTile, reelViews } from "./view.ts";

test("reelViews carries thumbnailUrl through as thumbUrl", () => {
  const url = "https://scontent.cdninstagram.com/v/t51/thumb.jpg";
  const stats: InstagramStats = {
    ...MANUAL_STATS,
    topReels: MANUAL_STATS.topReels.map((r, i) => (i === 0 ? { ...r, thumbnailUrl: url } : r)),
  };
  const { reels } = reelViews(stats);
  assert.equal(reels[0].thumbUrl, url);
  assert.equal(reels[1].thumbUrl, undefined);
});

test("reelViews: manual data never has a thumbUrl", () => {
  const { reels } = reelViews(MANUAL_STATS);
  assert.ok(reels.length > 0);
  for (const r of reels) assert.equal(r.thumbUrl, undefined);
});

test("reelViews: a reel with all-placeholder metrics shows an em dash, empty engagement, keeps link/caption", () => {
  const ph = (label: string) => ({ kind: "placeholder", label }) as const;
  const stats: InstagramStats = {
    ...MANUAL_STATS,
    topReels: [
      {
        ...MANUAL_STATS.topReels[0],
        views: ph("[REEL 1 VIEWS]"),
        likes: ph("[REEL 1 LIKES]"),
        comments: ph("[REEL 1 COMMENTS]"),
        shares: ph("[REEL 1 SHARES]"),
        saves: ph("[REEL 1 SAVES]"),
        url: "https://www.instagram.com/reel/XYZ/",
        caption: { kind: "text", text: "Kept caption" },
      },
    ],
  };
  const { reels, anyEngagement } = reelViews(stats);
  assert.equal(reels[0].viewsText, "—");
  assert.equal(reels[0].viewsTitle, undefined);
  assert.deepEqual(reels[0].engagement, []);
  assert.equal(reels[0].href, "https://www.instagram.com/reel/XYZ/");
  assert.equal(reels[0].caption, "Kept caption");
  assert.equal(anyEngagement, false);
});

test("reelViews: manual data views text is unchanged (known values only)", () => {
  const { reels } = reelViews(MANUAL_STATS);
  assert.deepEqual(
    reels.map((r) => r.viewsText),
    MANUAL_STATS.topReels.slice(0, 3).map((r) => (r.views.kind === "value" ? compact(r.views.value) : "?")),
  );
  assert.ok(reels.every((r) => r.viewsText !== "—"));
});

const noBracket = (o: object) => {
  for (const v of Object.values(o)) if (typeof v === "string") assert.ok(!v.includes("["), v);
};

test("followersTile: live stats with unknown gain -> ready tile, all-time meta, no bracket anywhere", () => {
  const stats: InstagramStats = {
    ...MANUAL_STATS,
    source: "instagram-api",
    status: "live",
    followers: { kind: "value", value: 14200 },
    followerGain30d: { kind: "placeholder", label: "[30-DAY GAIN]" },
  };
  const t = followersTile(stats);
  assert.equal(t.state, "ready");
  assert.equal(t.valueText, compact(14200));
  assert.equal(t.meta, "all time");
  assert.ok(!t.meta?.includes("30"));
  assert.equal(t.metaKind, "meta");
  noBracket(t);
});

test("followersTile: manual stats with unknown gain -> ready tile, all-time meta, no bracket", () => {
  const stats: InstagramStats = {
    ...MANUAL_STATS,
    status: "live",
    followers: { kind: "value", value: 10214 },
    followerGain30d: { kind: "placeholder", label: "[30-DAY GAIN]" },
  };
  const t = followersTile(stats);
  assert.equal(t.state, "ready");
  assert.ok(t.valueText);
  assert.equal(t.meta, "all time");
  noBracket(t);
});

test("followersTile: unknown followers and gain -> empty value-less tile, no meta, no bracket", () => {
  const stats: InstagramStats = {
    ...MANUAL_STATS,
    status: "live",
    followers: { kind: "placeholder", label: "[FOLLOWERS]" },
    followerGain30d: { kind: "placeholder", label: "[30-DAY GAIN]" },
  };
  const t = followersTile(stats);
  assert.equal(t.state, "empty");
  assert.equal(t.valueText, undefined);
  assert.equal(t.meta, undefined);
  noBracket(t);
});

test("followersTile: known gain -> delta meta", () => {
  const stats: InstagramStats = {
    ...MANUAL_STATS,
    status: "live",
    followers: { kind: "value", value: 10214 },
    followerGain30d: { kind: "value", value: 1234 },
  };
  const t = followersTile(stats);
  assert.equal(t.state, "ready");
  assert.equal(t.metaKind, "delta");
  assert.equal(t.meta, "+1,234 · last 30 days");
});
