// Cache tags and paths for planner data. Pure constants.
export const TAGS = {
  /** Anything shown on /planner (tasks, classes, status, settings). */
  planner: "planner",
  /** Public /now data: status + today's counts (Task 6 caches with this). */
  now: "now",
} as const;

// The planner's route lives at /owner-planner; the proxy rewrites the owner's
// /planner requests there (see src/proxy.ts). revalidatePath takes the route
// path, so this is the internal one, not the public /planner URL.
export const PATHS = { planner: "/owner-planner", now: "/now" } as const;
