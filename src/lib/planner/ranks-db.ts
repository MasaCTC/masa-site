import "server-only";
import { desc, sql } from "drizzle-orm";
import { getDb, tasks } from "@/db";
import { isValidRank, rankBetween, rankSequence } from "./rank";
import { placeMoved, rebalanceSql, type Move } from "./ranks-plan";

type Db = ReturnType<typeof getDb>;

/** Byte-order rank sort; always use this, never plain ORDER BY rank. */
export const rankAsc = [sql`${tasks.rank} COLLATE "C"`, tasks.id] as const;

/**
 * A rank below every task (new tasks go to the bottom of the checklist,
 * as in the prototype: "Added to the bottom of the list."). Also for
 * Canvas imports, which land at the bottom too.
 */
export async function bottomRank(db: Db = getDb()): Promise<string> {
  const [last] = await db
    .select({ rank: tasks.rank })
    .from(tasks)
    .orderBy(sql`${tasks.rank} COLLATE "C" DESC`, desc(tasks.id))
    .limit(1);
  if (!last) return rankBetween(null, null);
  if (isValidRank(last.rank)) return rankBetween(last.rank, null);
  // Corrupt rank at the bottom: rebalance everything, then append.
  const ranks = await rebalance(db);
  return rankBetween(ranks?.at(-1) ?? null, null);
}

/** `count` consecutive ranks after the current bottom (bulk imports). */
export async function bottomRanks(count: number, db: Db = getDb()): Promise<string[]> {
  const out: string[] = [];
  let prev = count > 0 ? await bottomRank(db) : null;
  for (let i = 0; i < count; i++) {
    out.push(prev!);
    prev = rankBetween(prev, null);
  }
  return out;
}

/**
 * Re-ranks every task evenly in one UPDATE. With `move`, places that task
 * right after `beforeId` (or right before `afterId`) first, and marks it
 * hand-edited if it came from Canvas. Other rows keep hand_edited as is.
 * Returns the new ranks in list order, or null (nothing written) when the
 * moved task or its anchor no longer exists.
 */
export async function rebalance(db: Db, move?: Move): Promise<string[] | null> {
  const rows = await db.select({ id: tasks.id }).from(tasks).orderBy(...rankAsc);
  const ids = move ? placeMoved(rows.map((r) => r.id), move) : rows.map((r) => r.id);
  if (ids === null) return null;
  if (ids.length === 0) return [];
  const ranks = rankSequence(ids.length);
  await db.execute(rebalanceSql(ids, ranks, move?.id ?? null));
  return ranks;
}
