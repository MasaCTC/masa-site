// Turns a failed planner action result into the inline error copy (Feedback.md:
// a bold lead + a plain follow-up). Pure.
import type { Fail } from "../../../lib/planner/types.ts";

export type ActionFail = Fail | { ok: false; error: "network" };

export type ErrorCopy = { lead: string; detail: string };

/** First message for a field, or undefined. */
export function fieldError(r: ActionFail, field: string): string | undefined {
  return r.error === "invalid" ? r.fieldErrors[field]?.[0] : undefined;
}

export function errorCopy(r: ActionFail, undo = "Your change was undone."): ErrorCopy {
  const c = copyFor(r, undo);
  return { lead: c.lead, detail: c.detail.trim() };
}

function copyFor(r: ActionFail, undo: string): ErrorCopy {
  switch (r.error) {
    case "unauthorized":
      return { lead: "Your session ended.", detail: "Sign in again to keep editing. " + undo };
    case "stale":
    case "not_found":
      return { lead: "That changed somewhere else.", detail: "The planner was refreshed. Try again." };
    case "unavailable":
      return { lead: "Couldn't save.", detail: "The server couldn't store that right now. " + undo };
    case "network":
      return { lead: "Couldn't reach the server.", detail: "Check your connection. " + undo };
    case "invalid": {
      const first = r.formErrors[0] ?? Object.values(r.fieldErrors).flat()[0];
      return { lead: "Couldn't save that.", detail: first ? first + "." : undo };
    }
  }
}
