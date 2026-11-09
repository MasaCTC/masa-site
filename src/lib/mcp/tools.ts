import "server-only";
// Planner tools for the MCP server. The transport authenticates via OAuth, but
// every tool also checks the caller itself (defence in depth): the first
// statement of each exported tool is the owner guard.
import { z } from "zod";
import { OWNER_GITHUB_ID } from "@/auth";
import type { Class } from "@/db";
import {
  addTaskCore,
  addToTodayCore,
  editTaskCore,
  invalid,
  removeFromTodayCore,
  toggleDoneCore,
} from "@/lib/planner/core";
import { invalidateFromHandler } from "@/lib/planner/invalidate";
import { listChecklist, listClasses, listTasks } from "@/lib/planner/queries";
import { addTaskSchema, editTaskSchema } from "@/lib/planner/schemas";
import { plannerToday } from "@/lib/planner/time";
import type { Fail, TaskResult } from "@/lib/planner/types";
import { filterTasks, resolveClass, toTaskView } from "./tasks-view";

export type ToolCtx = { githubId?: string };
export type ToolOutput = { content: [{ type: "text"; text: string }]; isError?: true };

const ok = (data: unknown): ToolOutput => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});
const fail = (message: string): ToolOutput => ({
  content: [{ type: "text", text: message }],
  isError: true,
});
const guard = (ctx: ToolCtx): ToolOutput | null =>
  ctx.githubId === OWNER_GITHUB_ID ? null : fail("Forbidden");

function describeInvalid(e: Extract<Fail, { error: "invalid" }>): string {
  const parts = [
    ...Object.entries(e.fieldErrors).map(([k, v]) => `${k}: ${v.join(", ")}`),
    ...e.formErrors,
  ];
  return `Invalid input. ${parts.join("; ")}`;
}
function describeFail(r: Fail): string {
  if (r.error === "invalid") return describeInvalid(r);
  if (r.error === "not_found") return "Task not found";
  return `Failed: ${r.error}`;
}
function parse<S extends z.ZodType>(schema: S, input: unknown): { data: z.output<S> } | { error: ToolOutput } {
  const p = schema.safeParse(input);
  return p.success ? { data: p.data } : { error: fail(describeInvalid(invalid(p.error))) };
}
function classId(classes: Class[], ref: string): { id: string } | { error: ToolOutput } {
  const r = resolveClass(classes, ref);
  return r.ok ? { id: r.cls.id } : { error: fail(r.message) };
}

const listSchema = z.object({
  day: z.iso.date().optional(),
  class: z.string().optional(),
  status: z.enum(["open", "done", "all"]).optional(),
});
const addSchema = addTaskSchema
  .omit({ classId: true })
  .extend({ class: z.string().optional(), onToday: z.boolean().optional() });
const updateSchema = editTaskSchema
  .omit({ classId: true })
  .extend({ class: z.string().nullable().optional(), onToday: z.boolean().optional() });
const completeSchema = z.object({ id: z.uuid(), done: z.boolean().default(true) });

export async function listTasksTool(
  ctx: ToolCtx,
  input: { day?: string; class?: string; status?: "open" | "done" | "all" },
): Promise<ToolOutput> {
  const denied = guard(ctx);
  if (denied) return denied;
  const p = parse(listSchema, input);
  if ("error" in p) return p.error;
  const [tasks, classes] = await Promise.all([listTasks(), listClasses()]);
  const f = filterTasks(tasks, classes, p.data);
  if (!f.ok) return fail(f.message);
  return ok({ count: f.tasks.length, tasks: f.tasks.map((t) => toTaskView(t, classes)) });
}

export async function getTodaysPlanTool(ctx: ToolCtx): Promise<ToolOutput> {
  const denied = guard(ctx);
  if (denied) return denied;
  const [tasks, classes] = await Promise.all([listChecklist(), listClasses()]);
  return ok({
    date: plannerToday(),
    done: tasks.filter((t) => t.done).length,
    total: tasks.length,
    tasks: tasks.map((t) => toTaskView(t, classes)),
  });
}

export async function addTaskTool(
  ctx: ToolCtx,
  input: { title: string; class?: string; dueDate?: string; estMinutes?: number; onToday?: boolean },
): Promise<ToolOutput> {
  const denied = guard(ctx);
  if (denied) return denied;
  const p = parse(addSchema, input);
  if ("error" in p) return p.error;
  const { class: classRef, onToday, ...rest } = p.data;
  const classes = await listClasses();
  let id: string | null = null;
  if (classRef) {
    const c = classId(classes, classRef);
    if ("error" in c) return c.error;
    id = c.id;
  }
  let r: TaskResult = await addTaskCore({ ...rest, classId: id });
  if (!r.ok) return fail(describeFail(r));
  if (onToday === false) {
    r = await removeFromTodayCore({ id: r.task.id });
    if (!r.ok) return fail(describeFail(r));
  }
  invalidateFromHandler({ now: true });
  return ok({ task: toTaskView(r.task, classes) });
}

export async function updateTaskTool(
  ctx: ToolCtx,
  input: {
    id: string;
    title?: string;
    class?: string | null;
    dueDate?: string | null;
    estMinutes?: number | null;
    onToday?: boolean;
  },
): Promise<ToolOutput> {
  const denied = guard(ctx);
  if (denied) return denied;
  const p = parse(updateSchema, input);
  if ("error" in p) return p.error;
  const { id, class: classRef, onToday } = p.data;
  const edits = {
    ...(input.title !== undefined ? { title: p.data.title } : {}),
    ...(input.dueDate !== undefined ? { dueDate: p.data.dueDate } : {}),
    ...(input.estMinutes !== undefined ? { estMinutes: p.data.estMinutes } : {}),
  };
  const hasEdit = Object.keys(edits).length > 0 || classRef !== undefined;
  if (!hasEdit && onToday === undefined) return fail("Nothing to update: pass at least one field to change");

  const classes = await listClasses();
  let cid: string | null | undefined;
  if (classRef === null) cid = null;
  else if (classRef !== undefined) {
    const c = classId(classes, classRef);
    if ("error" in c) return c.error;
    cid = c.id;
  }

  let r: TaskResult | undefined;
  if (hasEdit) {
    r = await editTaskCore({ id, ...edits, ...(cid !== undefined ? { classId: cid } : {}) });
    if (!r.ok) return fail(describeFail(r));
  }
  if (onToday !== undefined) {
    const t = await (onToday ? addToTodayCore({ id }) : removeFromTodayCore({ id }));
    if (!t.ok) {
      if (r) invalidateFromHandler({ now: true });
      return fail(describeFail(t));
    }
    r = t;
  }
  invalidateFromHandler({ now: true });
  return ok({ task: toTaskView((r as Extract<TaskResult, { ok: true }>).task, classes) });
}

export async function completeTaskTool(
  ctx: ToolCtx,
  input: { id: string; done?: boolean },
): Promise<ToolOutput> {
  const denied = guard(ctx);
  if (denied) return denied;
  const p = parse(completeSchema, input);
  if ("error" in p) return p.error;
  const r = await toggleDoneCore(p.data);
  if (!r.ok) return fail(describeFail(r));
  invalidateFromHandler({ now: true });
  return ok({ task: toTaskView(r.task, await listClasses()) });
}
