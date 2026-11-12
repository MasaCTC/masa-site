import { cacheLife, cacheTag } from "next/cache";
import { getNowData } from "@/lib/planner/queries";
import { TAGS } from "@/lib/planner/tags";
import { plannerToday, PLANNER_TZ } from "@/lib/planner/time";

/** "2:10 PM" today, "Oct 11, 2:10 PM" before that (owner's timezone). */
function timeText(d: Date, today: string): string {
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: PLANNER_TZ });
  if (plannerToday(d) === today) return time;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: PLANNER_TZ }) + ", " + time;
}

export type NowView = {
  mode: "study" | "build" | "free";
  line: string;
  classColor: string | null;
  /** Display text ("2:10 PM", "Oct 11, 2:10 PM"); null until a status was ever set. */
  since: string | null;
  /** Display text for when this cache entry was filled. */
  updated: string;
  done: number;
  total: number;
};

/**
 * Public /now data, cached. Status and task actions expire TAGS.now
 * (updateTag + revalidatePath), so changes show immediately. The time lifetime
 * is only a fallback for "today" rolling over at midnight PLANNER_TZ and for
 * Canvas imports: stale 5 min (router reuse), revalidate 15 min (so the
 * count is at most ~15 min behind midnight), expire 1 day.
 */
export async function getNowView(): Promise<NowView> {
  "use cache";
  cacheTag(TAGS.now);
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  const d = await getNowData();
  const nowDate = new Date();
  const today = plannerToday(nowDate);
  return {
    mode: d.mode,
    line: d.line,
    classColor: d.classColor,
    since: d.since ? timeText(new Date(d.since), today) : null,
    updated: timeText(nowDate, today),
    done: d.done,
    total: d.total,
  };
}
