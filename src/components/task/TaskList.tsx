"use client";
import { useMemo } from "react";
import { groupTask, type TimeGroup } from "@/features/tasks/model";
import { addDaysToDate, localDateOf } from "@/lib/datetime/zone";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { TaskRow } from "./TaskRow";
import type { TaskDTO } from "@/lib/client/types";

const ORDER: TimeGroup[] = ["overdue", "today", "tomorrow", "upcoming", "someday", "resolved"];
const LABEL: Record<TimeGroup, string> = {
  overdue: "Haunted · overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  upcoming: "Later",
  someday: "No deadline",
  resolved: "Resolved",
};

/** Groups tasks by meaningful time ranges in the user's zone (Design §5). */
export function TaskList({ tasks, hide = [] }: { tasks: TaskDTO[]; hide?: TimeGroup[] }) {
  const ws = useWorkspace();
  const groups = useMemo(() => {
    const today = localDateOf(ws.nowMs, ws.tz);
    const tomorrow = addDaysToDate(today, 1);
    const map = new Map<TimeGroup, TaskDTO[]>();
    for (const t of tasks) {
      const g = groupTask(t, ws.nowMs, (ms) => localDateOf(ms, ws.tz), today, tomorrow);
      if (hide.includes(g)) continue;
      map.set(g, [...(map.get(g) ?? []), t]);
    }
    return ORDER.filter((g) => map.has(g)).map((g) => ({ key: g, items: map.get(g)! }));
  }, [tasks, ws.nowMs, ws.tz, hide]);

  return (
    <div className="space-y-7">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`grp-${g.key}`}>
          <h2 id={`grp-${g.key}`} className="meta mb-2.5 flex items-center gap-2">
            {LABEL[g.key]} <span aria-label={`${g.items.length} tasks`} className="text-muted">· {g.items.length}</span>
          </h2>
          <ul className="space-y-2">
            {g.items.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
