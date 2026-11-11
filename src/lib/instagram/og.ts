// Pure view for the share preview (opengraph-image). Hardcoded MANUAL_STATS numbers are
// stale by definition, so only a fully live instagram-api result may show numbers.
import { metricCompact } from "./format";
import type { InstagramStats } from "./types";

export type OgStatsView =
  | { kind: "stats"; followers: string; views: string }
  | { kind: "fallback"; text: string };

export const OG_FALLBACK_TEXT = "@masamcodes · build in public";

export function ogStatsView(stats: InstagramStats): OgStatsView {
  if (
    stats.source === "instagram-api" &&
    stats.status === "live" &&
    stats.followers.kind === "value" &&
    stats.totals.views.kind === "value"
  ) {
    return {
      kind: "stats",
      followers: metricCompact(stats.followers),
      views: metricCompact(stats.totals.views),
    };
  }
  return { kind: "fallback", text: OG_FALLBACK_TEXT };
}
