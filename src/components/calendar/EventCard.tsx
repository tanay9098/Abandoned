"use client";
import { useState } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { stamp } from "@/lib/client/format";
import type { CalendarEventDTO } from "@/lib/client/types";

const STATUS: Record<CalendarEventDTO["status"], { label: string; tone: "neutral" | "warning" | "danger" | "success" | "spectral" }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  past_pending_review: { label: "Awaiting your review", tone: "warning" },
  confirmed_missed: { label: "Marked missed by you", tone: "danger" },
  not_missed: { label: "Attended", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/**
 * Calendar events are external and visually distinct from tasks (dashed border, source label, original link).
 * An ended event is never presented as missed until the user says so.
 */
export function EventCard({ event, demo }: { event: CalendarEventDTO; demo: boolean }) {
  const ws = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const s = STATUS[event.status];

  async function decide(d: "confirmed_missed" | "not_missed") {
    setBusy(d);
    setErr(null);
    try {
      await ws.reviewEvent(event.id, d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save your answer.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li data-testid="event-card" data-event-title={event.title} className="rounded-lg border border-dashed border-border bg-surface/60 px-3.5 py-3">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">{event.title}</span>
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          <p className="meta mt-1">
            {event.allDay ? `ALL DAY · ${stamp(event.startsAt, ws.tz, false)}` : `${stamp(event.startsAt, ws.tz)} → ${stamp(event.endsAt, ws.tz).split(" · ")[1]}`}
          </p>
          <p className="meta mt-0.5 flex flex-wrap items-center gap-x-2">
            <span>SOURCE · {demo ? "DEMO CALENDAR (SAMPLE DATA)" : "GOOGLE CALENDAR"}</span>
            {event.htmlLink && (
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-spectral hover:underline">
                Open original <ExternalLink className="h-3 w-3" aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </p>
          {event.status === "past_pending_review" && (
            <div className="mt-3">
              <p className="mb-2 text-sm text-fg-2">This event has ended. Did you miss it?</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={busy === "not_missed"} onClick={() => void decide("not_missed")}>
                  I was there
                </Button>
                <Button size="sm" variant="danger" loading={busy === "confirmed_missed"} onClick={() => void decide("confirmed_missed")}>
                  I missed it
                </Button>
              </div>
            </div>
          )}
          {(event.status === "confirmed_missed" || event.status === "not_missed") && (
            <Button size="sm" variant="link" className="mt-1 h-auto" onClick={() => void decide(event.status === "confirmed_missed" ? "not_missed" : "confirmed_missed")}>
              Change my answer
            </Button>
          )}
          {err && <p role="alert" className="mt-2 text-[13px] text-danger">{err}</p>}
        </div>
      </div>
    </li>
  );
}
