// Planner views, deep-linked as /planner?view=calendar. Pure.
export const PLANNER_VIEWS = ["today", "calendar", "classes", "settings"] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

export function parseView(v: unknown): PlannerView {
  return typeof v === "string" && (PLANNER_VIEWS as readonly string[]).includes(v)
    ? (v as PlannerView)
    : "today";
}
