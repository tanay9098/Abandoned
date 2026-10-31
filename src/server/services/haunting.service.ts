import type { Db, SqlExecutor } from "../db/types";
import { AppError, notFound } from "../errors";
import * as tasksRepo from "../repositories/tasks.repo";
import * as ghostRepo from "../repositories/ghost-events.repo";
import {
  deriveGhostState,
  type GhostEvent,
  type GhostEventType,
  type GhostPresentation,
  type HauntRecord,
} from "@/features/hauntings/model";
import { eventReviewDialogue, fallbackDialogue, overdueBand } from "@/features/hauntings/dialogue";
import { generateDialogue, aiAvailable, type GenerateOptions } from "../ai/dialogue";
import { readPreferences } from "./preferences.service";
import { rateLimit } from "@/lib/rate-limit";
import { isOverdue, overdueByMs, type Task } from "@/features/tasks/model";

export interface TaskView {
  task: Task;
  isOverdue: boolean;
  overdueMs: number;
  ghostState: GhostPresentation;
  haunting: { eventId: string; acknowledged: boolean; dialogue: string; dialogueSource: "ai" | "fallback" | "default" } | null;
}

function hauntRecord(e: GhostEvent): HauntRecord {
  return { dueAtMs: new Date(String(e.payload.dueAt)).getTime(), acknowledged: e.acknowledgedAt !== null };
}

/** Decorate tasks with derived overdue + ghost presentation (one extra query for all of them). */
export async function decorateTasks(ex: SqlExecutor, userId: string, tasks: Task[], now: Date): Promise<TaskView[]> {
  const events = await ghostRepo.listMissedForTasks(ex, userId, tasks.map((t) => t.id));
  const byTask = new Map<string, GhostEvent[]>();
  for (const e of events) {
    if (!e.taskId) continue;
    const list = byTask.get(e.taskId) ?? [];
    list.push(e);
    byTask.set(e.taskId, list);
  }
  return tasks.map((task) => {
    const evs = byTask.get(task.id) ?? [];
    const overdueMs = overdueByMs(task, now);
    const current = task.dueAt ? evs.find((e) => new Date(String(e.payload.dueAt)).getTime() === task.dueAt!.getTime()) : undefined;
    const stored = current?.payload.dialogue as { text?: string; source?: "ai" | "fallback" } | undefined;
    return {
      task,
      isOverdue: isOverdue(task, now),
      overdueMs,
      ghostState: deriveGhostState(task, evs.map(hauntRecord), now),
      haunting:
        current && isOverdue(task, now)
          ? {
              eventId: current.id,
              acknowledged: current.acknowledgedAt !== null,
              dialogue: stored?.text ?? fallbackDialogue(task.id + ":" + overdueBand(overdueMs), overdueMs),
              dialogueSource: stored?.text ? (stored.source ?? "fallback") : "default",
            }
          : null,
    };
  });
}

export async function listHauntings(
  db: Db,
  userId: string,
  opts: { limit?: number; types?: GhostEventType[]; taskId?: string } = {},
): Promise<GhostEvent[]> {
  return ghostRepo.listGhostEvents(db, userId, opts);
}

export async function acknowledgeHaunting(db: Db, userId: string, eventId: string, now: Date): Promise<GhostEvent> {
  const ev = await ghostRepo.acknowledgeEvent(db, userId, eventId, now);
  if (!ev) throw notFound("Haunting");
  return ev;
}

export async function getTaskForEvent(db: Db, userId: string, ev: GhostEvent): Promise<Task | null> {
  return ev.taskId ? tasksRepo.getTask(db, userId, ev.taskId) : null;
}

// ---------------------------------------------------------------- dialogue

export interface DialogueResult {
  text: string;
  source: "ai" | "fallback";
}

/**
 * Dialogue for a haunting. AI is used only if (a) the user enabled it, (b) a provider key exists,
 * (c) the per-user rate limit allows, and (d) the output validates. Otherwise deterministic copy.
 * The decision that a task is overdue was made long before this runs and is never revisited here.
 */
export async function dialogueFor(db: Db, userId: string, eventId: string, now: Date, ai: GenerateOptions = {}): Promise<DialogueResult> {
  const ev = await ghostRepo.getGhostEvent(db, userId, eventId);
  if (!ev) throw notFound("Haunting");

  if (ev.eventType === "event_review") return { text: eventReviewDialogue(), source: "fallback" };

  const cached = ev.payload.dialogue as { text?: string; source?: "ai" | "fallback" } | undefined;
  if (cached?.text) return { text: cached.text, source: cached.source ?? "fallback" };

  const title = String(ev.payload.title ?? "this task");
  const overdueMs = Math.max(0, now.getTime() - ev.occurredAt.getTime());
  const fallback: DialogueResult = { text: fallbackDialogue(`${ev.taskId ?? ev.id}:${overdueBand(overdueMs)}`, overdueMs), source: "fallback" };

  if (ev.eventType !== "deadline_missed") return fallback;
  const prefs = await readPreferences(db, userId);
  if (!prefs.aiDialogueEnabled || (!ai.apiKey && !aiAvailable())) return fallback;

  const rl = rateLimit(`ai:${userId}`, 20, 3_600_000, now.getTime());
  if (!rl.ok) throw new AppError(429, "rate_limited", "The ghost needs a moment. Try again later.", { retryAfterSec: rl.retryAfterSec });

  const text = await generateDialogue({ title, overdueMs }, ai);
  if (!text) return fallback;
  await ghostRepo.setDialogueOnce(db, userId, eventId, { text, source: "ai" });
  return { text, source: "ai" };
}
