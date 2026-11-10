import { test } from "node:test";
import assert from "node:assert/strict";
import { MANUAL_STATS } from "./manual-data.ts";
import type { InstagramStats } from "./types.ts";
import { compact } from "./format.ts";
import { reelViews } from "./view.ts";

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
