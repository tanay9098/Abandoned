"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { TaskFormDialog } from "./TaskForm";
import { addDaysToDate, localDateOf, localDateTimeToInstant } from "@/lib/datetime/zone";
import { ApiError } from "@/lib/client/api";
import type { TaskDTO } from "@/lib/client/types";

export function DialogHost() {
  const ws = useWorkspace();
  const d = ws.dialog;
  const close = () => ws.openDialog(null);
  return (
    <>
      <TaskFormDialog key={d?.type === "edit" ? `edit-${d.task.id}-${d.task.version}` : "create"} task={d?.type === "edit" ? d.task : undefined} open={d?.type === "create" || d?.type === "edit"} onOpenChange={(o) => !o && close()} />
      {d?.type === "reschedule" && <RescheduleDialog key={d.task.id} task={d.task} onClose={close} />}
      {d?.type === "release" && <ConfirmDialog task={d.task} kind="release" onClose={close} />}
      {d?.type === "delete" && <ConfirmDialog task={d.task} kind="delete" onClose={close} />}
    </>
  );
}

function RescheduleDialog({ task, onClose }: { task: TaskDTO; onClose: () => void }) {
  const ws = useWorkspace();
  const today = localDateOf(ws.nowMs, ws.tz);
  const [date, setDate] = useState(addDaysToDate(today, 1));
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const presets = [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "Next week", days: 7 },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return setError("Choose a new date.");
    const when = localDateTimeToInstant(date, time || "23:59", ws.tz);
    if (when <= Date.now()) return setError("Pick a time in the future so the ghost can rest.");
    setBusy(true);
    setError(null);
    try {
      await ws.updateTask(task.id, {
        dueDate: date,
        dueTime: time || null,
        dueTimezone: ws.tz,
        ...(task.status !== "pending" ? { status: "pending" as const } : {}),
        expectedVersion: task.version,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reschedule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Reschedule</DialogTitle>
        <DialogDescription>
          “{task.title}” — choose when it should come due again. The earlier haunting stays in your history.
        </DialogDescription>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button key={p.label} type="button" size="sm" onClick={() => setDate(addDaysToDate(today, p.days))}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rs-date">New date</Label>
              <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
            </div>
            <div>
              <Label htmlFor="rs-time">Time</Label>
              <Input id="rs-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <p className="text-[13px] text-muted">Time zone: {ws.tz}</p>
          <FieldError>{error}</FieldError>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Reschedule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ task, kind, onClose }: { task: TaskDTO; kind: "release" | "delete"; onClose: () => void }) {
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const release = kind === "release";

  async function confirm() {
    setBusy(true);
    try {
      if (release) await ws.releaseTask(task);
      else await ws.deleteTask(task);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work.");
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{release ? "Release this commitment?" : "Delete this task?"}</DialogTitle>
        <DialogDescription>
          {release
            ? `“${task.title}” will be set down on purpose. It stops counting as overdue and rests in the graveyard, where you can reopen it later. Nothing is deleted.`
            : `“${task.title}” will be removed permanently. Its haunting history is kept in the graveyard. This cannot be undone.`}
        </DialogDescription>
        <FieldError>{error}</FieldError>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} autoFocus>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void confirm()}>
            {release ? "Release" : "Delete permanently"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
