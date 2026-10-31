import { expect, type BrowserContext, type Page } from "@playwright/test";

export const CRON = "Bearer e2e-cron-secret-0123456789";

const p2 = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of (today + days) in Asia/Kolkata (the zone configured for these tests). */
export function istDate(offsetDays: number, from = Date.now()): string {
  const d = new Date(from + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts;
}

export function istInstant(date: string, hh: number, mm = 0): Date {
  return new Date(`${date}T${p2(hh)}:${p2(mm)}:00+05:30`);
}

export async function signIn(page: Page, { seed }: { seed: boolean }) {
  await page.goto("/");
  await page.getByRole("link", { name: "Open the archive" }).click();
  await expect(page).toHaveURL(/\/login/);
  const box = page.getByRole("checkbox", { name: /sample case files/i });
  if (seed) await box.check();
  else await box.uncheck();
  await page.getByRole("button", { name: "Enter the archive" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Shift both the server clock (X-Test-Now header) and the browser clock to `when`. */
export async function travelTo(page: Page, context: BrowserContext, when: Date) {
  await context.unroute("**/api/**").catch(() => undefined);
  await context.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), "x-test-now": when.toISOString() } }));
  await page.clock.setFixedTime(when);
}

export const nowHeader = (when: Date) => ({ "x-test-now": when.toISOString() });

/** App alerts only (Next.js also renders a route-announcer with role="alert"). */
export const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** A freshly seeded archive opens the midnight review once; wait for it and skip it. */
export async function skipReview(page: Page) {
  const review = page.getByTestId("midnight-review");
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Skip" }).click();
  await expect(review).toBeHidden();
}
