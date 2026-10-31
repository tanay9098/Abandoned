import type { GhostEventType, GhostPresentation } from "@/features/hauntings/model";
import type { Recurrence, TaskStatus } from "@/features/tasks/model";
import type { EffectiveEventStatus } from "@/features/calendar/model";
import type { ReviewSummary } from "@/features/midnight-review/summary";

export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: string | null;
  dueTimezone: string | null;
  sourceType: "native" | "calendar";
  recurrence: Recurrence | null;
  completedAt: string | null;
  releasedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  overdueMs: number;
  ghostState: GhostPresentation;
  haunting: { eventId: string; acknowledged: boolean; dialogue: string; dialogueSource: "ai" | "fallback" | "default" } | null;
}

export interface GhostEventDTO {
  id: string;
  taskId: string | null;
  calendarEventId: string | null;
  eventType: GhostEventType;
  occurredAt: string;
  acknowledgedAt: string | null;
  payload: Record<string, unknown>;
}

export interface CalendarEventDTO {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: EffectiveEventStatus;
  htmlLink: string | null;
  source: "google_calendar";
  reviewedAt: string | null;
}

export interface ConnectionDTO {
  mode: "google" | "mock" | "unconfigured";
  connected: boolean;
  isDemo: boolean;
  lastSyncedAt: string | null;
  scopes: string[];
}

export interface ReviewDTO {
  review: {
    id: string;
    localDate: string;
    timezone: string;
    summary: ReviewSummary;
    presentedAt: string | null;
    dismissedAt: string | null;
  } | null;
  pending: boolean;
  tasks: { id: string; title: string; status: string; dueAt: string | null; stillOverdue: boolean }[];
}

export type { Preferences } from "@/features/preferences/model";
