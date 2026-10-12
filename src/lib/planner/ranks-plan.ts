// Pure pieces of the rank rebalance (no server-only, no "@/" imports), so
// node:test can check the ordering logic and the generated SQL.
import { sql, type SQL } from "drizzle-orm";

export type Move = { id: string; beforeId: string | null; afterId: string | null };

/**
 * `ids` in list order with `move.id` placed right after beforeId (or right
 * before afterId). null if the moved task or its anchor no longer exists.
 */
export function placeMoved(ids: readonly string[], move: Move): string[] | null {
  if (!ids.includes(move.id)) return null;
  const rest = ids.filter((x) => x !== move.id);
  const anchor = move.beforeId ?? move.afterId;
  const i = anchor === null ? -1 : rest.indexOf(anchor);
  if (i < 0) return null;
  rest.splice(move.beforeId ? i + 1 : i, 0, move.id);
  return rest;
}

/**
 * One UPDATE giving ids[i] the rank ranks[i]. With movedId, that row (only)
 * is also marked hand-edited if it came from Canvas; without it hand_edited
 * is not touched at all.
 */
export function rebalanceSql(ids: readonly string[], ranks: readonly string[], movedId: string | null): SQL {
  const values = sql.join(
    ids.map((id, i) => sql`(${id}::uuid, ${ranks[i]}::text)`),
    sql`, `,
  );
  const handEdited =
    movedId === null
      ? sql``
      : sql`, hand_edited = tasks.hand_edited OR (tasks.id = ${movedId}::uuid AND tasks.source = 'canvas')`;
  return sql`UPDATE tasks SET rank = v.rank${handEdited} FROM (VALUES ${values}) AS v(id, rank) WHERE tasks.id = v.id`;
}
