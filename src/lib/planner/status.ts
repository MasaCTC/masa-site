// Public status wording (planner preview and /now). Pure module.
export type StatusMode = "study" | "build" | "free";

/** "Studying for ICS 46" · "Building Cofura chat" · "Free right now". */
export function statusText(s: {
  mode: StatusMode;
  text: string | null;
  className: string | null;
}): string {
  if (s.mode === "free") return "Free right now";
  if (s.mode === "build") return "Building " + (s.text || "something");
  return s.className ? "Studying for " + s.className : "Studying";
}

/** The stored status fields a task change can affect (status.task_id is set by "Show on /now"). */
export type StatusFields = {
  mode: StatusMode;
  text: string | null;
  classId: string | null;
  taskId: string | null;
};

/**
 * Something that happened to a task. Only deletes and renames reach the
 * status; marking the shown task done leaves the status as it is.
 */
export type TaskChange =
  | { kind: "deleted"; taskId: string }
  | { kind: "renamed"; taskId: string; title: string };

export const FREE_STATUS = { mode: "free", text: null, classId: null, taskId: null } as const satisfies StatusFields;

/**
 * What to write to a status row that shows the changed task (the caller
 * applies it only WHERE status.task_id = change.taskId):
 *   deleted → "Free right now" (all links cleared, `since` restarts);
 *   renamed → the status text follows the new title (`since` unchanged).
 */
export function statusPatchFor(change: TaskChange): { set: Partial<StatusFields>; resetSince: boolean } {
  if (change.kind === "deleted") return { set: { ...FREE_STATUS }, resetSince: true };
  return { set: { text: change.title }, resetSince: false };
}

/** The status after a task change: unchanged unless it shows that task. */
export function applyTaskChange<S extends StatusFields>(current: S, change: TaskChange): S {
  if (current.taskId === null || current.taskId !== change.taskId) return current;
  return { ...current, ...statusPatchFor(change).set };
}
