import "server-only";
import { cacheLife } from "next/cache";
import { instagramConfig, scrubSecrets } from "./graph";
import { fetchLiveResult, type LiveResult } from "./live";
import { MANUAL_STATS } from "./manual-data";
import { manualSource } from "./manual-source";
import type { InstagramSource, InstagramStats } from "./types";

export type {
  FollowerRange,
  FollowerSeries,
  InstagramSource,
  InstagramStats,
  InstagramStatus,
  Metric,
  Reel,
  SourceKind,
  TextField,
} from "./types";

type Config = { token: string; userId: string };

/**
 * Live stats when configured and the API answers; otherwise exactly MANUAL_STATS.
 * Not cached (testable under node:test); getInstagramStats() wraps it with "use cache".
 * Missing config skips the network silently. A failure logs ONE scrubbed line (never the token).
 */
export async function resolveStats(
  fetchLive: (opts: { cfg: Config }) => Promise<LiveResult>,
  cfg: Config | null,
): Promise<{ stats: InstagramStats; ok: boolean; degraded: boolean }> {
  if (!cfg) return { stats: MANUAL_STATS, ok: false, degraded: false };
  try {
    const { stats, failedReels } = await fetchLive({ cfg });
    return { stats, ok: true, degraded: failedReels > 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`[instagram] live fetch failed, using manual data: ${scrubSecrets(msg, cfg.token)}`);
    return { stats: MANUAL_STATS, ok: false, degraded: false };
  }
}

/** 30-minute lifetime for fallback / partial results (stale >= 30s, expire >= 5 min: prerenderable). */
export const RETRY_LIFE = { stale: 60, revalidate: 1800, expire: 3600 } as const;

/** Full live success caches for hours; fallback or any reel-level failure retries within 30 minutes. */
export function lifetimeFor(r: { ok: boolean; degraded: boolean }): "hours" | typeof RETRY_LIFE {
  return r.ok && !r.degraded ? "hours" : RETRY_LIFE;
}

/** Source kind for copy that renders before the stats resolve (loading fallbacks). */
export const INSTAGRAM_SOURCE_KIND: InstagramSource["kind"] = instagramConfig()
  ? "instagram-api"
  : manualSource.kind;

/**
 * Cached with Cache Components. Pages await this inside <Suspense>.
 * Complete live result: "hours" (revalidate ~1h, expire 1 day; Instagram CDN thumbnail URLs live ~5 days).
 * Fallback or partial (some reel insights failed): 30-minute lifetime so recovery is picked up
 * quickly. One cacheLife call per invocation.
 */
export async function getInstagramStats(): Promise<InstagramStats> {
  "use cache";
  const r = await resolveStats(fetchLiveResult, instagramConfig());
  const life = lifetimeFor(r);
  if (life === "hours") cacheLife("hours");
  else cacheLife(life);
  return r.stats;
}
