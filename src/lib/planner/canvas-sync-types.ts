// Canvas sync result types. Client-safe (no ical.js, no server code).

export type SyncFailReason =
  /** The saved link could not be decrypted (key changed). */
  | "unreadable"
  /** The link (or a redirect) is not https:443 or points at a non-public address. */
  | "blocked"
  /** DNS / TLS / connection failure. */
  | "network"
  /** No complete answer within the time limit. */
  | "timeout"
  /** Non-2xx answer; httpStatus says which. */
  | "http"
  /** Too many redirects, or one without a Location. */
  | "redirects"
  /** Body over the size cap. */
  | "too_large"
  /** Answer is not an iCalendar feed. */
  | "not_ics"
  /** The feed was fine but writing the import failed (nothing was written). */
  | "save_failed";

export type SyncFailure = { ok: false; error: "sync"; reason: SyncFailReason; httpStatus?: number };

export type SyncOutcome =
  /** Imported; count = assignments in the feed (after skipping non-assignments and duplicate UIDs). */
  | { ok: true; state: "synced"; count: number }
  /** Synced (or a sync started) less than the window ago: nothing fetched. */
  | { ok: true; state: "fresh" }
  /** No feed saved: nothing to do. */
  | { ok: true; state: "no_feed" }
  | SyncFailure;

export type SyncResult = SyncOutcome | { ok: false; error: "unauthorized" };
