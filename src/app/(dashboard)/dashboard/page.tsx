"use client";
import Link from "next/link";
import { CalendarDays, Moon, Plus } from "lucide-react";
import { Workspace } from "@/components/layout/AppShell";
import { GhostPanel } from "@/components/ghost/GhostPanel";
import { QuickAdd } from "@/components/task/TaskForm";
import { TaskList } from "@/components/task/TaskList";
import { EventCard } from "@/components/calendar/EventCard";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { greeting, stamp } from "@/lib/client/format";

export default function Today() {
  const ws = useWorkspace();
  const active = ws.tasks.filter((t) => t.status === "pending");
  const upcomingEvents = ws.events.filter((e) => e.status === "upcoming").slice(0, 3);
  const awaiting = ws.events.filter((e) => e.status === "past_pending_review").length;

  return (
    <Workspace
      eyebrow={stamp(ws.nowMs, ws.tz, false)}
      title={greeting(ws.nowMs, ws.tz)}
      aside={<GhostPanel />}
      actions={
        <Button variant="primary" onClick={() => ws.openDialog({ type: "create" })}>
          <Plus className="h-4 w-4" aria-hidden /> New task
        </Button>
      }
    >
      {ws.review?.pending && ws.prefs?.midnightPresentation === "banner" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-spectral-soft/40 bg-spectral-surface/50 px-4 py-3" role="status">
          <p className="flex items-center gap-2 text-sm"><Moon className="h-4 w-4 text-spectral" aria-hidden /> The day has changed. Your midnight review is ready.</p>
          <Button size="sm" onClick={() => ws.openReview(false)}>Open review</Button>
        </div>
      )}

      <QuickAdd />

      <h2 className="sr-only">Today’s tasks</h2>
      {active.length === 0 ? (
        <StateBlock title="Nothing is waiting." icon={<Moon className="h-6 w-6" aria-hidden />}>
          Add a task above. Anything with a deadline will be watched for you, even when this tab is closed.
        </StateBlock>
      ) : (
        <TaskList tasks={active} hide={["upcoming", "resolved"]} />
      )}
      {active.some((t) => t.dueAt && !ws.isTaskOverdue(t)) && (
        <p className="text-sm text-fg-2">
          More on the <Link href="/tasks" className="text-spectral underline">Upcoming</Link> page.
        </p>
      )}

      <section aria-labelledby="cal-h" className="space-y-2.5 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <h2 id="cal-h" className="meta flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" aria-hidden /> From your calendar</h2>
          <Link href="/calendar" className="text-sm text-spectral hover:underline">Open calendar</Link>
        </div>
        {!ws.connection?.connected ? (
          <p className="text-sm text-fg-2">Calendar not connected. <Link href="/calendar" className="text-spectral underline">Connect Google Calendar</Link> to see events beside your tasks.</p>
        ) : (
          <>
            {awaiting > 0 && (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-fg-2" role="status">
                {awaiting} past event{awaiting > 1 ? "s are" : " is"} waiting for your review — <Link href="/calendar" className="text-spectral underline">tell us if you were there</Link>.
              </p>
            )}
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-fg-2">No upcoming events in the next month.</p>
            ) : (
              <ul className="space-y-2">{upcomingEvents.map((e) => <EventCard key={e.id} event={e} demo={!!ws.connection?.isDemo} />)}</ul>
            )}
          </>
        )}
      </section>
    </Workspace>
  );
}
