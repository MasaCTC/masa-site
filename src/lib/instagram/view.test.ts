import { test } from "node:test";
import assert from "node:assert/strict";
import { MANUAL_STATS } from "./manual-data.ts";
import type { InstagramStats } from "./types.ts";
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
