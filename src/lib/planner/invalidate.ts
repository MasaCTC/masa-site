import "server-only";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { PATHS, TAGS } from "./tags";

/**
 * For Server Actions only (updateTag throws elsewhere): expire planner data
 * now (read-your-own-writes) and, when `now` is set, the public /now data.
 */
export function invalidateFromAction({ now }: { now: boolean }) {
  updateTag(TAGS.planner);
  revalidatePath(PATHS.planner);
  if (now) {
    updateTag(TAGS.now);
    revalidatePath(PATHS.now);
  }
}

/**
 * For Route Handlers / non-action server code (e.g. Canvas sync). Not during
 * render: Next forbids revalidation while rendering.
 */
export function invalidateFromHandler({ now }: { now: boolean }) {
  revalidateTag(TAGS.planner, { expire: 0 });
  revalidatePath(PATHS.planner);
  if (now) {
    revalidateTag(TAGS.now, { expire: 0 });
    revalidatePath(PATHS.now);
  }
}
