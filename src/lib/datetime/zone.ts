/**
 * Time-zone arithmetic built only on Intl (no date library).
 * All functions are pure; "now" is always passed in by the caller.
 *
 * DST policy for wall-clock -> instant conversion:
 *  - Nonexistent local time (spring-forward gap): shifted forward by the gap length.
 *  - Ambiguous local time (fall-back overlap): the first (earlier) occurrence wins.
 */

export interface LocalDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of an instant in the given zone. */
export function getZonedParts(instantMs: number, tz: string): LocalDateTime {
  const out: Record<string, number> = {};
  for (const p of formatterFor(tz).formatToParts(new Date(instantMs))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour === 24 ? 0 : out.hour!,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Offset (local - UTC) in ms in effect at an instant. */
export function tzOffsetMs(instantMs: number, tz: string): number {
  const p = getZonedParts(instantMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSecond = instantMs - (((instantMs % 1000) + 1000) % 1000);
  return asUtc - wholeSecond;
}

/** Convert wall-clock fields in `tz` to a UTC instant (ms). See DST policy above. */
export function zonedTimeToUtc(local: LocalDateTime, tz: string): number {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const before = tzOffsetMs(guess - DAY_MS, tz);
  const after = tzOffsetMs(guess + DAY_MS, tz);
  const candidates = new Set<number>();
  for (const offset of new Set([before, after])) {
    const t = guess - offset;
    if (tzOffsetMs(t, tz) === offset) candidates.add(t);
  }
  if (candidates.size > 0) return Math.min(...candidates);
  // Gap: interpret with the offset in effect before the transition (moves the time forward).
  return guess - before;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function parseDateString(date: string): { year: number; month: number; day: number } | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function parseTimeString(time: string): { hour: number; minute: number; second: number } | null {
  const m = TIME_RE.exec(time);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]), second: Number(m[3] ?? 0) };
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/** `YYYY-MM-DD` of an instant in `tz`. */
export function localDateOf(instantMs: number, tz: string): string {
  const p = getZonedParts(instantMs, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Calendar-date arithmetic on `YYYY-MM-DD` strings (zone independent). */
export function addDaysToDate(date: string, days: number): string {
  const d = parseDateString(date);
  if (!d) throw new RangeError(`Invalid date: ${date}`);
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** First instant of a local calendar date in `tz` (handles midnight DST gaps). */
export function startOfLocalDay(date: string, tz: string): number {
  const d = parseDateString(date);
  if (!d) throw new RangeError(`Invalid date: ${date}`);
  return zonedTimeToUtc({ ...d, hour: 0, minute: 0, second: 0 }, tz);
}

/** Local wall-clock date + time (`HH:mm`) -> instant. */
export function localDateTimeToInstant(date: string, time: string, tz: string): number {
  const d = parseDateString(date);
  const t = parseTimeString(time);
  if (!d || !t) throw new RangeError(`Invalid local date/time: ${date} ${time}`);
  return zonedTimeToUtc({ ...d, ...t }, tz);
}

/**
 * Deadline for a date-only task: the end of that local day, i.e. the first
 * instant of the next local day. (`due_at <= now` therefore flips at local midnight.)
 */
export function endOfLocalDayDeadline(date: string, tz: string): number {
  return startOfLocalDay(addDaysToDate(date, 1), tz);
}

/** Local `HH:mm` -> minutes since midnight, or null. */
export function minutesOfDay(time: string): number | null {
  const t = parseTimeString(time);
  return t ? t.hour * 60 + t.minute : null;
}

/** Quiet hours may wrap past midnight (e.g. 22:00-07:00). start === end means "never". */
export function isWithinQuietHours(
  instantMs: number,
  tz: string,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (!start || !end) return false;
  const s = minutesOfDay(start);
  const e = minutesOfDay(end);
  if (s === null || e === null || s === e) return false;
  const p = getZonedParts(instantMs, tz);
  const now = p.hour * 60 + p.minute;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

/** Human duration for overdue metadata, e.g. `03H 18M` or `2D 04H`. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  if (days > 0) return `${days}D ${pad(hours)}H`;
  return `${pad(hours)}H ${pad(minutes)}M`;
}

/** Add N calendar months/days/weeks in a zone keeping wall-clock time (for recurrence). */
export function shiftLocalInstant(instantMs: number, tz: string, unit: "day" | "week" | "month", count = 1): number {
  const p = getZonedParts(instantMs, tz);
  if (unit === "month") {
    const total = p.year * 12 + (p.month - 1) + count;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return zonedTimeToUtc({ ...p, year, month, day: Math.min(p.day, lastDay) }, tz);
  }
  const date = addDaysToDate(`${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`, unit === "week" ? 7 * count : count);
  const d = parseDateString(date)!;
  return zonedTimeToUtc({ ...d, hour: p.hour, minute: p.minute, second: p.second }, tz);
}
