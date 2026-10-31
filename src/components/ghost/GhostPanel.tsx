"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Check, Ear, Feather, Ghost as GhostIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GhostCharacter } from "./GhostCharacter";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { caseNumber, overdueLabel, stamp } from "@/lib/client/format";
import { resolvedDialogue } from "@/features/hauntings/dialogue";
import type { GhostVisualState } from "@/features/hauntings/model";
import type { TaskDTO } from "@/lib/client/types";

/** The contextual panel: current sighting, short monologue, overdue duration, primary + secondary actions. */
export function GhostPanel({ taskId }: { taskId?: string }) {
  const ws = useWorkspace();
  const id = taskId ?? ws.selectedId;
  const task = ws.tasks.find((t) => t.id === id) ?? null;
  const others = ws.hauntedTasks.filter((t) => t.id !== task?.id);
  const reduced = !!ws.prefs?.reducedMotion;

  // A just-resolved ghost plays its exit (completed / released / rescheduled) before the next appears.
  if (ws.fx && (!taskId || ws.fx.taskId === taskId)) {
    const state: GhostVisualState = ws.fx.kind === "completed" ? "completed" : ws.fx.kind === "released" ? "released" : "rescheduled";
    return (
      <section aria-label="Current sighting" className="rounded-lg border border-border bg-surface p-5">
        <p className="meta">SIGHTING RESOLVED</p>
        <div className="my-4 flex justify-center">
          <GhostCharacter state={state} size={110} reducedMotion={reduced} />
        </div>
        <p className="ghost-voice text-center">{resolvedDialogue(ws.fx.kind)}</p>
        <p className="mt-2 text-center text-sm text-fg-2">{ws.fx.title}</p>
      </section>
    );
  }

  if (!task || !task.haunting || !ws.isTaskOverdue(task)) {
    return (
      <section aria-label="Current sighting" className="rounded-lg border border-border bg-surface p-5">
        <p className="meta">CURRENT SIGHTING</p>
        <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
          <GhostIcon className="h-6 w-6 text-spectral-soft" aria-hidden />
          <p className="text-[15px] font-semibold">No ghosts tonight.</p>
          <p className="max-w-[26ch] text-sm text-fg-2">When a deadline passes with the task unfinished, it will appear here.</p>
        </div>
      </section>
    );
  }

  return <Sighting key={task.id} task={task} others={others} />;
}

function Sighting({ task, others }: { task: TaskDTO; others: TaskDTO[] }) {
  const ws = useWorkspace();
  const h = task.haunting!;
  const [phase, setPhase] = useState<"awakening" | "idle" | "confrontation">(h.acknowledged ? "idle" : "awakening");
  const [line, setLine] = useState(h.dialogue);
  const [busy, setBusy] = useState(false);
  const dueMs = Date.parse(task.dueAt!);

  useEffect(() => {
    if (phase !== "awakening") return;
    const t = setTimeout(() => setPhase("idle"), 900);
    return () => clearTimeout(t);
  }, [phase]);

  async function listen() {
    setBusy(true);
    setPhase("confrontation");
    await ws.acknowledge(task);
    if (ws.prefs?.aiDialogueEnabled) {
      const text = await ws.fetchDialogue(task);
      if (text) setLine(text);
    }
    setBusy(false);
  }

  const visual: GhostVisualState = phase;
  const overdueMs = Math.max(0, ws.nowMs - dueMs);

  return (
    <section aria-label="Current sighting" className="rounded-lg border border-spectral-soft/40 bg-spectral-surface/40 p-5" data-testid="ghost-panel">
      <div className="flex items-center justify-between">
        <p className="meta">CURRENT SIGHTING</p>
        <p className="meta">{caseNumber(task.id)}</p>
      </div>
      <div className="my-3 flex justify-center">
        <GhostCharacter state={visual} size={104} reducedMotion={!!ws.prefs?.reducedMotion} />
      </div>
      <p className="sr-only">Ghost status: {task.ghostState}.</p>
      <h3 className="text-center text-[17px] font-semibold leading-snug">
        <Link href={`/tasks/${task.id}`} className="hover:underline">
          {task.title}
        </Link>
      </h3>
      <p className="meta mt-1 text-center !text-spectral">{overdueLabel(overdueMs)}</p>
      <p className="meta mt-0.5 text-center">DUE {stamp(task.dueAt!, ws.tz)}</p>

      <blockquote className="ghost-voice my-5 text-center" data-testid="ghost-line">
        “{line}”
      </blockquote>

      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={() => void ws.completeTask(task)}>
          <Check className="h-4 w-4" aria-hidden /> Mark complete
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => ws.openDialog({ type: "reschedule", task })}>
            <CalendarClock className="h-4 w-4" aria-hidden /> Reschedule
          </Button>
          <Button variant="danger" onClick={() => ws.openDialog({ type: "release", task })}>
            <Feather className="h-4 w-4" aria-hidden /> Release
          </Button>
        </div>
        {!h.acknowledged && (
          <Button variant="ghost" loading={busy} onClick={() => void listen()}>
            <Ear className="h-4 w-4" aria-hidden /> Hear it out
          </Button>
        )}
      </div>

      {others.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="meta mb-2">{others.length} OTHER SIGHTING{others.length > 1 ? "S" : ""}</p>
          <ul className="space-y-1">
            {others.slice(0, 5).map((o) => (
              <li key={o.id}>
                <button className="w-full truncate rounded px-2 py-1.5 text-left text-sm text-fg-2 hover:bg-hover hover:text-fg" onClick={() => ws.select(o.id)}>
                  {o.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
