import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface MigrationRunner {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export function migrationsDir(): string {
  // turbopackIgnore: the directory is deliberately resolved at runtime (outputFileTracingIncludes ships the .sql files).
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "supabase", "migrations");
}

export function listMigrations(dir = migrationsDir()): { name: string; sql: string }[] {
  return readdirSync(/* turbopackIgnore: true */ dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((name) => ({ name, sql: readFileSync(/* turbopackIgnore: true */ path.join(dir, name), "utf8") }));
}

/**
 * Applies pending migrations in order, each inside a transaction, recording them in
 * `schema_migrations`. Applied migrations are never re-run or edited.
 */
export async function runMigrations(runner: MigrationRunner, dir = migrationsDir()): Promise<string[]> {
  await runner.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await runner.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const m of listMigrations(dir)) {
    if (done.has(m.name)) continue;
    await runner.exec("begin");
    try {
      await runner.exec(m.sql);
      await runner.query("insert into schema_migrations (name) values ($1)", [m.name]);
      await runner.exec("commit");
      applied.push(m.name);
    } catch (err) {
      await runner.exec("rollback");
      throw new Error(`Migration ${m.name} failed: ${(err as Error).message}`);
    }
  }
  return applied;
}
