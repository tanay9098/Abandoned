"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Workspace } from "@/components/layout/AppShell";
import { GhostPanel } from "@/components/ghost/GhostPanel";
import { TaskRow } from "@/components/task/TaskRow";
import { StateBlock, Skeleton } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { api, ApiError } from "@/lib/client/api";
import { caseNumber, stamp } from "@/lib/client/format";
import type { GhostEventDTO } from "@/lib/client/types";

const LABEL: Record<string, string> = {
  deadline_missed: "Deadline passed — ghost awakened",
  task_completed: "Completed",
  task_released: "Released on purpose",
  task_rescheduled: "Rescheduled",
};

/** Haunted task detail: the dedicated page for the ghost on mobile, and the case file on desktop. */
export default function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ws = useWorkspace();
  const task = ws.tasks.find((t) => t.id === id);
  const [history, setHistory] = useState<GhostEventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = task?.version;

  useEffect(() => {
    let live = true;
    api<{ history: GhostEventDTO[] }>(`/api/tasks/${id}`)
      .then((r) => live && setHistory(r.history))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Could not load history."));
    return () => {
      live = false;
    };
  }, [id, version, ws.tasks.length]);

  if (!task && ws.ready) {
    return (
      <StateBlock tone="error" title="That task isn’t in your archive." action={<Link href="/tasks" className="text-spectral underline">Back to tasks</Link>}>
        It may have been deleted. Its haunting history remains in the graveyard.
      </StateBlock>
    );
  }
  if (!task) return <Skeleton className="h-40 w-full" />;

  return (
    <Workspace eyebrow={caseNumber(task.id)} title={task.title} aside={<GhostPanel taskId={task.id} />}>
      <Link href="/tasks" className="-mt-3 inline-flex items-center gap-1 text-sm text-fg-2 hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden /> All tasks</Link>
      <ul><TaskRow task={task} /></ul>
      {task.description && <p className="whitespace-pre-wrap text-[15px] text-fg-2">{task.description}</p>}

      <div className="xl:hidden"><GhostPanel taskId={task.id} /></div>

      <section aria-labelledby="hist-h" className="space-y-3">
        <h2 id="hist-h" className="meta">SIGHTING LOG</h2>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : history === null ? <Skeleton className="h-16 w-full" /> : history.length === 0 ? (
          <p className="text-sm text-fg-2">Nothing has happened to this task yet.</p>
        ) : (
          <ol className="space-y-2 border-l border-border pl-4">
            {history.map((e) => (
              <li key={e.id}>
                <p className="meta">{stamp(e.occurredAt, ws.tz)}</p>
                <p className="text-sm">{LABEL[e.eventType] ?? e.eventType}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Workspace>
  );
}
