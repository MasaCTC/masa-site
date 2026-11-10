import "server-only";
import { cacheLife } from "next/cache";
import { instagramConfig, scrubSecrets } from "./graph";
import { fetchLiveStats } from "./live";
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
  fetchLive: (opts: { cfg: Config }) => Promise<InstagramStats>,
  cfg: Config | null,
): Promise<{ stats: InstagramStats; ok: boolean }> {
  if (!cfg) return { stats: MANUAL_STATS, ok: false };
  try {
    return { stats: await fetchLive({ cfg }), ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`[instagram] live fetch failed, using manual data: ${scrubSecrets(msg, cfg.token)}`);
    return { stats: MANUAL_STATS, ok: false };
  }
}

/** Source kind for copy that renders before the stats resolve (loading fallbacks). */
export const INSTAGRAM_SOURCE_KIND: InstagramSource["kind"] = instagramConfig()
  ? "instagram-api"
  : manualSource.kind;

/**
 * Cached with Cache Components. Pages await this inside <Suspense>.
 * Live result: "hours" (revalidate ~1h, expire 1 day; Instagram CDN thumbnail URLs live ~5 days).
 * Fallback: short custom lifetime so a recovered API is picked up within minutes
 * (expire >= 5 min keeps it prerenderable; stale >= 30s). One cacheLife call per invocation.
 */
export async function getInstagramStats(): Promise<InstagramStats> {
  "use cache";
  const { stats, ok } = await resolveStats(fetchLiveStats, instagramConfig());
  if (ok) cacheLife("hours");
  else cacheLife({ stale: 30, revalidate: 300, expire: 3600 });
  return stats;
}
