// Copy for the Canvas sync line (prototype #syncLine) and its error state
// (prototype Settings "Error state": lead + plain follow-up). Pure.
import type { SyncFailure } from "../../../lib/planner/canvas-sync-types.ts";

export type SyncPhase = "idle" | "syncing" | "synced" | "fresh" | "failed";

export type SyncFail = SyncFailure | { ok: false; error: "unauthorized" } | { ok: false; error: "network" };

const UNTOUCHED = "Your existing tasks are untouched.";

export function syncLineText(s: { phase: SyncPhase; count?: number }): string {
  switch (s.phase) {
    case "idle":
      return "";
    case "syncing":
      return "Syncing Canvas…";
    case "synced":
      return `Canvas synced just now · ${s.count ?? 0} ${s.count === 1 ? "assignment" : "assignments"}`;
    case "fresh":
      // Synced < 2 min ago (or another tab is syncing): no count is known.
      return "Canvas synced just now";
    case "failed":
      return "Canvas sync failed";
  }
}

const LINK_GONE = new Set([401, 403, 404, 410]);

/** True when the way out is pasting a fresh link in Settings. */
export function needsNewLink(f: SyncFailure): boolean {
  switch (f.reason) {
    case "http":
      return LINK_GONE.has(f.httpStatus ?? 0);
    case "unreadable":
    case "blocked":
    case "not_ics":
    case "redirects":
      return true;
    default:
      return false;
  }
}

function detailFor(f: SyncFailure): string {
  switch (f.reason) {
    case "http":
      return LINK_GONE.has(f.httpStatus ?? 0)
        ? `The feed returned ${f.httpStatus}. Canvas may have reset the link; paste a fresh one.`
        : `The feed returned ${f.httpStatus ?? "an error"}. Canvas may be down; try again in a few minutes.`;
    case "timeout":
      return "Canvas didn't answer within 10 seconds. Try again in a few minutes.";
    case "network":
      return "Couldn't reach Canvas. Try again in a few minutes, or check the link.";
    case "blocked":
      return "The link has to be a public https Canvas address. Paste the Calendar Feed link from Canvas.";
    case "redirects":
      return "The link kept redirecting. Paste the Calendar Feed link from Canvas.";
    case "too_large":
      return "The feed is over 5 MB, more than a Canvas calendar should be. Check the link.";
    case "not_ics":
      return "The link didn't return a calendar. Paste the Calendar Feed link from Canvas.";
    case "unreadable":
      return "The saved link couldn't be read; the key that protects it may have changed. Paste the link again.";
    case "save_failed":
      return "The planner couldn't save the import. Try again.";
  }
}

/** Lead + detail for the error Message. `when`: on open, or a manual retry/sync. */
export function syncErrorCopy(f: SyncFail, when: "open" | "manual"): { lead: string; detail: string } {
  if (f.error === "unauthorized") return { lead: "Your session ended.", detail: "Sign in again to sync Canvas." };
  const lead = when === "open" ? "Canvas sync failed when you opened the planner." : "Canvas sync failed.";
  if (f.error === "network") return { lead, detail: `Couldn't reach the server. Check your connection. ${UNTOUCHED}` };
  return { lead, detail: `${detailFor(f)} ${UNTOUCHED}` };
}
