// Test stub for "@/db" (see src/test/hooks.mjs): the real schema, and a
// getDb() whose Drizzle instance talks to a recording fake of the Neon HTTP
// client instead of the network. Every statement the app sends (one-off or
// inside db.batch) lands in `dbLog`; nothing ever reaches a real database.
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema.ts";

export * from "../../db/schema.ts";

export type Sent = { sql: string; params: unknown[] };
export type LogEntry = ({ kind: "query" } & Sent) | { kind: "batch"; queries: Sent[] };

/** Rows to answer a statement with (arrays when `arrayMode`, objects otherwise). */
export type Responder = (q: Sent & { arrayMode: boolean }) => unknown[];

export const dbLog: LogEntry[] = [];
export const dbStats = { getDbCalls: 0 };
let responder: Responder = () => [];

export function resetDb(r: Responder = () => []) {
  dbLog.length = 0;
  dbStats.getDbCalls = 0;
  responder = r;
}

type Opts = { arrayMode?: boolean };
type Lazy = Sent & { arrayMode: boolean; then: PromiseLike<unknown>["then"] };

const answer = (q: Sent & { arrayMode: boolean }) => {
  const rows = responder(q);
  return { rows, fields: [], rowCount: rows.length, command: "" };
};

// Like @neondatabase/serverless: a query is lazy. Awaiting it runs it on
// its own; passing it to transaction() runs it as part of one batch.
function fakeQuery(sql: string, params: unknown[] = [], opts: Opts = {}): Lazy {
  const q = { sql, params, arrayMode: !!opts.arrayMode };
  return {
    ...q,
    then(onOk, onErr) {
      dbLog.push({ kind: "query", sql, params });
      return Promise.resolve(answer(q)).then(onOk, onErr);
    },
  };
}

async function transaction(queries: Lazy[]) {
  dbLog.push({ kind: "batch", queries: queries.map(({ sql, params }) => ({ sql, params })) });
  return queries.map((q) => answer(q));
}

const client = Object.assign(fakeQuery, { transaction });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake stands in for the NeonQueryFunction type
const db = drizzle({ client: client as any, schema });

export function getDb() {
  dbStats.getDbCalls++;
  return db;
}
