"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Workspace } from "@/components/layout/AppShell";
import { GhostPanel } from "@/components/ghost/GhostPanel";
import { TaskList } from "@/components/task/TaskList";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { StateBlock } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { matchesFilter, type TaskFilter, type TaskSort } from "@/features/tasks/model";
import { cn } from "@/lib/utils";

const FILTERS: [TaskFilter, string][] = [["active", "Active"], ["overdue", "Overdue"], ["completed", "Completed"], ["released", "Released"], ["all", "All"]];

export default function Upcoming() {
  const ws = useWorkspace();
  const [filter, setFilter] = useState<TaskFilter>("active");
  const [sort, setSort] = useState<TaskSort>("due");

  const tasks = ws.tasks
    .filter((t) => matchesFilter(t, filter, ws.nowMs))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity);
    });

  return (
    <Workspace
      eyebrow="ALL COMMITMENTS"
      title="Upcoming"
      aside={<GhostPanel />}
      actions={<Button variant="primary" onClick={() => ws.openDialog({ type: "create" })}><Plus className="h-4 w-4" aria-hidden /> New task</Button>}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="group" aria-label="Filter tasks" className="flex flex-wrap gap-1.5">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn("h-9 rounded-md border px-3 text-sm font-medium transition-colors duration-150", filter === key ? "border-spectral-soft bg-spectral-surface text-spectral" : "border-border text-fg-2 hover:bg-hover hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <Label htmlFor="sort" className="meta !mb-1">Sort by</Label>
          <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)} className="w-[170px]">
            <option value="due">Deadline</option>
            <option value="created">Newest</option>
            <option value="title">Title</option>
          </Select>
        </div>
      </div>
      {tasks.length === 0 ? (
        <StateBlock title="No tasks match this view.">Try another filter, or add a task.</StateBlock>
      ) : (
        <TaskList tasks={tasks} />
      )}
    </Workspace>
  );
}
