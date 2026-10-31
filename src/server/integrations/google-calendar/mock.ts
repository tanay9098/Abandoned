import { addDaysToDate, localDateOf, startOfLocalDay } from "@/lib/datetime/zone";
import type { GoogleEventResource } from "@/features/calendar/model";

/**
 * Demo calendar. Clearly labelled in the UI ("Demo calendar"). It emits Google-shaped resources so
 * they flow through the SAME normaliser and sync path as real events. Times are anchored to local
 * calendar days (not to "now") so ids and times are stable within a day and re-syncs do not duplicate.
 */
export function mockGoogleEvents(now: Date, timezone: string): GoogleEventResource[] {
  const today = localDateOf(now.getTime(), timezone);
  const day = (offset: number) => addDaysToDate(today, offset);
  const at = (date: string, hh: number, mm = 0) => new Date(startOfLocalDay(date, timezone) + (hh * 60 + mm) * 60_000).toISOString();
  const link = (id: string) => `https://www.google.com/calendar/event?eid=${encodeURIComponent(id)}`;
  const timed = (id: string, summary: string, date: string, sh: number, sm: number, eh: number, em: number): GoogleEventResource => ({
    id,
    status: "confirmed",
    summary,
    htmlLink: link(id),
    start: { dateTime: at(date, sh, sm) },
    end: { dateTime: at(date, eh, em) },
  });
  const stamp = (d: string) => d.replaceAll("-", "");
  return [
    timed(`mock-dentist-${stamp(day(-1))}`, "Dentist appointment", day(-1), 16, 0, 17, 0),
    timed(`mock-call-${stamp(day(-2))}`, "Call with Mom", day(-2), 19, 0, 19, 30),
    timed(`mock-standup_${stamp(day(-1))}T0400Z`, "Team standup", day(-1), 9, 30, 10, 0),
    timed(`mock-standup_${stamp(day(1))}T0400Z`, "Team standup", day(1), 9, 30, 10, 0),
    timed(`mock-coffee-${stamp(day(1))}`, "Coffee with Priya", day(1), 11, 0, 12, 0),
    {
      id: `mock-conference-${stamp(day(-1))}`,
      status: "confirmed",
      summary: "Design conference (all day)",
      htmlLink: link("conference"),
      start: { date: day(-1) },
      end: { date: day(0) },
    },
    { id: `mock-yoga-${stamp(day(1))}`, status: "cancelled", summary: "Yoga class" },
  ];
}
