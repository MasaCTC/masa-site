// Display view-models for the Home and Stats pages. Pure: InstagramStats in, display-ready
// strings / ratios / chart geometry out. Pages pass these to components (and to client
// islands), never a Metric or the raw stats object, so only finished copy reaches the HTML.
import type { BarItem } from "@/components/BarList";
import {
  chartPaths,
  projectSeries,
  tickY,
  type ChartPoint,
  type ChartTick,
} from "@/components/chart-geometry";
import type { DataState } from "@/components/types";
import { INSTAGRAM_COPY, STATS_COPY } from "@/content/site";
import {
  barRatio,
  compact,
  exact,
  formatPulledDate,
  formatShortDate,
  isKnown,
  metricCompact,
  signedExact,
  textFieldText,
} from "./format";
import { SAMPLE_FOLLOWER_HISTORY } from "./manual-data";
import type { FollowerRange, FollowerSeries, InstagramStats, Metric, Reel } from "./types";

/**
 * Verification switch (Task 5): true feeds the design's SAMPLE series (not real, never shipped)
 * to every chart, to exercise hover + arrow keys. Must stay false.
 */
const USE_SAMPLE_HISTORY = false;

/** The follower series the charts draw (Home + Stats). */
export function followerHistoryOf(stats: InstagramStats): FollowerSeries[] | null {
  return USE_SAMPLE_HISTORY ? SAMPLE_FOLLOWER_HISTORY : stats.followerHistory;
}

// ---------------------------------------------------------------------------------------
// Status row (Stats hero): pill + mono date line.
// ---------------------------------------------------------------------------------------

export type StatusView = { pillLabel: string; pillVariant: "neutral" | "live"; mono: string };

/** The date shown for the current status: last good pull on error, else the pull date. */
export function statusDate(stats: InstagramStats): string {
  return formatPulledDate(stats.status === "error" ? (stats.lastGoodAt ?? stats.pulledAt) : stats.pulledAt);
}

export function statusView(stats: InstagramStats): StatusView {
  const copy = INSTAGRAM_COPY[stats.source];
  const date = statusDate(stats);
  if (stats.status === "error") {
    return { pillLabel: STATS_COPY.staleLabel, pillVariant: "neutral", mono: `${STATS_COPY.staleMeta} · ${date}` };
  }
  if (stats.status === "empty") {
    return { pillLabel: STATS_COPY.newLabel, pillVariant: "neutral", mono: `${STATS_COPY.newMeta} · ${date}` };
  }
  return { pillLabel: copy.pillLabel, pillVariant: copy.pillVariant, mono: `${copy.updatedPrefix} ${date}` };
}

// ---------------------------------------------------------------------------------------
// Stat tiles.
// ---------------------------------------------------------------------------------------

export type TileView = {
  label: string;
  valueText?: string;
  title?: string;
  meta: string;
  metaKind: "meta" | "delta";
  state: DataState;
};

/** A known metric renders as a ready tile; an unknown one as the designed empty tile ("—"). */
function metricTile(label: string, m: Metric, unit: string, meta: string): TileView {
  if (isKnown(m)) {
    return { label, valueText: compact(m.value), title: `${exact(m.value)} ${unit}`, meta, metaKind: "meta", state: "ready" };
  }
  return { label, meta: `${m.label} · ${meta}`, metaKind: "meta", state: "empty" };
}

/** Followers tile. No sparkline: there is no real history yet (item 7). */
export function followersTile(stats: InstagramStats): TileView {
  const label = STATS_COPY.tileLabels.followers;
  const f = stats.followers;
  if (stats.status === "empty") {
    return isKnown(f)
      ? { label, valueText: compact(f.value), title: `${exact(f.value)} followers`, meta: STATS_COPY.emptyFollowersMeta, metaKind: "meta", state: "empty" }
      : { label, meta: STATS_COPY.emptyFollowersMeta, metaKind: "meta", state: "empty" };
  }
  if (stats.status === "error") {
    return metricTile(label, f, "followers", `${STATS_COPY.asOf} ${statusDate(stats)}`);
  }
  const gain = stats.followerGain30d;
  const gainMeta = isKnown(gain)
    ? `${signedExact(gain.value)} · ${STATS_COPY.followersGainMeta}`
    : `${gain.label} · ${STATS_COPY.followersGainMeta}`;
  if (!isKnown(f)) return { label, meta: gainMeta, metaKind: "meta", state: "empty" };
  return {
    label,
    valueText: compact(f.value),
    title: `${exact(f.value)} followers`,
    meta: gainMeta,
    metaKind: isKnown(gain) ? "delta" : "meta",
    state: "ready",
  };
}

/** A totals tile (views / likes / shares). */
export function totalTile(stats: InstagramStats, label: string, m: Metric, unit: string): TileView {
  if (stats.status === "empty") return { label, meta: STATS_COPY.emptyTotalsMeta, metaKind: "meta", state: "empty" };
  const meta = stats.status === "error" ? `${STATS_COPY.asOf} ${statusDate(stats)}` : STATS_COPY.tileMetaAll;
  return metricTile(label, m, unit, meta);
}

/** Home "Likes · shares" tile: likes as the value, shares in the meta line. */
export function likesSharesTile(stats: InstagramStats): TileView {
  const label = STATS_COPY.likesSharesLabel;
  const { likes, shares } = stats.totals;
  if (stats.status === "empty") return { label, meta: STATS_COPY.emptyTotalsMeta, metaKind: "meta", state: "empty" };
  const sharesText = `${metricCompact(shares)} shares`;
  if (!isKnown(likes)) return { label, meta: `${likes.label} · ${sharesText}`, metaKind: "meta", state: "empty" };
  return { label, valueText: compact(likes.value), title: `${exact(likes.value)} likes`, meta: sharesText, metaKind: "meta", state: "ready" };
}

// ---------------------------------------------------------------------------------------
// Bars and meters.
// ---------------------------------------------------------------------------------------

/** Views by reel: known reels only (no "All others" row, item 9), reel 1 is the leader. */
export function viewsBars(stats: InstagramStats): BarItem[] {
  const known = stats.topReels.slice(0, 3).filter((r) => isKnown(r.views));
  const max = Math.max(0, ...known.map((r) => (isKnown(r.views) ? r.views.value : 0)));
  return known.map((r) => {
    const v = isKnown(r.views) ? r.views.value : 0;
    return {
      label: `Reel ${r.rank}`,
      valueText: compact(v),
      title: `Reel ${r.rank} · ${exact(v)} views`,
      ratio: barRatio(v, max),
      top: r.rank === 1,
    };
  });
}

/** Likes / shares / saves totals: known rows only; [] = BarList empty state. */
export function engagementBars(stats: InstagramStats): BarItem[] {
  const rows = [
    { label: "Likes", unit: "likes", m: stats.totals.likes },
    { label: "Shares", unit: "shares", m: stats.totals.shares },
    { label: "Saves", unit: "saves", m: stats.totals.saves },
  ].filter((r) => isKnown(r.m));
  const max = Math.max(0, ...rows.map((r) => (isKnown(r.m) ? r.m.value : 0)));
  return rows.map((r, i) => {
    const v = isKnown(r.m) ? r.m.value : 0;
    return { label: r.label, valueText: compact(v), title: `${exact(v)} ${r.unit}`, ratio: barRatio(v, max), top: i === 0 };
  });
}

/** Percent metric (68 = 68%) as a Meter value; unknown = the designed empty meter. */
export function percentMeter(m: Metric): { valueText: string; ratio?: number } {
  if (!isKnown(m)) return { valueText: "—" };
  return { valueText: `${m.value}%`, ratio: barRatio(m.value, 100) };
}

/** Home bars header: "top reel = 68% of all views", or the placeholder label. */
export function topShareText(stats: InstagramStats): string {
  const s = stats.topReelShare;
  return isKnown(s) ? `top reel = ${s.value}% ${STATS_COPY.homeTopShare}` : s.label;
}

/** "of [TOTAL VIEWS] total" / "of 6.0M total". */
export function viewsTotalText(stats: InstagramStats): string {
  return `of ${metricCompact(stats.totals.views)} ${STATS_COPY.viewsCard.total}`;
}

// ---------------------------------------------------------------------------------------
// Top reels.
// ---------------------------------------------------------------------------------------

export type ReelView = {
  rank: number;
  viewsText: string;
  viewsTitle?: string;
  thumbPlaceholder: string;
  caption: string;
  engagement: BarItem[];
};

/**
 * Per-reel engagement shares one scale: Reel 1's likes = full bar (design). If that is
 * unknown, the largest known per-reel number is the scale. Known rows only.
 */
export function reelViews(stats: InstagramStats): { reels: ReelView[]; anyEngagement: boolean } {
  const top = stats.topReels.slice(0, 3);
  const all = top.flatMap((r) => [r.likes, r.shares, r.saves]).filter(isKnown).map((m) => m.value);
  const first = top[0]?.likes;
  const scale = first && isKnown(first) ? first.value : Math.max(0, ...all);
  const reels = top.map((r: Reel): ReelView => {
    const engagement = (
      [
        ["Likes", "likes", r.likes],
        ["Shares", "shares", r.shares],
        ["Saves", "saves", r.saves],
      ] as const
    )
      .filter(([, , m]) => isKnown(m))
      .map(([label, unit, m]) => {
        const v = isKnown(m) ? m.value : 0;
        return { label, valueText: compact(v), title: `${exact(v)} ${unit}`, ratio: barRatio(v, scale) };
      });
    return {
      rank: r.rank,
      viewsText: metricCompact(r.views),
      viewsTitle: isKnown(r.views) ? `${exact(r.views.value)} views` : undefined,
      thumbPlaceholder: textFieldText(r.thumbnail),
      caption: textFieldText(r.caption),
      engagement,
    };
  });
  return { reels, anyEngagement: all.length > 0 };
}

// ---------------------------------------------------------------------------------------
// Follower growth chart.
// ---------------------------------------------------------------------------------------

export type ChartView = {
  points: ChartPoint[];
  linePath: string;
  areaPath: string;
  ticks: ChartTick[];
  xLabels: { start: string; mid?: string; end: string };
  ariaLabel: string;
  /** "10.2K today · +3,114 in 30 days". */
  summary: string;
  /** Change over the series ("+9,114"), Home figcaption. */
  change: string;
};

/** Axis label: 5000 -> "5K", 1500000 -> "1.5M", 750 -> "750". */
function tickLabel(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1000) return `${Number((n / 1000).toFixed(1))}K`;
  return String(n);
}

/**
 * The top gridline value (drawn at y=41, design 10K). A half-decade step at or below the max
 * while the series overshoots it by at most 10% (the design's 10,214 sits just above 10K),
 * otherwise the next step up.
 */
function topGridValue(max: number): number {
  if (max <= 0) return 10;
  const half = 10 ** Math.floor(Math.log10(max)) / 2;
  const below = Math.floor(max / half) * half;
  return below > 0 && max / below <= 1.1 ? below : Math.ceil(max / half) * half;
}

/** Midpoint between two ISO dates, formatted "Sep 26" (UTC date math, no clock read). */
function midDate(a: string, b: string): string {
  const t = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const mid = new Date((t(a) + t(b)) / 2).toISOString().slice(0, 10);
  return formatShortDate(mid);
}

function seriesView(s: FollowerSeries): ChartView | null {
  const pts = s.points;
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const top = topGridValue(Math.max(...pts.map((p) => p.value)));
  const points = projectSeries(
    pts.map((p) => ({ value: p.value, date: formatShortDate(p.date), valueText: exact(p.value) })),
    top,
  );
  const { line, area } = chartPaths(points);
  const g = STATS_COPY.growth;
  const isAll = s.range === "All";
  const start = isAll ? g.allStartLabel : formatShortDate(first.date);
  const end = formatShortDate(last.date);
  return {
    points,
    linePath: line,
    areaPath: area,
    ticks: [0, top / 2, top].map((v) => ({ y: tickY(v, top), label: tickLabel(v) })),
    xLabels: { start, mid: isAll ? undefined : midDate(first.date, last.date), end },
    ariaLabel: isAll
      ? `Followers grew from ${compact(first.value)} to ${compact(last.value)} since the account started.`
      : `Followers grew from ${compact(first.value)} on ${start} to ${compact(last.value)} on ${end}.`,
    summary:
      s.range === "All"
        ? `${compact(last.value)} ${g.today} · ${g.allSince}`
        : `${compact(last.value)} ${g.today} · ${signedExact(last.value - first.value)} ${g.window[s.range]}`,
    change: signedExact(last.value - first.value),
  };
}

/** One ChartView per range that has at least 2 points; null when there is no history. */
export function growthViews(history: FollowerSeries[] | null): Partial<Record<FollowerRange, ChartView>> | null {
  if (!history) return null;
  const out: Partial<Record<FollowerRange, ChartView>> = {};
  for (const s of history) {
    const v = seriesView(s);
    if (v) out[s.range] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Chart state for a status: error -> error, empty / no history -> empty. */
export function chartState(stats: InstagramStats, views: unknown): DataState {
  if (stats.status === "error") return "error";
  if (stats.status === "empty" || !views) return "empty";
  return "ready";
}
