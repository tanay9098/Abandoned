import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Db, SqlExecutor } from "./types";
import { runMigrations } from "./migrate";

/** PGlite: real Postgres compiled to WASM — zero-config demo database and the integration-test DB. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  // PGlite does not create missing parent directories for an on-disk database.
  if (dataDir && !dataDir.includes("://")) mkdirSync(path.dirname(path.resolve(/* turbopackIgnore: true */ dataDir)), { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  await runMigrations({
    exec: (sql) => pg.exec(sql),
    query: async (sql, params) => ({ rows: (await pg.query(sql, params as never)).rows as never }),
  });
  const wrap = (exec: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): SqlExecutor => ({
    query: async <T,>(text: string, params?: unknown[]) => (await exec.query(text, params)).rows as T[],
  });
  return {
    ...wrap(pg as never),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx as never))),
    close: () => pg.close(),
  };
}

/** node-postgres pool for Supabase / any PostgreSQL (DATABASE_URL). */
export async function createPgDb(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    max: 5,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  const wrap = (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): SqlExecutor => ({
    query: async <T,>(text: string, params?: unknown[]) => (await c.query(text, params)).rows as T[],
  });
  return {
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn(wrap(client));
        await client.query("commit");
        return out;
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
