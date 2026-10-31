/**
 * Tiny typed event bus. Application events (a ghost awakened, a task was completed…) are emitted
 * once, after the real state change; animation and sound both subscribe, so neither invents events.
 */
export type AppEvent =
  | { type: "ghost.awakened"; taskId: string; eventId: string }
  | { type: "ghost.interacted"; taskId: string }
  | { type: "task.completed"; taskId: string }
  | { type: "task.released"; taskId: string }
  | { type: "task.rescheduled"; taskId: string }
  | { type: "review.opened"; reviewId: string; auto: boolean };

type Listener = (e: AppEvent) => void;

export function createBus() {
  const listeners = new Set<Listener>();
  return {
    on(fn: Listener) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    emit(e: AppEvent) {
      for (const fn of [...listeners]) {
        try {
          fn(e);
        } catch {
          /* a failing listener (e.g. audio) must never break the app */
        }
      }
    },
  };
}

export type Bus = ReturnType<typeof createBus>;
