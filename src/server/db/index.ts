import { env } from "@/lib/env";
import { createPgDb, createPgliteDb } from "./adapters";
import type { Db } from "./types";

const g = globalThis as unknown as { __abandonmentDb?: Promise<Db> };

/**
 * Process-wide database.
 *  - DATABASE_URL set  -> PostgreSQL / Supabase (run `npm run db:migrate` first).
 *  - otherwise         -> PGlite demo database at PGLITE_DIR (default .data/pglite), self-migrating.
 *    Use PGLITE_DIR=memory:// for an ephemeral instance.
 */
export function getDb(): Promise<Db> {
  if (!g.__abandonmentDb) {
    const e = env();
    g.__abandonmentDb = e.DATABASE_URL ? createPgDb(e.DATABASE_URL) : createPgliteDb(e.PGLITE_DIR ?? ".data/pglite");
  }
  return g.__abandonmentDb;
}
