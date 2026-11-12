"use client";
// Shared planner client state: the optimistic task/class stores, the action
// runner (optimistic update -> server action -> rollback + inline error) and
// the polite live region. Provided by <Planner>, read by every view.
import { createContext, useContext, type CSSProperties } from "react";
import type { Class, Task } from "@/db/schema";
import type { Result } from "@/lib/planner/types";
import type { StatusView } from "@/lib/planner/queries";
import type { ActionFail, ErrorCopy } from "../_lib/errors";
import type { ClassAction, TaskAction } from "../_lib/tasks";

export type RunOptions<T extends object> = {
  /** Optimistic store updates, applied inside the transition. */
  optimistic?: () => void;
  call: () => Promise<Result<T>>;
  onOk?: (r: { ok: true } & T) => void;
  /** Return true when the caller showed the error itself (e.g. a field error). */
  onFail?: (r: ActionFail) => boolean | void;
  /** Polite live-region message on success. */
  success?: string;
};

export type PlannerCtx = {
  today: string;
  tasks: Task[];
  classes: Class[];
  classById: Map<string, Class>;
  status: StatusView;
  applyTask: (a: TaskAction) => void;
  applyClass: (a: ClassAction) => void;
  run: <T extends object>(opts: RunOptions<T>) => void;
  announce: (message: string) => void;
  openTask: (id: string) => void;
  /** The current action error (also shown inside the task modal). */
  error: ErrorCopy | null;
};

export const PlannerContext = createContext<PlannerCtx | null>(null);

export function usePlanner(): PlannerCtx {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner outside <Planner>");
  return ctx;
}

/** Inline --c for a class color (ClassColor.md); ink-subtle when no class. */
export function colorVar(cls: Class | undefined | null): CSSProperties {
  return { "--c": cls ? `var(--cls-${cls.color})` : "var(--ink-subtle)" } as CSSProperties;
}
