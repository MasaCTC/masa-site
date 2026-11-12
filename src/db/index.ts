import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Runtime uses the pooled connection string (DATABASE_URL).
// Created lazily so importing this module never throws at build time.
let _db: ReturnType<typeof create> | undefined;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

export function getDb() {
  return (_db ??= create());
}

export * from "./schema";
