// Client-side task store logic for the planner. Pure (relative imports only)
// so node:test can load it. The server list (listTasks) is already in rank
// order; optimistic actions keep that order by moving array items instead of
// computing ranks, and React's useOptimistic replays them on the fresh
// server list until each action settles (so a failure rolls back by itself).
import type { Class, Task } from "../../../db/schema.ts";
import { plannerToday } from "../../../lib/planner/time.ts";

export type TaskPatch = Partial<Pick<Task, "title" | "classId" | "dueDate" | "estMinutes">>;

export type TaskAction =
  | { type: "add"; task: Task }
  | { type: "toggle"; id: string; done: boolean; at: Date }
  | { type: "move"; id: string; beforeId: string | null; afterId: string | null }
  | { type: "edit"; id: string; patch: TaskPatch }
  | { type: "delete"; id: string };

export const TEMP_PREFIX = "temp-";
export const isTemp = (id: string) => id.startsWith(TEMP_PREFIX);

export function applyTaskAction(tasks: Task[], a: TaskAction): Task[] {
  switch (a.type) {
    case "add":
      return [...tasks, a.task];
    case "toggle":
      return tasks.map((t) =>
        t.id === a.id ? { ...t, done: a.done, doneAt: a.done ? (t.doneAt ?? a.at) : null } : t,
      );
    case "edit":
      return tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t));
    case "delete":
      return tasks.filter((t) => t.id !== a.id);
    case "move": {
      const moved = tasks.find((t) => t.id === a.id);
      if (!moved) return tasks;
      const rest = tasks.filter((t) => t.id !== a.id);
      let at = -1;
      if (a.beforeId !== null) {
        const i = rest.findIndex((t) => t.id === a.beforeId);
        if (i !== -1) at = i + 1;
      }
      if (at === -1 && a.afterId !== null) at = rest.findIndex((t) => t.id === a.afterId);
      if (at === -1) return tasks; // neighbours gone: leave the list alone
      return [...rest.slice(0, at), moved, ...rest.slice(at)];
    }
  }
}

/** Same rule as the server's onTodaysList: open, or done today (PLANNER_TZ). */
export function onTodaysList(t: Task, today: string): boolean {
  if (!t.done) return true;
  return t.doneAt !== null && plannerToday(new Date(t.doneAt)) === today;
}

/**
 * Neighbours for reorderTask after moving `ids[from]` to index `to`: the
 * nearest saved (non-temp) task above and below. null when there is none.
 */
export function neighboursAfterMove(
  ids: readonly string[],
  from: number,
  to: number,
): { beforeId: string | null; afterId: string | null } {
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  let beforeId: string | null = null;
  for (let i = to - 1; i >= 0; i--) if (!isTemp(next[i])) { beforeId = next[i]; break; }
  let afterId: string | null = null;
  for (let i = to + 1; i < next.length; i++) if (!isTemp(next[i])) { afterId = next[i]; break; }
  return { beforeId, afterId };
}

export type ClassAction =
  | { type: "add"; cls: Class }
  | { type: "color"; id: string; color: Class["color"] }
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string };

export function applyClassAction(classes: Class[], a: ClassAction): Class[] {
  switch (a.type) {
    case "add":
      return [...classes, a.cls];
    case "color":
      return classes.map((c) => (c.id === a.id ? { ...c, color: a.color } : c));
    case "rename":
      return classes.map((c) => (c.id === a.id ? { ...c, name: a.name } : c));
    case "delete":
      return classes.filter((c) => c.id !== a.id);
  }
}
