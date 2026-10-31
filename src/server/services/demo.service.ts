import type { Db } from "../db/types";
import { createTask } from "./task.service";
import { processDeadlines } from "./deadline.service";
import { updatePreferences } from "./preferences.service";

const H = 3_600_000;

/**
 * Sample case files so a fresh visitor sees the haunting immediately. Deadlines are relative to `now`.
 * Demo archives also start with AI ghost dialogue (open-weight Gemma) switched on, so the ghosts speak in
 * generated lines when the server has a model configured. Only sample titles are involved at first, the
 * login page discloses it, and it can be turned off in Settings. Archives without samples keep it off.
 */
export async function seedDemoData(db: Db, userId: string, now: Date): Promise<void> {
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();
  const samples = [
    { title: "Reply to the landlord about the lease", dueAt: at(-3 * H), description: "Two emails deep by now." },
    { title: "Finish portfolio project section", dueAt: at(-52 * H), description: "Case study for the DEV challenge." },
    { title: "Renew passport", dueAt: at(-9 * 24 * H) },
    { title: "Draft the weekly review", dueAt: at(5 * H) },
    { title: "Water the plants", dueAt: at(30 * H), recurrence: "weekly" as const },
    { title: "Read that paper on distributed clocks" },
  ];
  await updatePreferences(db, userId, { aiDialogueEnabled: true }, now);
  for (const s of samples) await createTask(db, userId, s, now);
  await processDeadlines(db, { now, userId });
}
