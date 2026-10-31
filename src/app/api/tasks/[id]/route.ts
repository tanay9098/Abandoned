import { json, parseJson, userRoute } from "@/server/http";
import { patchTaskSchema } from "@/features/tasks/validation";
import { deleteTask, getTask, updateTask } from "@/server/services/task.service";
import { decorateTasks } from "@/server/services/haunting.service";
import { serializeTaskView } from "@/server/serializers";
import { listHauntings } from "@/server/services/haunting.service";
import { serializeGhostEvent } from "@/server/serializers";
import { badRequest } from "@/server/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOf = (p: { id: string }) => {
  if (!UUID.test(p.id)) throw badRequest("Invalid task id");
  return p.id;
};

export const GET = userRoute<{ id: string }>(async ({ db, userId, now, params }) => {
  const task = await getTask(db, userId, idOf(params));
  const [view] = await decorateTasks(db, userId, [task], now);
  const history = await listHauntings(db, userId, { taskId: task.id, limit: 50 });
  return json({ task: serializeTaskView(view!), history: history.map(serializeGhostEvent) });
});

export const PATCH = userRoute<{ id: string }>(async ({ req, db, userId, now, params }) => {
  const patch = await parseJson(req, patchTaskSchema);
  const { task, nextTask } = await updateTask(db, userId, idOf(params), patch, now);
  const views = await decorateTasks(db, userId, nextTask ? [task, nextTask] : [task], now);
  return json({ task: serializeTaskView(views[0]!), nextTask: views[1] ? serializeTaskView(views[1]) : null });
});

export const DELETE = userRoute<{ id: string }>(async ({ db, userId, params }) => {
  await deleteTask(db, userId, idOf(params));
  return json({ ok: true });
});
