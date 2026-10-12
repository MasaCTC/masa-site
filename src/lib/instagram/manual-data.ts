// EVERY Instagram number on the site lives in this file (decision 5).
// Real values only. Anything unknown is a visible bracketed placeholder: never estimate,
// round up or derive a missing value (no "total = sum of top reels", no "share = 7.7M / x").

import type { InstagramStats, Metric, Reel, TextField } from "./types";

const known = (value: number): Metric => ({ kind: "value", value });
const unknown = (label: string): Metric => ({ kind: "placeholder", label });
const placeholderText = (label: string): TextField => ({ kind: "placeholder", label });

/** Date these numbers were entered from Instagram. */
export const PULLED_AT = "2026-10-11";

function reel(rank: number, views: number): Reel {
  return {
    rank,
    views: known(views),
    likes: unknown(`[REEL ${rank} LIKES]`),
    shares: unknown(`[REEL ${rank} SHARES]`),
    saves: unknown(`[REEL ${rank} SAVES]`),
    caption: placeholderText(`[REEL ${rank} CAPTION]`),
    thumbnail: placeholderText(`[REEL ${rank} THUMBNAIL]`),
  };
}

/** The manual snapshot. followerHistory is null: there is no real history yet. */
export const MANUAL_STATS: InstagramStats = {
  source: "manual",
  status: "live",
  pulledAt: PULLED_AT,
  followers: known(14_136),
  totals: {
    views: unknown("[TOTAL VIEWS]"),
    likes: unknown("[TOTAL LIKES]"),
    shares: unknown("[TOTAL SHARES]"),
    saves: unknown("[TOTAL SAVES]"),
  },
  topReels: [reel(1, 7_700_000), reel(2, 491_000), reel(3, 6_677)],
  othersViews: unknown("[ALL OTHERS VIEWS]"),
  engagementRate: unknown("[ENGAGEMENT RATE]"),
  topReelShare: unknown("[TOP REEL SHARE]"),
  followerGain30d: unknown("[30-DAY GAIN]"),
  followerHistory: null,
};

// ---------------------------------------------------------------------------------------
// SAMPLE DATA — not real, not rendered
// The design's mock follower series (Stats.dc.html), kept ONLY so Task 4/5 can exercise the
// Chart's hover + arrow keys during verification. It is NOT part of MANUAL_STATS and must
// never reach a page. The values are the design's invented ones (ending at 10,214).
// ---------------------------------------------------------------------------------------
const SAMPLE_Y: Record<"30D" | "90D" | "All", { days: number; ys: number[] }> = {
  "30D": { days: 30, ys: [84, 78, 73, 67, 62, 58, 54, 50, 46, 42, 38] },
  "90D": { days: 90, ys: [174, 172, 170, 168, 166, 163, 159, 118, 102, 93, 84, 73, 62, 54, 46, 38] },
  All: { days: 240, ys: [190, 189, 188, 188, 187, 185, 184, 183, 181, 180, 178, 176, 174, 172, 168, 163, 118, 93, 73, 54, 38] },
};

const END_UTC = Date.UTC(2026, 9, 11); // fixed date, no clock read

function isoDaysBack(daysBack: number): string {
  return new Date(END_UTC - daysBack * 86_400_000).toISOString().slice(0, 10);
}

/** SAMPLE DATA — not real, not rendered. */
export const SAMPLE_FOLLOWER_HISTORY: NonNullable<InstagramStats["followerHistory"]> = (
  ["30D", "90D", "All"] as const
).map((range) => {
  const { days, ys } = SAMPLE_Y[range];
  const n = ys.length;
  return {
    range,
    points: ys.map((y, i) => ({
      date: isoDaysBack(Math.round(days * (1 - i / (n - 1)))),
      value: i === n - 1 ? 10_214 : Math.max(0, Math.round((((190 - y) / 164) * 11000) / 10) * 10),
    })),
  };
});
