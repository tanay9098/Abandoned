import { formatDuration, getZonedParts } from "@/lib/datetime/zone";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const p2 = (n: number) => String(n).padStart(2, "0");

/** `MON 02 NOV · 18:00` in the user's zone (case-file timestamp). */
export function stamp(iso: string | number | Date, tz: string, withTime = true): string {
  const ms = new Date(iso).getTime();
  const p = getZonedParts(ms, tz);
  const dow = DAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()]!;
  const date = `${dow} ${p2(p.day)} ${MONTHS[p.month - 1]}`;
  return withTime ? `${date} · ${p2(p.hour)}:${p2(p.minute)}` : date;
}

export function clock(ms: number, tz: string): string {
  const p = getZonedParts(ms, tz);
  return `${p2(p.hour)}:${p2(p.minute)}`;
}

export function overdueLabel(ms: number): string {
  return `OVERDUE · ${formatDuration(ms)}`;
}

export function greeting(ms: number, tz: string): string {
  const h = getZonedParts(ms, tz).hour;
  if (h < 5) return "Still awake.";
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}

/** Stable, human-feeling case number derived from the id. */
export function caseNumber(id: string): string {
  const n = parseInt(id.replace(/-/g, "").slice(0, 6), 16) % 10000;
  return `CASE ${String(n).padStart(4, "0")}`;
}
