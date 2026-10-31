/**
 * Deterministic ghost dialogue. This is the canonical copy; AI output (if enabled) only
 * ever replaces it after validation. Tone: humane, never shaming (PRD §11).
 */

export type DialogueBand = "fresh" | "days" | "week" | "long";

export function overdueBand(ms: number): DialogueBand {
  const hours = ms / 3_600_000;
  if (hours < 24) return "fresh";
  if (hours < 24 * 3) return "days";
  if (hours < 24 * 7) return "week";
  return "long";
}

const LINES: Record<DialogueBand, readonly string[]> = {
  fresh: [
    "This slipped past its hour. It is still small. Do you want to finish it, or move it?",
    "I only just arrived. Nothing is lost yet — what would you like to do with this?",
    "The deadline has gone by, quietly. A new time would settle me.",
  ],
  days: [
    "I have been here a couple of days. No judgment — only a question: is this still yours to carry?",
    "Some commitments need a smaller first step. What is the smallest one you could take?",
    "I can rest if you choose a new day for this, or let it go.",
  ],
  week: [
    "This has been waiting most of a week. Perhaps the plan was too large. Break it down, or release it.",
    "A week is long enough to learn whether something still matters. Does this?",
    "You are allowed to change your mind. Reschedule it, or set it down.",
  ],
  long: [
    "I have lingered a long while. That is not a verdict on you — only a sign this needs a decision.",
    "Old commitments can be released without ceremony. Do you still want to carry this forward?",
    "Whatever you decide, it will be a relief to me. Finish it, move it, or let it go.",
  ],
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Same task + same band always yields the same line (stable across renders and retries). */
export function fallbackDialogue(seed: string, overdueMs: number): string {
  const lines = LINES[overdueBand(overdueMs)];
  return lines[hash(seed) % lines.length]!;
}

export function resolvedDialogue(kind: "completed" | "released" | "rescheduled"): string {
  switch (kind) {
    case "completed":
      return "Done. I can rest now.";
    case "released":
      return "Let go, with care. I will not follow you.";
    case "rescheduled":
      return "A new time. I will wait quietly until then.";
  }
}

export function eventReviewDialogue(): string {
  return "This one has ended. I cannot tell whether you were there — only you can say.";
}

export function midnightHeadline(count: number): string {
  if (count === 0) return "The day has changed. Nothing followed you here.";
  if (count === 1) return "One unfinished task followed you into tomorrow.";
  return `${spell(count)} unfinished tasks followed you into tomorrow.`;
}

export const MIDNIGHT_SUBLINE = "The day has changed. These commitments remain.";

function spell(n: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  return n <= 10 ? words[n]! : String(n);
}

export function waitingLine(days: number): string {
  return days <= 0 ? "This one is new." : `This one has been waiting for ${days === 1 ? "a day" : `${days} days`}.`;
}
