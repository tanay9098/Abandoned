/** Minimal SQL surface shared by the pg (Supabase/Postgres) and PGlite (demo/test) adapters. */
export interface SqlExecutor {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends SqlExecutor {
  /** Runs `fn` in a single transaction (COMMIT on resolve, ROLLBACK on throw). */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
