"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace, type TaskPatch } from "@/components/workspace/WorkspaceProvider";
import { ApiError } from "@/lib/client/api";
import { addDaysToDate, getZonedParts, localDateOf } from "@/lib/datetime/zone";
import type { TaskDTO } from "@/lib/client/types";

const p2 = (n: number) => String(n).padStart(2, "0");

/** Split a stored deadline back into the date/time the user typed. A 00:00 deadline is "end of the previous day". */
export function splitDeadline(dueAt: string | null, tz: string): { date: string; time: string } {
  if (!dueAt) return { date: "", time: "" };
  const ms = Date.parse(dueAt);
  const p = getZonedParts(ms, tz);
  if (p.hour === 0 && p.minute === 0 && p.second === 0) return { date: addDaysToDate(localDateOf(ms, tz), -1), time: "" };
  return { date: localDateOf(ms, tz), time: `${p2(p.hour)}:${p2(p.minute)}` };
}

export function TaskFormDialog({ task, open, onOpenChange }: { task?: TaskDTO; open: boolean; onOpenChange: (o: boolean) => void }) {
  const ws = useWorkspace();
  const initial = splitDeadline(task?.dueAt ?? null, task?.dueTimezone ?? ws.tz);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [recurrence, setRecurrence] = useState<string>(task?.recurrence ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give the task a title.";
    if (time && !date) next.date = "Choose a date for that time.";
    if (recurrence && !date) next.recurrence = "A repeating task needs a deadline.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setFormError(null);
    const body: TaskPatch = {
      title: title.trim(),
      description: description.trim() || null,
      recurrence: (recurrence || null) as TaskPatch["recurrence"],
    };
    if (date) {
      body.dueDate = date;
      body.dueTime = time || null;
      body.dueTimezone = ws.tz;
    } else if (task?.dueAt) {
      body.dueDate = null; // explicit: clear the deadline
    }
    try {
      if (task) await ws.updateTask(task.id, { ...body, expectedVersion: task.version });
      else await ws.createTask(body as TaskPatch & { title: string });
      onOpenChange(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save the task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription>Deadlines use your time zone: {ws.tz}.</DialogDescription>
        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <div>
            <Label htmlFor="tf-title">Title</Label>
            <Input id="tf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={!!errors.title} aria-describedby={errors.title ? "tf-title-err" : undefined} autoFocus />
            <FieldError id="tf-title-err">{errors.title}</FieldError>
          </div>
          <div>
            <Label htmlFor="tf-desc">Description (optional)</Label>
            <Textarea id="tf-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tf-date">Due date</Label>
              <Input id="tf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date ? "tf-date-err" : undefined} />
            </div>
            <div>
              <Label htmlFor="tf-time">Due time (optional)</Label>
              <Input id="tf-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <FieldError id="tf-date-err">{errors.date}</FieldError>
          <p className="-mt-2 text-[13px] text-muted">No time means the end of that day. Leave the date empty for a task without a deadline — it will never go overdue.</p>
          <div>
            <Label htmlFor="tf-rec">Repeat</Label>
            <Select id="tf-rec" value={recurrence} onChange={(e) => setRecurrence(e.target.value)} aria-invalid={!!errors.recurrence}>
              <option value="">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
            <FieldError>{errors.recurrence}</FieldError>
          </div>
          <FieldError>{formError}</FieldError>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              {task ? "Save changes" : "Add task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Compact inline capture on the dashboard (title + optional deadline). */
export function QuickAdd() {
  const ws = useWorkspace();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the task a title.");
    if (time && !date) return setError("Choose a date for that time.");
    setBusy(true);
    setError(null);
    try {
      await ws.createTask({ title: title.trim(), ...(date ? { dueDate: date, dueTime: time || null, dueTimezone: ws.tz } : {}) });
      setTitle("");
      setDate("");
      setTime("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-3" aria-label="Add a task" noValidate>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="qa-title" className="meta !mb-1">New task</Label>
          <Input id="qa-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" maxLength={200} />
        </div>
        <div>
          <Label htmlFor="qa-date" className="meta !mb-1">Due date</Label>
          <Input id="qa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px]" />
        </div>
        <div>
          <Label htmlFor="qa-time" className="meta !mb-1">Time</Label>
          <Input id="qa-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[120px]" />
        </div>
        <Button type="submit" variant="primary" loading={busy}>
          <Plus className="h-4 w-4" aria-hidden /> Add task
        </Button>
        <Button type="button" variant="ghost" onClick={() => ws.openDialog({ type: "create" })}>
          More options
        </Button>
      </div>
      <FieldError>{error}</FieldError>
    </form>
  );
}
