import { MANUAL_STATS } from "./manual-data";
import type { InstagramSource, InstagramStats } from "./types";

/** Hand-entered numbers (manual-data.ts). No network, no tokens, no env vars. */
export const manualSource: InstagramSource = {
  kind: "manual",
  async getStats(): Promise<InstagramStats> {
    return MANUAL_STATS;
  },
};
