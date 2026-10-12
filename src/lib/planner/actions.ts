"use server";
// Planner mutations. Every export is a public POST endpoint, so each one
// calls assertOwner() first, before parsing input or touching the DB
// (enforced by actions-owner.test.ts). Validation failures come back as
// typed results; they never throw to the client.
import { eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { classes, getDb, settings, status, tasks } from "@/db";
import { assertOwner } from "@/lib/owner";
import { runCanvasSync } from "./canvas-sync";
import type { SyncResult } from "./canvas-sync-types";
import { leastUsedColor } from "./colors";
import { encryptFeed } from "./crypto";
import { invalidateFromAction } from "./invalidate";
import { getStatus } from "./queries";
import { isValidRank, rankBetween } from "./rank";
import { bottomRank, rebalance } from "./ranks-db";
import {
  addTaskSchema,
  canvasFeedSchema,
  createClassSchema,
  editTaskSchema,
  idSchema,
  maskFeedUrl,
  renameClassSchema,
  reorderTaskSchema,
  setClassColorSchema,
  setStatusSchema,
  toggleDoneSchema,
  type AddTaskInput,
  type CanvasFeedInput,
  type CreateClassInput,
  type EditTaskInput,
  type IdInput,
  type RenameClassInput,
  type ReorderTaskInput,
  type SetClassColorInput,
  type SetStatusInput,
  type ToggleDoneInput,
} from "./schemas";
import type {
  ClassResult,
  DeleteResult,
  FeedResult,
  Invalid,
  ReorderResult,
  StatusResult,
  TaskResult,
} from "./types";

// ---------- helpers (not exported: a "use server" file may only export actions)

function invalid(error: z.ZodError | string, field?: string): Invalid {
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
const markHandEdited = sql`${tasks.handEdited} OR ${tasks.source} = 'canvas'`;

async function classExists(id: string) {
  const [row] = await getDb().select({ id: classes.id }).from(classes).where(eq(classes.id, id));
  return !!row;
}

// ---------- tasks

/** Adds a manual task at the BOTTOM of the checklist (as the prototype does). */
export async function addTask(input: AddTaskInput): Promise<TaskResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = addTaskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { title, classId, dueDate, estMinutes } = parsed.data;
  if (classId && !(await classExists(classId))) return invalid("That class no longer exists", "classId");

  const db = getDb();
  const rank = await bottomRank(db);
  const [task] = await db
    .insert(tasks)
    .values({ title, classId, dueDate, estMinutes, rank, source: "manual" })
    .returning();
  invalidateFromAction({ now: true });
  return { ok: true, task };
}

/** Sets done/open. done_at is kept if already done, cleared when reopened. */
export async function toggleDone(input: ToggleDoneInput): Promise<TaskResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
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
  invalidateFromAction({ now: true });
  return { ok: true, task };
}

/** Edits title / class / due date / estimate; omitted fields are unchanged. */
export async function editTask(input: EditTaskInput): Promise<TaskResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
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

  const [task] = await getDb()
    .update(tasks)
    .set({ ...fields, ...(handEdited ? { handEdited } : {}) })
    .where(eq(tasks.id, id))
    .returning();
  if (!task) return { ok: false, error: "not_found" };
  invalidateFromAction({ now: true });
  return { ok: true, task };
}

export async function deleteTask(input: IdInput): Promise<DeleteResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await getDb()
    .delete(tasks)
    .where(eq(tasks.id, parsed.data.id))
    .returning({ id: tasks.id });
  if (!row) return { ok: false, error: "not_found" };
  invalidateFromAction({ now: true });
  return { ok: true, id: row.id };
}

/**
 * Moves a task between its new neighbours: beforeId = the task now directly
 * above it, afterId = directly below (null at either end). One UPDATE of one
 * row; only if the neighbours' ranks are unusable (equal, out of order,
 * invalid) does it re-rank the whole list in a single statement.
 * "stale" = the moved task or a neighbour no longer exists: refetch.
 */
export async function reorderTask(input: ReorderTaskInput): Promise<ReorderResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = reorderTaskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, beforeId, afterId } = parsed.data;

  const db = getDb();
  const wanted = [id, beforeId, afterId].filter((x): x is string => x !== null);
  const rows = await db
    .select({ id: tasks.id, rank: tasks.rank })
    .from(tasks)
    .where(inArray(tasks.id, wanted));
  const rankOf = new Map(rows.map((r) => [r.id, r.rank]));
  if (wanted.some((x) => !rankOf.has(x))) return { ok: false, error: "stale" };

  const a = beforeId ? rankOf.get(beforeId)! : null;
  const b = afterId ? rankOf.get(afterId)! : null;
  const usable =
    (a === null || isValidRank(a)) && (b === null || isValidRank(b)) && (a === null || b === null || a < b);

  let rank: string;
  let rebalanced = false;
  if (usable) {
    rank = rankBetween(a, b);
    await db.update(tasks).set({ rank, handEdited: markHandEdited }).where(eq(tasks.id, id));
  } else {
    const ranks = await rebalance(db, { id, beforeId, afterId });
    if (!ranks) return { ok: false, error: "stale" };
    const [row] = await db.select({ rank: tasks.rank }).from(tasks).where(eq(tasks.id, id));
    rank = row?.rank ?? ranks[0];
    rebalanced = true;
  }
  invalidateFromAction({ now: false });
  return { ok: true, rank, rebalanced };
}

// ---------- classes and categories

/** Creates a class or category; without a color, picks the least used one. */
export async function createClass(input: CreateClassInput): Promise<ClassResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = createClassSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name, kind } = parsed.data;

  const db = getDb();
  let color = parsed.data.color;
  if (!color) {
    const used = await db.select({ color: classes.color }).from(classes);
    color = leastUsedColor(used.map((r) => r.color));
  }
  const [row] = await db.insert(classes).values({ name, kind, color }).returning();
  invalidateFromAction({ now: false });
  return { ok: true, class: row };
}

export async function renameClass(input: RenameClassInput): Promise<ClassResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = renameClassSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await getDb()
    .update(classes)
    .set({ name: parsed.data.name })
    .where(eq(classes.id, parsed.data.id))
    .returning();
  if (!row) return { ok: false, error: "not_found" };
  invalidateFromAction({ now: true }); // "Studying for <name>"
  return { ok: true, class: row };
}

export async function setClassColor(input: SetClassColorInput): Promise<ClassResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = setClassColorSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await getDb()
    .update(classes)
    .set({ color: parsed.data.color })
    .where(eq(classes.id, parsed.data.id))
    .returning();
  if (!row) return { ok: false, error: "not_found" };
  invalidateFromAction({ now: true });
  return { ok: true, class: row };
}

/** Deletes a class; its tasks keep existing with no class (FK set null). */
export async function deleteClass(input: IdInput): Promise<DeleteResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await getDb()
    .delete(classes)
    .where(eq(classes.id, parsed.data.id))
    .returning({ id: classes.id });
  if (!row) return { ok: false, error: "not_found" };
  invalidateFromAction({ now: true });
  return { ok: true, id: row.id };
}

// ---------- public status

/**
 * Sets the /now status: { mode: "study", classId } (a class, not a
 * category), { mode: "build", text }, { mode: "free" }, or { taskId } for
 * "Show on /now", which publishes that open task's title as
 * "Building <title>" (title read here, never from the client).
 */
export async function setStatus(input: SetStatusInput): Promise<StatusResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;
  const db = getDb();

  let values: Omit<typeof status.$inferInsert, "id" | "since">;
  if ("taskId" in data) {
    const [task] = await db
      .select({ title: tasks.title, done: tasks.done })
      .from(tasks)
      .where(eq(tasks.id, data.taskId));
    if (!task) return { ok: false, error: "not_found" };
    if (task.done) return invalid("Done tasks can't be shown on /now", "taskId");
    values = { mode: "build", text: task.title, classId: null, taskId: data.taskId };
  } else if (data.mode === "study") {
    const [cls] = await db
      .select({ kind: classes.kind })
      .from(classes)
      .where(eq(classes.id, data.classId));
    if (!cls) return invalid("That class no longer exists", "classId");
    if (cls.kind !== "class") return invalid("Pick a class, not a category", "classId");
    values = { mode: "study", text: null, classId: data.classId, taskId: null };
  } else if (data.mode === "build") {
    values = { mode: "build", text: data.text, classId: null, taskId: null };
  } else {
    values = { mode: "free", text: null, classId: null, taskId: null };
  }

  const row = { ...values, since: sql`now()` };
  await db
    .insert(status)
    .values({ id: 1, ...row })
    .onConflictDoUpdate({ target: status.id, set: row });
  invalidateFromAction({ now: true });
  return { ok: true, status: await getStatus() };
}

// ---------- settings

/** Saves the Canvas feed URL encrypted (https only); "" clears it. */
export async function saveCanvasFeed(input: CanvasFeedInput): Promise<FeedResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  const parsed = canvasFeedSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { url } = parsed.data;

  let enc: string | null = null;
  if (url) {
    try {
      enc = encryptFeed(url);
    } catch {
      // Missing/invalid PLANNER_ENCRYPTION_KEY: fail closed, store nothing.
      return { ok: false, error: "unavailable" };
    }
  }
  // A new (or no) link has never been synced: clearing last_synced_at also
  // lets the sync that follows a save through the claim right away.
  await getDb()
    .insert(settings)
    .values({ id: 1, canvasFeedEnc: enc, lastSyncedAt: null })
    .onConflictDoUpdate({ target: settings.id, set: { canvasFeedEnc: enc, lastSyncedAt: null } });
  invalidateFromAction({ now: false });
  return { ok: true, masked: url ? maskFeedUrl(url) : null };
}

// ---------- Canvas sync

/**
 * Syncs the saved Canvas feed. Called by the planner on open (`manual`
 * false: skipped if a sync succeeded or started < 2 min ago) and by
 * "Try again" / "Sync now" (`manual` true: 15 s guard). See canvas-sync.ts.
 */
export async function syncCanvas(input?: { manual?: boolean }): Promise<SyncResult> {
  const owner = await assertOwner();
  if (!owner.ok) return owner;
  // Public POST endpoint: accept only a literal true.
  const manual = input?.manual === true;

  let result: SyncResult;
  try {
    result = await runCanvasSync({ manual });
  } catch {
    // The claim/lookup itself failed (database unreachable).
    return { ok: false, error: "sync", reason: "save_failed" };
  }
  // Imports change the checklist, the calendar, classes and /now's counts.
  if (result.ok && result.state === "synced") invalidateFromAction({ now: true });
  return result;
}
