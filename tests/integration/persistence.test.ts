import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createPgliteDb } from "@/server/db/adapters";
import { createProfile } from "@/server/repositories/profiles.repo";
import { createTask, listTasks } from "@/server/services/task.service";

describe("on-disk demo database", () => {
  it("creates missing parent directories, migrates, and persists across reopen", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "abd-"));
    const dir = path.join(root, "nested", "does-not-exist-yet", "pglite");
    try {
      const now = new Date("2026-11-02T09:00:00Z");
      const db1 = await createPgliteDb(dir);
      const u = await createProfile(db1, "UTC", now);
      await createTask(db1, u.id, { title: "survives restarts" }, now);
      await db1.close();

      const db2 = await createPgliteDb(dir); // reopening re-runs migrations: must be a no-op
      const tasks = await listTasks(db2, u.id, now);
      expect(tasks.map((t) => t.title)).toEqual(["survives restarts"]);
      const migrations = await db2.query("select 1 from schema_migrations");
      expect(migrations).toHaveLength(1);
      await db2.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
