import { createPgliteDb } from "@/server/db/adapters";
import type { Db } from "@/server/db/types";

export async function freshDb(): Promise<Db> {
  return createPgliteDb();
}

import { createProfile } from "@/server/repositories/profiles.repo";
import { createTask } from "@/server/services/task.service";

export const T0 = new Date("2026-11-02T09:00:00Z");
export const minutes = (n: number) => n * 60_000;
export const hours = (n: number) => n * 3_600_000;

export async function newUser(db: Db, timezone = "Asia/Kolkata", now = T0) {
  return createProfile(db, timezone, now);
}

export async function newTask(db: Db, userId: string, dueAt: Date | null, title = "Task", now = T0) {
  return createTask(db, userId, { title, dueAt: dueAt ? dueAt.toISOString() : undefined } as never, now);
}
