import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_CALENDAR_MOCK: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-haiku-5-5"),
  ABANDONMENT_ALLOW_TEST_CLOCK: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

const DEV_SESSION_SECRET = "dev-only-session-secret-change-me-0123456789abcdef";

let cached: Env | null = null;

/** Validated, lazily-read environment. Server-only: never import from client components. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.parse(process.env);
  if (parsed.NODE_ENV === "production" && !process.env.NEXT_PHASE?.includes("build")) {
    const missing = (["SESSION_SECRET", "CRON_SECRET"] as const).filter((k) => !parsed[k]);
    if (missing.length) throw new Error(`Missing required environment variables in production: ${missing.join(", ")}`);
    if ((parsed.SESSION_SECRET ?? "").length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  cached = parsed;
  return parsed;
}

export function resetEnvCache() {
  cached = null;
}

export function sessionSecret(): string {
  const e = env();
  return e.SESSION_SECRET && e.SESSION_SECRET.length >= 32 ? e.SESSION_SECRET : DEV_SESSION_SECRET;
}

export const isProduction = () => env().NODE_ENV === "production";

/** Demo calendar is explicit-or-development-only; production never silently fakes a provider. */
export function calendarMode(): "google" | "mock" | "unconfigured" {
  const e = env();
  if (e.GOOGLE_CALENDAR_MOCK === "1") return "mock";
  if (e.GOOGLE_CALENDAR_MOCK === "0") return e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? "google" : "unconfigured";
  if (e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.GOOGLE_REDIRECT_URI) return "google";
  return e.NODE_ENV === "production" ? "unconfigured" : "mock";
}
