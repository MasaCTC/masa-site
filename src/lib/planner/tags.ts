// Cache tags and paths for planner data. Pure constants.
export const TAGS = {
  /** Anything shown on /planner (tasks, classes, status, settings). */
  planner: "planner",
  /** Public /now data: status + today's counts (Task 6 caches with this). */
  now: "now",
} as const;

export const PATHS = { planner: "/planner", now: "/now" } as const;
