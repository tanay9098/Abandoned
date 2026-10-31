// Usage: DATABASE_URL=postgres://... npm run db:migrate   (Node >= 22.18 runs .ts natively)
import { Client } from "pg";
import { runMigrations } from "../src/server/db/migrate.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. (Without it the app uses a local PGlite demo database that migrates itself.)");
  process.exit(1);
}

const client = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
await client.connect();
try {
  const applied = await runMigrations({
    exec: (sql) => client.query(sql),
    query: async (sql, params) => ({ rows: (await client.query(sql, params)).rows }),
  });
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
} finally {
  await client.end();
}
