/**
 * Structured JSON logs. Callers must pass identifiers and counts only — never tokens,
 * task titles/descriptions, or calendar content.
 */
type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", msg: string, fields?: Fields) {
  if (process.env.VITEST || process.env.LOG_LEVEL === "silent") return;
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const logger = {
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};

export function newRequestId(): string {
  return crypto.randomUUID();
}
