import "server-only";

import { ACCOUNT_START_DATE } from "./config";
import { graphGet, instagramConfig, InstagramApiError, type FetchLike } from "./graph";
import type { InstagramStats, Metric, Reel, TextField } from "./types";

const known = (value: number): Metric => ({ kind: "value", value });
const unknown = (label: string): Metric => ({ kind: "placeholder", label });
const placeholderText = (label: string): TextField => ({ kind: "placeholder", label });

const DAY = 86_400;
const CHUNKS = 3;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const utcDate = (d: Date) => d.toISOString().slice(0, 10);

/** Reel insights: metric values live at data[].values[0].value. */
function reelMetric(insights: unknown, name: string): number | null {
  if (!isObj(insights)) return null;
  for (const d of arr(insights.data)) {
    if (isObj(d) && d.name === name) return num(arr(d.values).map((v) => (isObj(v) ? v.value : null))[0]);
  }
  return null;
}

/** Account insights: totals live at data[].total_value.value. */
function accountMetric(chunk: unknown, name: string): number | null {
  if (!isObj(chunk)) return null;
  for (const d of arr(chunk.data)) {
    if (isObj(d) && d.name === name) return isObj(d.total_value) ? num(d.total_value.value) : null;
  }
  return null;
}

/** Sum across all chunks; any missing chunk value makes the whole total unknown. */
function total(chunks: unknown[], name: string, label: string): Metric {
  let sum = 0;
  for (const c of chunks) {
    const v = accountMetric(c, name);
    if (v === null) return unknown(label);
    sum += v;
  }
  return chunks.length > 0 ? known(sum) : unknown(label);
}

function safeThumbnailUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return undefined;
    const h = u.hostname.toLowerCase();
    return h.endsWith(".cdninstagram.com") || h.endsWith(".fbcdn.net") ? raw : undefined;
  } catch {
    return undefined;
  }
}

type MediaItem = Record<string, unknown>;

export function mapLiveStats(
  raw: {
    profile: unknown;
    media: unknown;
    reelInsights: Record<string, unknown>;
    account90d: unknown[];
  },
  now: Date,
): InstagramStats {
  const pulledAt = utcDate(now);
  const items: MediaItem[] = isObj(raw.media) ? arr(raw.media.data).filter(isObj) : [];

  const followersRaw = isObj(raw.profile) ? num(raw.profile.followers_count) : null;

  const totals = {
    views: total(raw.account90d, "views", "[TOTAL VIEWS]"),
    interactions: total(raw.account90d, "total_interactions", "[TOTAL INTERACTIONS]"),
    likes: total(raw.account90d, "likes", "[TOTAL LIKES]"),
    shares: total(raw.account90d, "shares", "[TOTAL SHARES]"),
    saves: total(raw.account90d, "saves", "[TOTAL SAVES]"),
  };

  const ranked = items
    .filter((m) => m.media_product_type === "REELS")
    .map((m) => ({
      m,
      ins: typeof m.id === "string" ? raw.reelInsights[m.id] : undefined,
    }))
    .map((x) => ({ ...x, views: reelMetric(x.ins, "views") }))
    .sort((a, b) => (b.views ?? -1) - (a.views ?? -1))
    .slice(0, 3);

  const metric = (v: number | null, label: string): Metric => (v === null ? unknown(label) : known(v));

  const topReels: Reel[] = ranked.map(({ m, ins, views }, i) => {
    const rank = i + 1;
    const ts = typeof m.timestamp === "string" ? Date.parse(m.timestamp) : NaN;
    const caption =
      typeof m.caption === "string" && m.caption.trim() !== ""
        ? ({ kind: "text", text: m.caption.trim() } as const)
        : placeholderText(`[REEL ${rank} CAPTION]`);
    const reel: Reel = {
      rank,
      postedOn: Number.isFinite(ts) ? utcDate(new Date(ts)) : pulledAt,
      views: metric(views, `[REEL ${rank} VIEWS]`),
      likes: metric(reelMetric(ins, "likes"), `[REEL ${rank} LIKES]`),
      comments: metric(reelMetric(ins, "comments"), `[REEL ${rank} COMMENTS]`),
      shares: metric(reelMetric(ins, "shares"), `[REEL ${rank} SHARES]`),
      saves: metric(reelMetric(ins, "saved"), `[REEL ${rank} SAVES]`),
      follows: unknown(`[REEL ${rank} FOLLOWS]`),
      caption,
      thumbnail: placeholderText(`[REEL ${rank} THUMBNAIL]`),
    };
    if (typeof m.permalink === "string") reel.url = m.permalink;
    const thumb = safeThumbnailUrl(m.thumbnail_url);
    if (thumb) reel.thumbnailUrl = thumb;
    return reel;
  });

  const engagementRate: Metric =
    totals.interactions.kind === "value" && totals.views.kind === "value" && totals.views.value > 0
      ? known(Math.round((totals.interactions.value / totals.views.value) * 1000) / 10)
      : unknown("[ENGAGEMENT RATE]");

  const top = ranked[0];
  const topTs = top && typeof top.m.timestamp === "string" ? Date.parse(top.m.timestamp) : NaN;
  const topReelShare: Metric =
    top &&
    top.views !== null &&
    totals.views.kind === "value" &&
    totals.views.value > 0 &&
    Number.isFinite(topTs) &&
    topTs >= now.getTime() - 90 * DAY * 1000
      ? known(Math.round((top.views / totals.views.value) * 100))
      : unknown("[TOP REEL SHARE]");

  return {
    source: "instagram-api",
    status: "live",
    pulledAt,
    followers: metric(followersRaw, "[FOLLOWERS]"),
    startDate: ACCOUNT_START_DATE,
    totals,
    topReels,
    othersViews: unknown("[ALL OTHERS VIEWS]"),
    engagementRate,
    topReelShare,
    followerGain30d: unknown("[30-DAY GAIN]"),
    followerHistory: null,
  };
}

/** Live stats plus how many reels' insights calls failed (their metrics are placeholders). */
export type LiveResult = { stats: InstagramStats; failedReels: number };

export async function fetchLiveResult(
  opts: {
    fetchImpl?: FetchLike;
    now?: Date;
    cfg?: { token: string; userId: string };
  } = {},
): Promise<LiveResult> {
  const cfg = opts.cfg ?? instagramConfig();
  if (!cfg) throw new InstagramApiError("Instagram is not configured", 0);
  const now = opts.now ?? new Date();
  const f = opts.fetchImpl;
  const nowSec = Math.floor(now.getTime() / 1000);
  const { userId } = cfg;

  const chunk = (i: number) => {
    const until = nowSec - i * 30 * DAY;
    return graphGet(
      `${userId}/insights`,
      {
        metric: "views,total_interactions,likes,shares,saves",
        period: "day",
        metric_type: "total_value",
        since: String(until - 30 * DAY + 60),
        until: String(until),
      },
      cfg,
      f,
    );
  };

  const [profile, media, ...account90d] = await Promise.all([
    graphGet(`${userId}`, { fields: "id,username,followers_count,media_count" }, cfg, f),
    graphGet(
      `${userId}/media`,
      {
        fields:
          "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count",
        limit: "50",
      },
      cfg,
      f,
    ),
    ...Array.from({ length: CHUNKS }, (_, i) => chunk(i)),
  ]);

  const reels = (isObj(media) ? arr(media.data) : []).filter(
    (m): m is MediaItem & { id: string } =>
      isObj(m) && m.media_product_type === "REELS" && typeof m.id === "string",
  );
  // Per-reel insights are best-effort: a failed call leaves that reel's metrics as
  // placeholders (existing designed empty state); account-level calls above still throw.
  const results = await Promise.allSettled(
    reels.map((m) =>
      graphGet(`${m.id}/insights`, { metric: "views,likes,comments,shares,saved" }, cfg, f),
    ),
  );
  const reelInsights: Record<string, unknown> = {};
  let failedReels = 0;
  reels.forEach((m, i) => {
    const r = results[i];
    if (r.status === "fulfilled") reelInsights[m.id] = r.value;
    else failedReels++;
  });
  // One count-only line: no reel ids, no error text, never the token.
  if (failedReels > 0) {
    console.error(`[instagram] reel insights unavailable for ${failedReels} of ${reels.length} reels`);
  }

  return { stats: mapLiveStats({ profile, media, reelInsights, account90d }, now), failedReels };
}

export async function fetchLiveStats(
  opts: Parameters<typeof fetchLiveResult>[0] = {},
): Promise<InstagramStats> {
  return (await fetchLiveResult(opts)).stats;
}
