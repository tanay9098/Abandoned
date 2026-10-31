import type { Task } from "@/features/tasks/model";
import type { GhostEvent } from "@/features/hauntings/model";
import type { TaskView } from "./services/haunting.service";
import type { CalendarEvent } from "./repositories/calendar.repo";
import { effectiveEventStatus } from "@/features/calendar/model";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function serializeTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    dueAt: iso(t.dueAt),
    dueTimezone: t.dueTimezone,
    sourceType: t.sourceType,
    sourceRef: t.sourceRef,
    recurrence: t.recurrence,
    completedAt: iso(t.completedAt),
    releasedAt: iso(t.releasedAt),
    version: t.version,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeTaskView(v: TaskView) {
  return { ...serializeTask(v.task), isOverdue: v.isOverdue, overdueMs: v.overdueMs, ghostState: v.ghostState, haunting: v.haunting };
}

export function serializeGhostEvent(e: GhostEvent) {
  return {
    id: e.id,
    taskId: e.taskId,
    calendarEventId: e.calendarEventId,
    eventType: e.eventType,
    occurredAt: e.occurredAt.toISOString(),
    acknowledgedAt: iso(e.acknowledgedAt),
    payload: e.payload,
  };
}

export function serializeEvent(e: CalendarEvent, now: Date) {
  return {
    id: e.id,
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    allDay: e.allDay,
    status: effectiveEventStatus(e.status, e.endsAt, now),
    htmlLink: e.htmlLink,
    source: "google_calendar" as const,
    reviewedAt: iso(e.reviewedAt),
  };
}
