"use client";
import Link from "next/link";
import { CalendarClock, Feather, Ghost, Pencil, Repeat, RotateCcw, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { overdueLabel, stamp } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import type { TaskDTO } from "@/lib/client/types";

export function TaskRow({ task }: { task: TaskDTO }) {
  const ws = useWorkspace();
  const overdue = ws.isTaskOverdue(task);
  const haunted = overdue && !!task.haunting;
  const done = task.status === "completed";
  const released = task.status === "released";
  const dueMs = task.dueAt ? Date.parse(task.dueAt) : null;
  const err = (e: unknown) => ws.announce(e instanceof Error ? e.message : "That did not work.");

  return (
    <li
      data-testid="task-row"
      data-task-title={task.title}
      data-overdue={overdue || undefined}
      className={cn(
        "group flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border px-3.5 py-3 transition-colors duration-150 sm:flex-nowrap",
        overdue ? "border-border border-l-2 border-l-spectral-soft bg-[#111218]" : "border-border bg-surface",
        (done || released) && "opacity-70",
        ws.selectedId === task.id && haunted && "ring-1 ring-spectral-soft/60",
      )}
    >
      <div className="pt-0.5">
        {released ? (
          <Feather className="mt-0.5 h-5 w-5 text-muted" aria-label="Released" />
        ) : (
          <Checkbox
            aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} complete`}
            checked={done}
            onCheckedChange={(c) => void (c ? ws.completeTask(task) : ws.reopenTask(task)).catch(err)}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 basis-[calc(100%-48px)] sm:basis-auto">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/tasks/${task.id}`} className={cn("text-[15.5px] font-semibold leading-snug hover:underline", (done || released) && "text-fg-2 line-through decoration-1")}>
            {task.title}
          </Link>
          {released && <Badge>Released</Badge>}
          {done && <Badge tone="success">Completed</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {dueMs !== null && !done && !released && (
            <span className="meta">{overdue ? "WAS DUE" : "DUE"} {stamp(dueMs, ws.tz)}</span>
          )}
          {done && task.completedAt && <span className="meta">COMPLETED {stamp(task.completedAt, ws.tz)}</span>}
          {released && task.releasedAt && <span className="meta">RELEASED {stamp(task.releasedAt, ws.tz)}</span>}
          {dueMs === null && task.status === "pending" && <span className="meta">NO DEADLINE</span>}
          {overdue && (
            <span className="meta inline-flex items-center gap-1 !text-spectral" data-testid="overdue-meta">
              <Ghost className="h-3.5 w-3.5" aria-hidden /> {overdueLabel(ws.nowMs - dueMs!)}
            </span>
          )}
          {task.recurrence && (
            <span className="meta inline-flex items-center gap-1">
              <Repeat className="h-3 w-3" aria-hidden /> {task.recurrence}
            </span>
          )}
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center justify-end gap-0.5 border-t border-border/60 pt-2 sm:w-auto sm:border-0 sm:pt-0">
        {haunted && (
          <>
            <Button variant="secondary" size="sm" className="mr-1 hidden xl:inline-flex" onClick={() => ws.select(task.id)} aria-label={`Inspect haunting: ${task.title}`}>
              <Ghost className="h-4 w-4 text-spectral" aria-hidden /> Inspect
            </Button>
            <Button asChild variant="secondary" size="sm" className="mr-1 xl:hidden">
              <Link href={`/tasks/${task.id}`} aria-label={`Inspect haunting: ${task.title}`}>
                <Ghost className="h-4 w-4 text-spectral" aria-hidden /> Inspect
              </Link>
            </Button>
          </>
        )}
        {task.status === "pending" && (
          <Button variant="ghost" size="icon-sm" aria-label={`Reschedule ${task.title}`} onClick={() => ws.openDialog({ type: "reschedule", task })}>
            <CalendarClock className="h-4 w-4" aria-hidden />
          </Button>
        )}
        {task.status === "released" || done ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Reopen ${task.title}`} onClick={() => void ws.reopenTask(task).catch(err)}>
            <RotateCcw className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={`Release ${task.title}`} onClick={() => ws.openDialog({ type: "release", task })}>
            <Feather className="h-4 w-4" aria-hidden />
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${task.title}`} onClick={() => ws.openDialog({ type: "edit", task })}>
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${task.title}`} onClick={() => ws.openDialog({ type: "delete", task })}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
