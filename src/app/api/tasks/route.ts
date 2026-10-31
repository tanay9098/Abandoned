import { json, parseJson, queryParam, userRoute } from "@/server/http";
import { createTaskSchema } from "@/features/tasks/validation";
import { createTask, listTasks } from "@/server/services/task.service";
import { decorateTasks } from "@/server/services/haunting.service";
import { serializeTaskView } from "@/server/serializers";
import { badRequest } from "@/server/errors";
import type { TaskFilter, TaskSort } from "@/features/tasks/model";

const FILTERS: TaskFilter[] = ["active", "overdue", "completed", "released", "all"];
const SORTS: TaskSort[] = ["due", "created", "title"];

function dateParam(req: Request, name: string): Date | undefined {
  const v = queryParam(req, name);
  if (!v) return undefined;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw badRequest(`${name} must be an ISO date`);
  return new Date(t);
}

export const GET = userRoute(async ({ req, db, userId, now }) => {
  const filter = (queryParam(req, "status") ?? "all") as TaskFilter;
  const sort = (queryParam(req, "sort") ?? "due") as TaskSort;
  if (!FILTERS.includes(filter)) throw badRequest(`status must be one of ${FILTERS.join(", ")}`);
  if (!SORTS.includes(sort)) throw badRequest(`sort must be one of ${SORTS.join(", ")}`);
  const tasks = await listTasks(db, userId, now, { filter, sort, from: dateParam(req, "from"), to: dateParam(req, "to") });
  const views = await decorateTasks(db, userId, tasks, now);
  return json({ tasks: views.map(serializeTaskView), now: now.toISOString() });
});

export const POST = userRoute(async ({ req, db, userId, now }) => {
  const input = await parseJson(req, createTaskSchema);
  const task = await createTask(db, userId, input, now);
  const [view] = await decorateTasks(db, userId, [task], now);
  return json({ task: serializeTaskView(view!) }, 201);
});
