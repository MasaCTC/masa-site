// Result types shared by planner server actions and their callers.
import type { Class, Task } from "@/db/schema";
import type { StatusView } from "./queries";

export type ActionError = "unauthorized" | "invalid" | "not_found" | "stale" | "unavailable";

export type Invalid = {
  ok: false;
  error: "invalid";
  /** Per-field messages, keyed by input field name. */
  fieldErrors: Record<string, string[]>;
  /** Messages not tied to one field. */
  formErrors: string[];
};

export type Fail =
  | { ok: false; error: Exclude<ActionError, "invalid"> }
  | Invalid;

export type Result<T extends object = object> = ({ ok: true } & T) | Fail;

export type TaskResult = Result<{ task: Task }>;
export type DeleteResult = Result<{ id: string }>;
export type ReorderResult = Result<{ rank: string; rebalanced: boolean }>;
export type ClassResult = Result<{ class: Class }>;
export type StatusResult = Result<{ status: StatusView }>;
export type FeedResult = Result<{ masked: string | null }>;
