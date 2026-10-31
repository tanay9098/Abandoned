"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { createBus, type Bus } from "@/lib/client/bus";
import type { CalendarEventDTO, ConnectionDTO, GhostEventDTO, Preferences, ReviewDTO, TaskDTO } from "@/lib/client/types";
import { isOverdue } from "@/features/tasks/model";
import type { PatchPreferences } from "@/features/preferences/model";
import { useSound } from "@/components/audio/use-sound";

export type FxKind = "completed" | "released" | "rescheduled";
export interface Fx {
  taskId: string;
  title: string;
  kind: FxKind;
}

export type DialogState =
  | null
  | { type: "create" }
  | { type: "edit"; task: TaskDTO }
  | { type: "reschedule"; task: TaskDTO }
  | { type: "release"; task: TaskDTO }
  | { type: "delete"; task: TaskDTO };

export interface TaskPatch {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  dueTimezone?: string | null;
  recurrence?: "daily" | "weekly" | "monthly" | null;
  status?: "pending" | "completed" | "released";
  expectedVersion?: number;
}

interface Workspace {
  ready: boolean;
  loadError: string | null;
  prefs: Preferences | null;
  tasks: TaskDTO[];
  events: CalendarEventDTO[];
  connection: ConnectionDTO | null;
  calendarError: string | null;
  review: ReviewDTO | null;
  reviewOpen: boolean;
  nowMs: number;
  tz: string;
  bus: Bus;
  fx: Fx | null;
  selectedId: string | null;
  select(id: string | null): void;
  dialog: DialogState;
  openDialog(d: DialogState): void;
  announce(message: string): void;
  isTaskOverdue(t: TaskDTO): boolean;
  hauntedTasks: TaskDTO[];
  // task actions
  createTask(input: TaskPatch & { title: string }): Promise<TaskDTO>;
  updateTask(id: string, patch: TaskPatch): Promise<TaskDTO>;
  completeTask(t: TaskDTO): Promise<void>;
  reopenTask(t: TaskDTO): Promise<void>;
  releaseTask(t: TaskDTO): Promise<void>;
  deleteTask(t: TaskDTO): Promise<void>;
  acknowledge(t: TaskDTO): Promise<void>;
  fetchDialogue(t: TaskDTO): Promise<string | null>;
  refresh(): Promise<void>;
  // preferences
  updatePrefs(patch: PatchPreferences): Promise<void>;
  // calendar
  refreshCalendar(): Promise<void>;
  connectCalendar(): Promise<void>;
  syncCalendar(): Promise<void>;
  disconnectCalendar(): Promise<void>;
  reviewEvent(id: string, decision: "confirmed_missed" | "not_missed"): Promise<void>;
  // midnight review
  openReview(auto?: boolean): void;
  closeReview(dismiss: boolean): Promise<void>;
  loadHistory(types?: string[]): Promise<GhostEventDTO[]>;
}

const Ctx = createContext<Workspace | null>(null);
export function useWorkspace(): Workspace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return v;
}

const SEEN_KEY = "abd:announced-hauntings";
function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function writeSeen(s: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200)));
  } catch {
    /* storage unavailable: harmless */
  }
}

export const sortTasks = (a: TaskDTO, b: TaskDTO) =>
  (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) || b.createdAt.localeCompare(a.createdAt);

const POLL_MS = 60_000;
const FX_MS = 1500;

export function WorkspaceProvider({ children, initialTimezone }: { children: React.ReactNode; initialTimezone: string }) {
  const bus = useMemo(() => createBus(), []);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [connection, setConnection] = useState<ConnectionDTO | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewDTO | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [fx, setFx] = useState<Fx | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [live, setLive] = useState("");

  const tz = prefs?.timezone ?? initialTimezone;
  const seen = useRef<Set<string> | null>(null);
  const autoOpened = useRef<Set<string>>(new Set());
  const prefsRef = useRef<Preferences | null>(null);
  const reviewRef = useRef<ReviewDTO | null>(null);
  useEffect(() => {
    prefsRef.current = prefs;
    reviewRef.current = review;
  }, [prefs, review]);

  useSound(bus, prefs, nowMs);

  const announce = useCallback((m: string) => setLive((prev) => (prev === m ? m + "​" : m)), []);

  const onAuthError = useCallback((e: unknown) => {
    // Hard navigation on purpose: an expired session must discard all client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (e instanceof ApiError && e.status === 401) window.location.href = "/login";
  }, []);

  // ---- loaders -----------------------------------------------------------
  const loadTasks = useCallback(async () => {
    const r = await api<{ tasks: TaskDTO[]; now: string }>("/api/tasks?status=all&sort=due");
    setTasks(r.tasks);
    return r.tasks;
  }, []);

  const loadReview = useCallback(async () => {
    const r = await api<ReviewDTO>("/api/hauntings/midnight-review");
    setReview(r);
  }, []);

  const refreshCalendar = useCallback(async () => {
    try {
      const { connection: c } = await api<{ connection: ConnectionDTO }>("/api/calendar/connection");
      setConnection(c);
      if (c.connected) {
        const r = await api<{ events: CalendarEventDTO[] }>("/api/calendar/events");
        setEvents(r.events);
      } else setEvents([]);
      setCalendarError(null);
    } catch (e) {
      onAuthError(e);
      setCalendarError(e instanceof ApiError ? e.message : "Calendar is unavailable right now.");
    }
  }, [onAuthError]);

  /** Server-side reconcile (idempotent), then refresh. Emits at most one awakening cue per pass. */
  const reconcile = useCallback(async () => {
    try {
      await api("/api/hauntings/reconcile", { method: "POST" });
      setNowMs(Date.now());
      const list = await loadTasks();
      await loadReview();
      seen.current ??= readSeen();
      const fresh = list.filter((t) => t.haunting && !t.haunting.acknowledged && !seen.current!.has(t.haunting.eventId));
      if (fresh.length) {
        for (const t of fresh) seen.current.add(t.haunting!.eventId);
        writeSeen(seen.current);
        bus.emit({ type: "ghost.awakened", taskId: fresh[0]!.id, eventId: fresh[0]!.haunting!.eventId });
        announce(fresh.length === 1 ? `A ghost has awakened: ${fresh[0]!.title}` : `${fresh.length} ghosts have awakened.`);
      }
    } catch (e) {
      onAuthError(e);
      throw e;
    }
  }, [announce, bus, loadReview, loadTasks, onAuthError]);

  const refresh = useCallback(async () => {
    await reconcile().catch(() => undefined);
  }, [reconcile]);

  // ---- boot ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api<{ preferences: Preferences }>("/api/preferences");
        if (cancelled) return;
        setPrefs(p.preferences);
        await reconcile();
        if (!cancelled) setReady(true);
        void refreshCalendar();
      } catch (e) {
        onAuthError(e);
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : "The archive could not be opened.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- clock, polling, visibility, next-deadline timer ---------------------------
  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 30_000);
    const poll = setInterval(() => void refresh(), POLL_MS);
    const vis = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [refresh]);

  useEffect(() => {
    // Wake just after the next pending deadline so the ghost appears on time while the tab is open.
    const now = Date.now();
    const next = tasks
      .filter((t) => t.status === "pending" && t.dueAt && Date.parse(t.dueAt) > now)
      .map((t) => Date.parse(t.dueAt!))
      .sort((a, b) => a - b)[0];
    if (!next) return;
    const delay = Math.min(next - now + 800, 2 ** 31 - 1);
    const id = setTimeout(() => {
      setNowMs(Date.now());
      void refresh();
    }, delay);
    return () => clearTimeout(id);
  }, [tasks, refresh]);

  // ---- preferences side effects ----------------------------------------------
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(!!prefs?.reducedMotion);
  }, [prefs?.reducedMotion]);

  // ---- derived -----------------------------------------------------------
  const isTaskOverdue = useCallback((t: TaskDTO) => isOverdue(t, nowMs), [nowMs]);
  const hauntedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.haunting && isOverdue(t, nowMs))
        .sort((a, b) => Number(a.haunting!.acknowledged) - Number(b.haunting!.acknowledged) || Date.parse(a.dueAt!) - Date.parse(b.dueAt!)),
    [tasks, nowMs],
  );
  // Keep the user's pick while it is still a live haunting; otherwise move on to the next sighting.
  const effectiveSelected = hauntedTasks.some((t) => t.id === selectedId) ? selectedId : (hauntedTasks[0]?.id ?? null);

  // ---- task actions ----------------------------------------------------------
  const putTask = useCallback((t: TaskDTO) => setTasks((prev) => [...prev.filter((x) => x.id !== t.id), t].sort(sortTasks)), []);

  const showFx = useCallback((f: Fx) => {
    setFx(f);
    setTimeout(() => setFx((cur) => (cur === f ? null : cur)), prefsRef.current?.reducedMotion ? 700 : FX_MS);
  }, []);

  const patch = useCallback(
    async (id: string, body: TaskPatch) => {
      try {
        const r = await api<{ task: TaskDTO; nextTask: TaskDTO | null }>(`/api/tasks/${id}`, { method: "PATCH", body });
        putTask(r.task);
        if (r.nextTask) putTask(r.nextTask);
        return r.task;
      } catch (e) {
        onAuthError(e);
        if (e instanceof ApiError && e.code === "version_conflict") await loadTasks().catch(() => undefined);
        throw e;
      }
    },
    [loadTasks, onAuthError, putTask],
  );

  const createTask = useCallback(
    async (input: TaskPatch & { title: string }) => {
      const r = await api<{ task: TaskDTO }>("/api/tasks", { method: "POST", body: input });
      putTask(r.task);
      announce(`Task added: ${r.task.title}`);
      // A task created with a past deadline is picked up by the engine immediately.
      if (r.task.dueAt && Date.parse(r.task.dueAt) <= Date.now()) void refresh();
      return r.task;
    },
    [announce, putTask, refresh],
  );

  const completeTask = useCallback(
    async (t: TaskDTO) => {
      const wasHaunted = !!t.haunting;
      await patch(t.id, { status: "completed", expectedVersion: t.version });
      bus.emit({ type: "task.completed", taskId: t.id });
      if (wasHaunted) showFx({ taskId: t.id, title: t.title, kind: "completed" });
      announce(`Completed: ${t.title}`);
    },
    [announce, bus, patch, showFx],
  );

  const reopenTask = useCallback(
    async (t: TaskDTO) => {
      await patch(t.id, { status: "pending", expectedVersion: t.version });
      announce(`Reopened: ${t.title}`);
    },
    [announce, patch],
  );

  const releaseTask = useCallback(
    async (t: TaskDTO) => {
      const wasHaunted = !!t.haunting;
      await patch(t.id, { status: "released", expectedVersion: t.version });
      bus.emit({ type: "task.released", taskId: t.id });
      if (wasHaunted) showFx({ taskId: t.id, title: t.title, kind: "released" });
      announce(`Released: ${t.title}`);
    },
    [announce, bus, patch, showFx],
  );

  const updateTask = useCallback(
    async (id: string, body: TaskPatch) => {
      const before = tasks.find((t) => t.id === id);
      const updated = await patch(id, body);
      const deadlineTouched = body.dueAt !== undefined || body.dueDate !== undefined;
      if (deadlineTouched && before?.haunting && !isOverdue(updated, Date.now())) {
        bus.emit({ type: "task.rescheduled", taskId: id });
        showFx({ taskId: id, title: updated.title, kind: "rescheduled" });
        announce(`Rescheduled: ${updated.title}`);
      } else announce(`Saved: ${updated.title}`);
      return updated;
    },
    [announce, bus, patch, showFx, tasks],
  );

  const deleteTask = useCallback(
    async (t: TaskDTO) => {
      await api(`/api/tasks/${t.id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      announce(`Deleted: ${t.title}`);
    },
    [announce],
  );

  const acknowledge = useCallback(
    async (t: TaskDTO) => {
      if (!t.haunting || t.haunting.acknowledged) return;
      setSelectedId(t.id); // pin: acknowledging re-orders the queue but must not change what the user is looking at
      await api(`/api/hauntings/${t.haunting.eventId}/acknowledge`, { method: "POST" }).catch(() => undefined);
      setTasks((prev) => prev.map((x) => (x.id === t.id && x.haunting ? { ...x, ghostState: "acknowledged", haunting: { ...x.haunting, acknowledged: true } } : x)));
      bus.emit({ type: "ghost.interacted", taskId: t.id });
    },
    [bus],
  );

  const fetchDialogue = useCallback(async (t: TaskDTO) => {
    if (!t.haunting) return null;
    try {
      const r = await api<{ text: string; source: "ai" | "fallback" }>(`/api/hauntings/${t.haunting.eventId}/dialogue`, { method: "POST" });
      return r.text;
    } catch {
      return null; // the deterministic line already on the task remains
    }
  }, []);

  // ---- preferences ---------------------------------------------------------
  const updatePrefs = useCallback(
    async (p: PatchPreferences) => {
      const prev = prefsRef.current;
      if (prev) setPrefs({ ...prev, ...p } as Preferences);
      try {
        const r = await api<{ preferences: Preferences }>("/api/preferences", { method: "PATCH", body: p });
        setPrefs(r.preferences);
        if (p.timezone && prev && p.timezone !== prev.timezone) void refresh();
      } catch (e) {
        onAuthError(e);
        setPrefs(prev);
        announce(e instanceof ApiError ? e.message : "Could not save settings.");
        throw e;
      }
    },
    [announce, onAuthError, refresh],
  );

  // ---- calendar ------------------------------------------------------------
  const connectCalendar = useCallback(async () => {
    const r = await api<{ url: string }>("/api/calendar/connect", { method: "POST" });
    window.location.href = r.url;
  }, []);

  const syncCalendar = useCallback(async () => {
    try {
      await api("/api/calendar/sync", { method: "POST" });
      await refreshCalendar();
      announce("Calendar synchronised.");
    } catch (e) {
      onAuthError(e);
      setCalendarError(e instanceof ApiError ? e.message : "Calendar sync failed.");
      await refreshCalendar().catch(() => undefined);
      throw e;
    }
  }, [announce, onAuthError, refreshCalendar]);

  const disconnectCalendar = useCallback(async () => {
    await api("/api/calendar/connection", { method: "DELETE" });
    await refreshCalendar();
    announce("Google Calendar disconnected.");
  }, [announce, refreshCalendar]);

  const reviewEvent = useCallback(
    async (id: string, decision: "confirmed_missed" | "not_missed") => {
      const r = await api<{ event: CalendarEventDTO }>(`/api/calendar/events/${id}/review`, { method: "POST", body: { decision } });
      setEvents((prev) => prev.map((e) => (e.id === id ? r.event : e)));
      announce(decision === "confirmed_missed" ? "Marked as missed." : "Marked as attended.");
    },
    [announce],
  );

  // ---- midnight review -------------------------------------------------------
  const openReview = useCallback(
    (auto = false) => {
      const r = reviewRef.current?.review;
      if (!r) return;
      setReviewOpen(true);
      bus.emit({ type: "review.opened", reviewId: r.id, auto });
      void api("/api/hauntings/midnight-review", { method: "POST", body: { reviewId: r.id, action: "seen" } }).catch(() => undefined);
    },
    [bus],
  );

  const closeReview = useCallback(async (dismiss: boolean) => {
    setReviewOpen(false);
    const r = reviewRef.current?.review;
    if (dismiss && r) {
      setReview((prev) => (prev ? { ...prev, pending: false } : prev));
      await api("/api/hauntings/midnight-review", { method: "POST", body: { reviewId: r.id, action: "dismiss" } }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!ready || !review?.pending || !review.review) return;
    if (prefs?.midnightPresentation !== "ritual") return;
    if (autoOpened.current.has(review.review.id)) return;
    autoOpened.current.add(review.review.id);
    openReview(true);
  }, [ready, review, prefs?.midnightPresentation, openReview]);

  const loadHistory = useCallback(async (types?: string[]) => {
    const q = types?.length ? `?type=${types.join(",")}&limit=200` : "?limit=200";
    return (await api<{ hauntings: GhostEventDTO[] }>(`/api/hauntings${q}`)).hauntings;
  }, []);

  const value: Workspace = {
    ready, loadError, prefs, tasks, events, connection, calendarError, review, reviewOpen, nowMs, tz, bus, fx,
    selectedId: effectiveSelected, select: setSelectedId, dialog, openDialog: setDialog, announce,
    isTaskOverdue, hauntedTasks, createTask, updateTask, completeTask, reopenTask, releaseTask, deleteTask,
    acknowledge, fetchDialogue, refresh, updatePrefs, refreshCalendar, connectCalendar, syncCalendar,
    disconnectCalendar, reviewEvent, openReview, closeReview, loadHistory,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only-live" data-testid="live-region">
        {live}
      </div>
    </Ctx.Provider>
  );
}
