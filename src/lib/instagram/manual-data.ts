// EVERY Instagram number on the site lives in this file (decision 5).
// Real values only. Anything unknown is a visible bracketed placeholder: never estimate,
// round up or derive a missing value (no "total = sum of top reels"). The only derived
// figures are the two ratios at the bottom of MANUAL_STATS, each with its reasoning.

import type { InstagramStats, Metric, Reel, TextField } from "./types";

const known = (value: number): Metric => ({ kind: "value", value });
const unknown = (label: string): Metric => ({ kind: "placeholder", label });
const placeholderText = (label: string): TextField => ({ kind: "placeholder", label });

/** Date these numbers were entered from Instagram. */
export const PULLED_AT = "2026-10-11";

/** First post. The account window ("last 90 days") covers everything since this day. */
export const START_DATE = "2026-09-07";

// ACCOUNT numbers: Professional dashboard, account insights, last 90 days (covers everything
// since the first post).
const ACCOUNT_VIEWS = 8_237_591;
const ACCOUNT_INTERACTIONS = 1_507_256;

// PER-REEL numbers: each reel's own insights, lifetime. A different source and window from
// the account numbers above, so the two sets are never added, subtracted or merged.
// The one deliberate cross-read is the ratios below, each a quotient of two real numbers.
const REEL_1_VIEWS = 7_782_900;

function reel(rank: number, r: Partial<Reel> & Pick<Reel, "postedOn" | "views">): Reel {
  return {
    rank,
    likes: unknown(`[REEL ${rank} LIKES]`),
    comments: unknown(`[REEL ${rank} COMMENTS]`),
    shares: unknown(`[REEL ${rank} SHARES]`),
    saves: unknown(`[REEL ${rank} SAVES]`),
    follows: unknown(`[REEL ${rank} FOLLOWS]`),
    caption: placeholderText(`[REEL ${rank} CAPTION]`),
    thumbnail: placeholderText(`[REEL ${rank} THUMBNAIL]`),
    ...r,
  };
}

/** The manual snapshot. followerHistory is null: there is no real history yet. */
export const MANUAL_STATS: InstagramStats = {
  source: "manual",
  status: "live",
  pulledAt: PULLED_AT,
  startDate: START_DATE,
  followers: known(14_152),
  totals: {
    views: known(ACCOUNT_VIEWS),
    interactions: known(ACCOUNT_INTERACTIONS),
    // Unknown at account level: kept as placeholders, never shown as numbers.
    likes: unknown("[TOTAL LIKES]"),
    shares: unknown("[TOTAL SHARES]"),
    saves: unknown("[TOTAL SAVES]"),
  },
  topReels: [
    reel(1, {
      postedOn: "2026-09-07",
      url: "https://www.instagram.com/reel/DdAw0iqhWm-/",
      views: known(REEL_1_VIEWS),
      likes: known(629_719),
      comments: known(6_437),
      shares: known(289_233),
      saves: known(134_561),
      follows: known(12_351),
    }),
    reel(2, {
      postedOn: "2026-09-11",
      url: "https://www.instagram.com/reel/DdKwFBVJUxM/",
      views: known(493_232),
      likes: known(26_165),
      comments: known(322),
      shares: known(16_702),
      saves: known(7_408),
      follows: known(2_080),
    }),
    // No link, caption or engagement yet; the dashboard rounds views to 7,800.
    reel(3, { postedOn: "2026-10-10", views: known(7_800), viewsRounded: true }),
  ],
  othersViews: unknown("[ALL OTHERS VIEWS]"),
  // interactions / views, rounded to one decimal: 18.3
  engagementRate: known(Math.round((ACCOUNT_INTERACTIONS / ACCOUNT_VIEWS) * 1000) / 10),
  // Mixed sources: reel 1's LIFETIME views over the account's 90-day views. Valid as an
  // approximation only because reel 1 was posted on the first day, inside the account
  // window, so both count the same plays. Shown as "≈94%", never as an exact share.
  topReelShare: known(Math.round((REEL_1_VIEWS / ACCOUNT_VIEWS) * 100)),
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
