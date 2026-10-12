// Instagram data model. Components never see `Metric`; Task 4 maps these through format.ts.

/** A number we actually know, or a visible bracketed placeholder ("[TOTAL VIEWS]"). Never estimated. */
export type Metric =
  | { kind: "value"; value: number }
  | { kind: "placeholder"; label: string };

/** Free text / image slot: real content, or a visible bracketed placeholder ("[REEL 1 CAPTION]"). */
export type TextField =
  | { kind: "text"; text: string }
  | { kind: "placeholder"; label: string };

export type Reel = {
  /** 1-based rank by views. */
  rank: number;
  views: Metric;
  likes: Metric;
  shares: Metric;
  saves: Metric;
  caption: TextField;
  thumbnail: TextField;
};

export type FollowerRange = "30D" | "90D" | "All";

export type FollowerSeries = {
  range: FollowerRange;
  /** ISO dates (YYYY-MM-DD), oldest first. */
  points: { date: string; value: number }[];
};

/**
 * Where the numbers come from. Drives the honest wording in src/content/site.ts:
 * 'manual' = typed in by hand, 'instagram-api' = a future Graph API source.
 */
export type SourceKind = "manual" | "instagram-api";

/**
 * Data states. `status` comes back from the source: 'live' (data loaded), 'error' (last good
 * data shown, `lastGoodAt` set), 'empty' (no data yet).
 * LOADING is not a status: it is represented by React Suspense (loading fallback) in the
 * pages while getInstagramStats() resolves.
 */
export type InstagramStatus = "live" | "error" | "empty";

export type InstagramStats = {
  source: SourceKind;
  status: InstagramStatus;
  /** ISO date (YYYY-MM-DD) the numbers were pulled / entered. */
  pulledAt: string;
  /** ISO date of the last good pull (status 'error'). */
  lastGoodAt?: string;
  followers: Metric;
  totals: { views: Metric; likes: Metric; shares: Metric; saves: Metric };
  /** Ranked by views, best first. */
  topReels: Reel[];
  othersViews: Metric;
  engagementRate: Metric;
  topReelShare: Metric;
  followerGain30d: Metric;
  /** null = no history (designed empty chart state). */
  followerHistory: FollowerSeries[] | null;
};

export interface InstagramSource {
  getStats(): Promise<InstagramStats>;
}
