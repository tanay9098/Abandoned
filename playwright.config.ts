import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    timezoneId: "Asia/Kolkata",
    locale: "en-US",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      // Ephemeral in-memory database, mock calendar, test clock enabled (never set these in production).
      PGLITE_DIR: "memory://",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
      CRON_SECRET: "e2e-cron-secret-0123456789",
      GOOGLE_CALENDAR_MOCK: "1",
      ABANDONMENT_ALLOW_TEST_CLOCK: "1",
      LOG_LEVEL: "silent",
    },
  },
});
