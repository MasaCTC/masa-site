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
  /** ISO date (YYYY-MM-DD) the reel was posted. */
  postedOn: string;
  /** Reel URL; omitted = the card is not a link. */
  url?: string;
  views: Metric;
  /** The dashboard only gave a rounded figure: show the compact value but no exact-count tooltip. */
  viewsRounded?: true;
  likes: Metric;
  comments: Metric;
  shares: Metric;
  saves: Metric;
  follows: Metric;
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
  /** ISO date (YYYY-MM-DD) of the first post: start of the account window and the resume entry. */
  startDate: string;
  /**
   * ACCOUNT-level numbers (one window, from account insights). Never combine with per-reel
   * numbers below: they come from different sources and windows.
   */
  totals: {
    views: Metric;
    /** Likes + comments + shares + saves; Instagram doesn't split it at account level. */
    interactions: Metric;
    likes: Metric;
    shares: Metric;
    saves: Metric;
  };
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
  /** Known without fetching, so loading fallbacks can pick the honest copy set. */
  readonly kind: SourceKind;
  getStats(): Promise<InstagramStats>;
}
