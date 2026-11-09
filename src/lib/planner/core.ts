import "server-only";
// Planner task logic shared by the server actions (cookie-session owner check)
// and other callers with their own auth. Nothing here checks the owner or
// invalidates caches: callers do both. Plain module, not "use server".
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { classes, getDb, status, tasks } from "@/db";
import { bottomRank } from "./ranks-db";
import { statusPatchFor, type TaskChange } from "./status";
import {
  addTaskSchema,
  editTaskSchema,
  idSchema,
  toggleDoneSchema,
  type AddTaskInput,
  type EditTaskInput,
  type IdInput,
  type ToggleDoneInput,
} from "./schemas";
import type { Invalid, TaskResult } from "./types";

// ---------- helpers

export function invalid(error: z.ZodError | string, field?: string): Invalid {
  if (typeof error === "string") {
    return field
      ? { ok: false, error: "invalid", fieldErrors: { [field]: [error] }, formErrors: [] }
      : { ok: false, error: "invalid", fieldErrors: {}, formErrors: [error] };
  }
  const fieldErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === undefined) formErrors.push(issue.message);
    else (fieldErrors[String(key)] ??= []).push(issue.message);
  }
  return { ok: false, error: "invalid", fieldErrors, formErrors };
}

// Canvas tasks touched by hand stop being overwritten by sync.
export const markHandEdited = sql`${tasks.handEdited} OR ${tasks.source} = 'canvas'`;

/**
 * The status UPDATE for a task change, applied only if the status shows that
 * task (deleted → free, renamed → text follows; see status.ts). Callers put
 * it in the same db.batch (one transaction) as the task write.
 */
export function updateStatusFor(db: ReturnType<typeof getDb>, change: TaskChange) {
  const { set, resetSince } = statusPatchFor(change);
  return db
    .update(status)
    .set({ ...set, ...(resetSince ? { since: sql`now()` } : {}) })
    .where(eq(status.taskId, change.taskId));
}

export async function classExists(id: string) {
  const [row] = await getDb().select({ id: classes.id }).from(classes).where(eq(classes.id, id));
  return !!row;
}

// ---------- tasks

/** Adds a manual task at the BOTTOM of the checklist (as the prototype does). */
export async function addTaskCore(input: AddTaskInput): Promise<TaskResult> {
  const parsed = addTaskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { title, classId, dueDate, estMinutes } = parsed.data;
  if (classId && !(await classExists(classId))) return invalid("That class no longer exists", "classId");

  const db = getDb();
  const rank = await bottomRank(db);
  const [task] = await db
    .insert(tasks)
    .values({ title, classId, dueDate, estMinutes, rank, source: "manual", onToday: true })
    .returning();
  return { ok: true, task };
}

/**
 * Puts a task on Today, at the bottom of Today's order (ranks are global, so
 * bottom-of-all is below every Today task). Already on Today: returned
 * unchanged, not moved. One UPDATE; does not set hand_edited.
 */
export async function addToTodayCore(input: IdInput): Promise<TaskResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const db = getDb();
  const rank = await bottomRank(db);
  const [task] = await db
    .update(tasks)
    .set({
      onToday: true,
      rank: sql`case when ${tasks.onToday} then ${tasks.rank} else ${rank} end`,
    })
    .where(eq(tasks.id, parsed.data.id))
    .returning();
  if (!task) return { ok: false, error: "not_found" };
  return { ok: true, task };
}

/** Takes a task off Today; its rank is untouched. */
export async function removeFromTodayCore(input: IdInput): Promise<TaskResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [task] = await getDb()
    .update(tasks)
    .set({ onToday: false })
    .where(eq(tasks.id, parsed.data.id))
    .returning();
  if (!task) return { ok: false, error: "not_found" };
  return { ok: true, task };
}

/** Sets done/open. done_at is kept if already done, cleared when reopened. */
export async function toggleDoneCore(input: ToggleDoneInput): Promise<TaskResult> {
  const parsed = toggleDoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, done } = parsed.data;

  const [task] = await getDb()
    .update(tasks)
    .set({
      done,
      doneAt: done ? sql`coalesce(${tasks.doneAt}, now())` : null,
      handEdited: markHandEdited,
    })
    .where(eq(tasks.id, id))
    .returning();
  if (!task) return { ok: false, error: "not_found" };
  return { ok: true, task };
}

/** Edits title / class / due date / estimate; omitted fields are unchanged. */
export async function editTaskCore(input: EditTaskInput): Promise<TaskResult> {
  const parsed = editTaskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...fields } = parsed.data;
  if (fields.classId && !(await classExists(fields.classId))) {
    return invalid("That class no longer exists", "classId");
  }

  // Hand-edited means title/rank/done changed: only a title that differs from
  // the stored one counts. Class/due/estimate edits leave the flag alone.
  const handEdited =
    fields.title !== undefined
      ? sql<boolean>`${tasks.handEdited} OR (${tasks.source} = 'canvas' AND ${tasks.title} IS DISTINCT FROM ${fields.title})`
      : undefined;

  const db = getDb();
  const update = db
    .update(tasks)
    .set({ ...fields, ...(handEdited ? { handEdited } : {}) })
    .where(eq(tasks.id, id))
    .returning();
  // A new title also renames the /now status if it shows this task.
  const [task] =
    fields.title !== undefined
      ? (await db.batch([update, updateStatusFor(db, { kind: "renamed", taskId: id, title: fields.title })]))[0]
      : await update;
  if (!task) return { ok: false, error: "not_found" };
  return { ok: true, task };
}
