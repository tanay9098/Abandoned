import { z } from "zod";
import {
  endOfLocalDayDeadline,
  isValidTimeZone,
  localDateTimeToInstant,
  parseDateString,
  parseTimeString,
} from "@/lib/datetime/zone";
import { TASK_STATUSES, type Recurrence } from "./model";

const title = z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or fewer");
const description = z.string().trim().max(2000, "Description must be 2000 characters or fewer");
const tz = z.string().refine(isValidTimeZone, "Unknown IANA time zone");
const isoInstant = z.iso.datetime({ offset: true });
const dateOnly = z.string().refine((v) => parseDateString(v) !== null, "Use YYYY-MM-DD");
const timeOnly = z.string().refine((v) => parseTimeString(v) !== null, "Use HH:mm");
const recurrence = z.enum(["daily", "weekly", "monthly"]);

export const createTaskSchema = z
  .object({
    title,
    description: description.nullish(),
    dueAt: isoInstant.nullish(),
    dueDate: dateOnly.nullish(),
    dueTime: timeOnly.nullish(),
    dueTimezone: tz.nullish(),
    recurrence: recurrence.nullish(),
  })
  .strict()
  .superRefine(deadlineRules);

export const patchTaskSchema = z
  .object({
    title: title.optional(),
    description: description.nullish(),
    dueAt: isoInstant.nullish(),
    dueDate: dateOnly.nullish(),
    dueTime: timeOnly.nullish(),
    dueTimezone: tz.nullish(),
    recurrence: recurrence.nullish(),
    status: z.enum(TASK_STATUSES as [string, ...string[]]).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine(deadlineRules)
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

function deadlineRules(
  v: { dueAt?: string | null; dueDate?: string | null; dueTime?: string | null },
  ctx: z.RefinementCtx,
) {
  if (v.dueAt && v.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueAt"], message: "Provide dueAt or dueDate, not both" });
  }
  if (v.dueTime && !v.dueDate) {
    ctx.addIssue({ code: "custom", path: ["dueTime"], message: "dueTime requires dueDate" });
  }
}

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type PatchTaskInput = z.infer<typeof patchTaskSchema>;

export interface ResolvedDeadline {
  dueAt: Date | null;
  dueTimezone: string | null;
}

/** True when the input mentions the deadline at all (including explicit clearing with null). */
export function touchesDeadline(v: { dueAt?: string | null; dueDate?: string | null }): boolean {
  return v.dueAt !== undefined || v.dueDate !== undefined;
}

/**
 * Turn user input into an authoritative instant.
 *  - `dueAt`: exact instant (offset required).
 *  - `dueDate` + `dueTime`: wall-clock in `dueTimezone` (defaults to the profile zone).
 *  - `dueDate` alone: end of that local day (first instant of the next day).
 *  - null: clear the deadline.
 */
export function resolveDeadline(
  v: { dueAt?: string | null; dueDate?: string | null; dueTime?: string | null; dueTimezone?: string | null },
  profileTimezone: string,
): ResolvedDeadline {
  const zone = v.dueTimezone ?? profileTimezone;
  if (v.dueAt) return { dueAt: new Date(v.dueAt), dueTimezone: zone };
  if (v.dueDate) {
    const ms = v.dueTime
      ? localDateTimeToInstant(v.dueDate, v.dueTime, zone)
      : endOfLocalDayDeadline(v.dueDate, zone);
    return { dueAt: new Date(ms), dueTimezone: zone };
  }
  return { dueAt: null, dueTimezone: null };
}

export type { Recurrence };
