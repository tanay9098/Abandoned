import { isValidTimeZone, startOfLocalDay } from "@/lib/datetime/zone";

export type StoredEventStatus = "upcoming" | "past_pending_review" | "confirmed_missed" | "not_missed" | "cancelled";
export type EffectiveEventStatus = StoredEventStatus;

export interface NormalizedEvent {
  providerEventId: string;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  allDay: boolean;
  cancelled: boolean;
  htmlLink: string | null;
}

interface GoogleTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}
export interface GoogleEventResource {
  id?: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  start?: GoogleTime;
  end?: GoogleTime;
}

const MAX_TITLE = 200;

function safeLink(link: unknown): string | null {
  if (typeof link !== "string") return null;
  try {
    const u = new URL(link);
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "google.com" && !u.hostname.endsWith(".google.com")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Normalise a Google Calendar event resource (fetched with singleEvents=true, so recurring
 * events arrive as individually-identified instances).
 *  - All-day events (`date`) are anchored to the user's zone; Google's end date is exclusive.
 *  - Cancelled events may carry no times; they are returned with null times so the caller
 *    can mark an already-known row as cancelled.
 *  - Event descriptions/attendees are intentionally never read (untrusted, unnecessary).
 */
export function normalizeGoogleEvent(raw: GoogleEventResource, userTimezone: string): NormalizedEvent | null {
  if (!raw || typeof raw.id !== "string" || raw.id.length === 0 || raw.id.length > 1024) return null;
  const zone = isValidTimeZone(userTimezone) ? userTimezone : "UTC";
  const cancelled = raw.status === "cancelled";
  const title = (typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : "(No title)").slice(0, MAX_TITLE);
  const base = { providerEventId: raw.id, title, cancelled, htmlLink: safeLink(raw.htmlLink) };

  const startDate = raw.start?.date;
  const startDateTime = raw.start?.dateTime;
  if (startDate) {
    const s = parseDay(startDate, zone);
    const endDay = raw.end?.date ?? startDate;
    const e = parseDay(endDay, zone);
    if (s === null || e === null) return cancelled ? { ...base, startsAt: null, endsAt: null, allDay: true } : null;
    return { ...base, startsAt: new Date(s), endsAt: new Date(Math.max(e, s)), allDay: true };
  }
  if (startDateTime) {
    const s = Date.parse(startDateTime);
    const e = Date.parse(raw.end?.dateTime ?? startDateTime);
    if (Number.isNaN(s) || Number.isNaN(e)) return cancelled ? { ...base, startsAt: null, endsAt: null, allDay: false } : null;
    return { ...base, startsAt: new Date(s), endsAt: new Date(Math.max(e, s)), allDay: false };
  }
  return cancelled ? { ...base, startsAt: null, endsAt: null, allDay: false } : null;
}

function parseDay(date: string, zone: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  try {
    return startOfLocalDay(date, zone);
  } catch {
    return null;
  }
}

/**
 * Stored `upcoming` / `past_pending_review` are time-dependent, so the effective status is
 * always recomputed against `now`. An event that has merely ended is "awaiting review" —
 * never "missed" (PRD FR-05).
 */
export function effectiveEventStatus(stored: StoredEventStatus, endsAt: Date, now: Date | number): EffectiveEventStatus {
  if (stored === "confirmed_missed" || stored === "not_missed" || stored === "cancelled") return stored;
  const nowMs = typeof now === "number" ? now : now.getTime();
  return endsAt.getTime() <= nowMs ? "past_pending_review" : "upcoming";
}

export type ReviewDecision = "confirmed_missed" | "not_missed";
