"use client";
import { useEffect, useState } from "react";
import { Check, Feather, Ghost, CalendarClock, Moon, CalendarCheck } from "lucide-react";
import { Workspace } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton, StateBlock } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ApiError } from "@/lib/client/api";
import { stamp } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import type { GhostEventDTO } from "@/lib/client/types";

type View = "all" | "hauntings" | "resolved" | "released";
const VIEWS: [View, string][] = [["all", "All"], ["hauntings", "Hauntings"], ["resolved", "Resolved"], ["released", "Released"]];

function describe(e: GhostEventDTO): { icon: React.ReactNode; text: string; sub?: string } {
  const title = typeof e.payload.title === "string" ? e.payload.title : "A task";
  switch (e.eventType) {
    case "deadline_missed":
      return { icon: <Ghost className="h-4 w-4 text-spectral" aria-hidden />, text: title, sub: "Deadline passed. A ghost awakened." };
    case "task_completed":
      return { icon: <Check className="h-4 w-4 text-success" aria-hidden />, text: title, sub: "Completed." };
    case "task_released":
      return { icon: <Feather className="h-4 w-4 text-muted" aria-hidden />, text: title, sub: "Released on purpose." };
    case "task_rescheduled":
      return { icon: <CalendarClock className="h-4 w-4 text-warning" aria-hidden />, text: title, sub: "Rescheduled. The ghost rests." };
    case "midnight_review": {
      const n = (e.payload.counts as { overdueTasks?: number } | undefined)?.overdueTasks ?? 0;
      return { icon: <Moon className="h-4 w-4 text-spectral" aria-hidden />, text: `Midnight review · ${String(e.payload.localDate ?? "")}`, sub: `${n} unfinished task${n === 1 ? "" : "s"} followed the day change.` };
    }
    case "event_review":
      return { icon: <CalendarCheck className="h-4 w-4 text-fg-2" aria-hidden />, text: title, sub: e.payload.decision === "confirmed_missed" ? "You confirmed you missed this event." : "You said you attended this event." };
  }
}

export default function Graveyard() {
  const ws = useWorkspace();
  const [view, setView] = useState<View>("all");
  const [events, setEvents] = useState<GhostEventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const types = { all: undefined, hauntings: ["deadline_missed", "midnight_review"], resolved: ["task_completed", "task_rescheduled", "event_review"], released: ["task_released"] }[view];
    ws.loadHistory(types)
      .then((r) => live && (setEvents(r), setError(null)))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Could not read the sighting log."));
    return () => {
      live = false;
    };
  }, [view, ws.tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Workspace
      eyebrow="SIGHTING LOG"
      title="Graveyard"
      actions={ws.review?.review ? <Button onClick={() => ws.openReview(false)}><Moon className="h-4 w-4" aria-hidden /> Replay latest midnight review</Button> : undefined}
    >
      <p className="max-w-prose text-sm text-fg-2">Every haunting and how it ended. Rescheduling or releasing a task never erases its history.</p>
      <div role="group" aria-label="Filter history" className="flex flex-wrap gap-1.5">
        {VIEWS.map(([k, l]) => (
          <button key={k} aria-pressed={view === k} onClick={() => setView(k)} className={cn("h-9 rounded-md border px-3 text-sm font-medium", view === k ? "border-spectral-soft bg-spectral-surface text-spectral" : "border-border text-fg-2 hover:bg-hover hover:text-fg")}>
            {l}
          </button>
        ))}
      </div>
      {error ? (
        <StateBlock tone="error" title="The log is unreadable right now.">{error}</StateBlock>
      ) : events === null ? (
        <div className="space-y-2" role="status" aria-label="Loading history"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : events.length === 0 ? (
        <StateBlock title="The graveyard is quiet." icon={<Ghost className="h-6 w-6" aria-hidden />}>Hauntings and their resolutions will be recorded here.</StateBlock>
      ) : (
        <ol className="space-y-2" data-testid="history">
          {events.map((e) => {
            const d = describe(e);
            return (
              <li key={e.id} className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3.5 py-3">
                <span className="mt-0.5">{d.icon}</span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{d.text}</p>
                  <p className="text-sm text-fg-2">{d.sub}</p>
                  <p className="meta mt-1">{stamp(e.occurredAt, ws.tz)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Workspace>
  );
}
