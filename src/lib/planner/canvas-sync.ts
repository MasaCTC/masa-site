import "server-only";
import { eq, sql } from "drizzle-orm";
import { classes, getDb, settings } from "@/db";
import { CanvasFeedError, parseCanvasFeed } from "./canvas-parse";
import { FeedFetchError, fetchFeedText } from "./canvas-fetch";
import {
  chunk,
  claimSql,
  insertClassesSql,
  orderForImport,
  planNewClasses,
  releaseSql,
  SYNC_WINDOW_SECONDS,
  upsertTasksSql,
} from "./canvas-plan";
import type { SyncOutcome } from "./canvas-sync-types";
import { decryptFeed } from "./crypto";
import { bottomRanks } from "./ranks-db";

// Canvas sync. Callers must check the owner first (the syncCanvas action).
//
// 1. Claim (one atomic UPDATE on settings.last_synced_at): skipped when a
//    sync succeeded or started inside the window, so tabs/visits that race
//    do not both sync.
// 2. Decrypt, fetch, parse the WHOLE feed. Nothing is written until the
//    feed parsed, so a bad feed leaves every task as it was.
// 3. One db.batch (a single transaction on neon-http): classes, tasks,
//    settings stamp.
// On any failure the claim is released (last_synced_at goes back to the last
// successful sync) so the next visit retries instead of hiding the error
// behind the window.

const UPSERT_CHUNK = 500;

type Claim = { enc: string; claimed: string; prev: string | null };

export async function runCanvasSync({ manual }: { manual: boolean }): Promise<SyncOutcome> {
  const db = getDb();
  const window = manual ? SYNC_WINDOW_SECONDS.manual : SYNC_WINDOW_SECONDS.open;
  const claimed = await db.execute<Claim>(claimSql(window));
  const claim = claimed.rows[0];
  if (!claim) {
    const [row] = await db.select({ enc: settings.canvasFeedEnc }).from(settings).where(eq(settings.id, 1));
    return row?.enc ? { ok: true, state: "fresh" } : { ok: true, state: "no_feed" };
  }

  const fail = async (outcome: Extract<SyncOutcome, { ok: false }>): Promise<SyncOutcome> => {
    try {
      await db.execute(releaseSql(claim.claimed, claim.prev));
    } catch {
      // The claim then simply expires after the window.
    }
    return outcome;
  };

  let feedUrl: string;
  try {
    feedUrl = decryptFeed(claim.enc);
  } catch {
    return fail({ ok: false, error: "sync", reason: "unreadable" });
  }

  let text: string;
  try {
    text = await fetchFeedText(feedUrl);
  } catch (err) {
    const e = err instanceof FeedFetchError ? err : new FeedFetchError("network");
    return fail({ ok: false, error: "sync", reason: e.reason, ...(e.httpStatus ? { httpStatus: e.httpStatus } : {}) });
  }

  let assignments;
  try {
    assignments = orderForImport(parseCanvasFeed(text));
  } catch (err) {
    return fail({ ok: false, error: "sync", reason: err instanceof CanvasFeedError ? err.reason : "not_ics" });
  }

  try {
    const existing = await db.select({ canvasCode: classes.canvasCode, color: classes.color }).from(classes);
    const newClasses = planNewClasses(assignments, existing);
    // Every row gets a bottom rank in import order; only rows that are
    // actually inserted keep theirs (ON CONFLICT never sets rank).
    const ranks = await bottomRanks(assignments.length, db);
    const rows = assignments.map((a, i) => ({ a, rank: ranks[i] }));
    const stamp = db.execute(sql`UPDATE settings SET last_synced_at = now() WHERE id = 1`);
    const writes = [
      ...(newClasses.length ? [db.execute(insertClassesSql(newClasses))] : []),
      ...chunk(rows, UPSERT_CHUNK).map((c) => db.execute(upsertTasksSql(c))),
    ];
    await db.batch([stamp, ...writes]);
  } catch {
    return fail({ ok: false, error: "sync", reason: "save_failed" });
  }

  return { ok: true, state: "synced", count: assignments.length };
}
