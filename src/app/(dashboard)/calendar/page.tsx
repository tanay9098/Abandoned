"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, RefreshCw, Unplug } from "lucide-react";
import { Workspace } from "@/components/layout/AppShell";
import { EventCard } from "@/components/calendar/EventCard";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton, StateBlock } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { ApiError } from "@/lib/client/api";
import { stamp } from "@/lib/client/format";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "Calendar access was not granted. Nothing was connected.",
  oauth_state_missing: "The authorisation session was not found. Please start again.",
  oauth_state_expired: "The authorisation session expired. Please start again.",
  oauth_state_mismatch: "The authorisation could not be verified. Please start again.",
  oauth_user_mismatch: "That authorisation belonged to a different session.",
  oauth_exchange_failed: "Google rejected the authorisation. Please try again.",
  oauth_scope_missing: "The read-only Calendar permission was not granted, so nothing was connected.",
  calendar_unavailable: "Google could not be reached. Your tasks are unaffected.",
};

function CalendarInner() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const c = ws.connection;
  const qErr = params.get("error");
  const justConnected = params.get("connected") === "1";

  useEffect(() => {
    if (justConnected || qErr) void ws.refreshCalendar();
  }, [justConnected, qErr]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(kind: "connect" | "sync" | "disconnect", fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const awaiting = ws.events.filter((e) => e.status === "past_pending_review");
  const upcoming = ws.events.filter((e) => e.status === "upcoming");
  const reviewed = ws.events.filter((e) => ["confirmed_missed", "not_missed", "cancelled"].includes(e.status));
  const sourceName = c?.isDemo ? "Demo calendar (sample data)" : "Google Calendar";

  return (
    <Workspace eyebrow="EXTERNAL EVENTS · READ-ONLY" title="Calendar">
      {qErr && <p role="alert" className="rounded-lg border border-[#5a2f35] px-4 py-3 text-sm text-danger">{OAUTH_ERRORS[qErr] ?? "The connection did not complete."}</p>}
      {justConnected && !qErr && <p role="status" className="rounded-lg border border-[#3b5240] px-4 py-3 text-sm text-success">Connected. Events were imported read-only.</p>}

      <section aria-label="Connection" className="rounded-lg border border-border bg-surface p-4">
        {!c ? (
          <Skeleton className="h-16" />
        ) : c.mode === "unconfigured" && !c.connected ? (
          <StateBlock title="Google Calendar isn’t configured on this server.">The rest of Abandonment works normally. See the README for the Google OAuth settings.</StateBlock>
        ) : c.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold">{sourceName} <Badge tone="success">Connected</Badge></p>
              <p className="meta mt-1">{c.lastSyncedAt ? `LAST SYNC ${stamp(c.lastSyncedAt, ws.tz)}` : "NOT SYNCED YET"} · READ-ONLY ACCESS</p>
            </div>
            <div className="flex gap-2">
              <Button loading={busy === "sync"} onClick={() => void run("sync", ws.syncCalendar)}><RefreshCw className="h-4 w-4" aria-hidden /> Sync now</Button>
              <Button variant="danger" onClick={() => setConfirm(true)}><Unplug className="h-4 w-4" aria-hidden /> Disconnect</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Bring your events into the archive</p>
              <p className="mt-1 max-w-prose text-sm text-fg-2">
                {c.mode === "mock"
                  ? "No Google credentials are configured, so this connects a clearly-labelled demo calendar with sample events."
                  : "Abandonment asks for read-only access to your events. It can never create, edit or delete anything in Google Calendar."}
              </p>
            </div>
            <Button variant="primary" loading={busy === "connect"} onClick={() => void run("connect", ws.connectCalendar)}>
              <CalendarDays className="h-4 w-4" aria-hidden /> {c.mode === "mock" ? "Connect demo calendar" : "Connect Google Calendar"}
            </Button>
          </div>
        )}
        {(error || ws.calendarError) && <p role="alert" className="mt-3 text-sm text-danger">{error ?? ws.calendarError}</p>}
      </section>

      {c?.connected && (
        <>
          <EventSection title="Awaiting your review" hint="These have ended. Abandonment doesn’t assume you missed them — tell it what happened." events={awaiting} demo={c.isDemo} />
          <EventSection title="Upcoming" events={upcoming} demo={c.isDemo} empty="No upcoming events in the next 30 days." />
          <EventSection title="Reviewed & cancelled" events={reviewed} demo={c.isDemo} />
        </>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Disconnect {sourceName}?</DialogTitle>
          <DialogDescription>
            Access is revoked, stored credentials are erased, and imported event copies are removed from Abandonment. Nothing changes in your Google Calendar. Your tasks and haunting history stay.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)} autoFocus>Keep connected</Button>
            <Button variant="danger" loading={busy === "disconnect"} onClick={() => void run("disconnect", async () => { await ws.disconnectCalendar(); setConfirm(false); router.replace("/calendar"); })}>
              Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Workspace>
  );
}

function EventSection({ title, hint, events, demo, empty }: { title: string; hint?: string; events: ReturnType<typeof useWorkspace>["events"]; demo: boolean; empty?: string }) {
  if (events.length === 0 && !empty) return null;
  return (
    <section aria-label={title} className="space-y-2.5">
      <h2 className="meta">{title} · {events.length}</h2>
      {hint && <p className="text-sm text-fg-2">{hint}</p>}
      {events.length === 0 ? <p className="text-sm text-fg-2">{empty}</p> : <ul className="space-y-2">{events.map((e) => <EventCard key={e.id} event={e} demo={demo} />)}</ul>}
    </section>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<Skeleton className="h-32" />}>
      <CalendarInner />
    </Suspense>
  );
}
