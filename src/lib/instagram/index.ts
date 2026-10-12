import { cacheLife } from "next/cache";
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

// SWAP POINT: to switch to the Graph API, change this ONE line to the new source
// (e.g. `const source: InstagramSource = graphApiSource;`). Pages only call getInstagramStats().
const source: InstagramSource = manualSource;

/** The active source's kind, for copy that renders before the stats resolve (loading fallbacks). */
export const INSTAGRAM_SOURCE_KIND = source.kind;

/**
 * Cached with Cache Components (`'use cache'` + cacheLife). Pages await this inside <Suspense>;
 * the Suspense fallback IS the "loading" state (see InstagramStatus in types.ts).
 * Static manual data makes the cache a no-op today, but the real source inherits it.
 * Conditional lifetime: a live result is cached for hours (follower numbers need not be fresher);
 * error/empty results are cached only for seconds so "Try again" can pick up a recovered source.
 */
export async function getInstagramStats(): Promise<InstagramStats> {
  "use cache";
  const stats = await source.getStats();
  if (stats.status === "live") cacheLife("hours");
  else cacheLife("seconds");
  return stats;
}
