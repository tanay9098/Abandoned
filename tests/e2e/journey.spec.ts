import { expect, test } from "@playwright/test";
import { CRON, alerts, istDate, istInstant, nowHeader, signIn, skipReview, travelTo } from "./helpers";

test.describe("core journey: task → deadline → haunting → resolution", () => {
  test("creates a task, simulates the deadline passing, records ONE haunting, then reschedules", async ({ page, context }) => {
    const soundRequests: string[] = [];
    page.on("request", (r) => r.url().includes("/sounds/") && soundRequests.push(r.url()));

    await signIn(page, { seed: false });
    await expect(page.getByText("Nothing is waiting.")).toBeVisible();

    // 1. create a task with a deadline tomorrow 18:00 IST
    const tomorrow = istDate(1);
    await page.locator("#qa-title").fill("Write report");
    await page.locator("#qa-date").fill(tomorrow);
    await page.locator("#qa-time").fill("18:00");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    const row = page.getByTestId("task-row").filter({ hasText: "Write report" });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("overdue-meta")).toHaveCount(0);
    await expect(page.getByTestId("ghost-panel")).toHaveCount(0);

    // 2. simulate the deadline passing (controlled clock — no waiting)
    const justAfter = new Date(istInstant(tomorrow, 18).getTime() + 60_000);
    await travelTo(page, context, justAfter);
    await page.reload();

    // 3. exactly one haunting is recorded and the ghost appears
    await expect(row.getByTestId("overdue-meta")).toBeVisible();
    await expect(page.getByTestId("ghost-panel")).toBeVisible();
    await expect(page.getByTestId("ghost-panel")).toContainText("OVERDUE");
    await expect(page.getByTestId("ghost-line")).not.toBeEmpty();
    for (let i = 0; i < 3; i++) await page.request.post("/api/hauntings/reconcile", { headers: nowHeader(justAfter) });
    const missed = await page.request.get("/api/hauntings?type=deadline_missed", { headers: nowHeader(justAfter) });
    expect((await missed.json()).hauntings).toHaveLength(1);

    // 4. sound is off by default: nothing was fetched
    expect(soundRequests).toEqual([]);

    // 5. reschedule → no longer overdue, ghost rests
    await page.getByTestId("ghost-panel").getByRole("button", { name: "Reschedule" }).click();
    await page.locator("#rs-date").fill(istDate(10, justAfter.getTime()));
    await page.locator("#rs-time").fill("09:00");
    await page.getByRole("dialog").getByRole("button", { name: "Reschedule", exact: true }).click();
    await expect(row.getByTestId("overdue-meta")).toHaveCount(0);
    await expect(page.getByText("No ghosts tonight.")).toBeVisible();

    // history was preserved, not rewritten
    await page.goto("/graveyard");
    await expect(page.getByTestId("history")).toContainText("Deadline passed. A ghost awakened.");
    await expect(page.getByTestId("history")).toContainText("Rescheduled");
  });

  test("tasks without deadlines never haunt; completing and releasing work; delete asks to confirm", async ({ page, context }) => {
    await signIn(page, { seed: false });
    await page.locator("#qa-title").fill("Someday maybe");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page.locator("#qa-title").fill("Finish me");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page.locator("#qa-title").fill("Let me go");
    await page.getByRole("button", { name: "Add task", exact: true }).click();

    // far in the future: a task with no deadline is still not overdue
    await travelTo(page, context, new Date("2031-01-01T00:00:00Z"));
    await page.reload();
    await expect(page.getByTestId("task-row")).toHaveCount(3);
    await expect(page.getByTestId("overdue-meta")).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Mark Finish me complete" }).click();
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: "Finish me" })).toContainText("Completed");

    await page.getByRole("button", { name: "Active" }).click();
    await page.getByRole("button", { name: "Release Let me go" }).click();
    await expect(page.getByRole("dialog")).toContainText("Nothing is deleted");
    await page.getByRole("dialog").getByRole("button", { name: "Release", exact: true }).click();
    await page.getByRole("button", { name: "Released", exact: true }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: "Let me go" })).toContainText("Released");

    await page.getByRole("button", { name: "All" }).click();
    await page.getByRole("button", { name: "Delete Someday maybe" }).click();
    await expect(page.getByRole("dialog")).toContainText("cannot be undone");
    await page.getByRole("dialog").getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: "Someday maybe" })).toBeVisible();
  });

  test("validation keeps the user's input and explains the problem", async ({ page }) => {
    await signIn(page, { seed: false });
    await page.locator("#qa-time").fill("10:00");
    await page.locator("#qa-title").fill("No date");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(alerts(page)).toContainText("Choose a date");
    await expect(page.locator("#qa-title")).toHaveValue("No date");
  });
});

test.describe("seeded archive, ghost interaction and midnight review", () => {
  test("shows hauntings, the skippable midnight review, and replay from the graveyard", async ({ page }) => {
    await signIn(page, { seed: true });

    // The midnight review opens once for the new local day and lists real overdue tasks.
    const review = page.getByTestId("midnight-review");
    await expect(review).toBeVisible();
    await expect(review).toContainText("unfinished tasks followed you into tomorrow");
    await expect(review).toContainText("The day has changed. These commitments remain.");
    await expect(review.getByTestId("review-items")).toContainText("Renew passport");

    // skippable; the task list stays accessible
    await page.keyboard.press("Escape");
    await expect(review).toBeHidden();
    await expect(page.getByTestId("task-row").first()).toBeVisible();

    // reload: dismissed reviews do not reappear, and reloading never duplicates them
    await page.reload();
    await expect(page.getByTestId("task-row").first()).toBeVisible();
    await expect(review).toBeHidden();
    await page.request.post("/api/hauntings/reconcile");
    const rv = await page.request.get("/api/hauntings?type=midnight_review");
    expect((await rv.json()).hauntings).toHaveLength(1);

    // ghost panel shows the most urgent sighting; "hear it out" acknowledges it
    const panel = page.getByTestId("ghost-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Hear it out" }).click();
    await expect(panel.getByRole("button", { name: "Hear it out" })).toHaveCount(0);

    // completing a haunted task retires its ghost
    const title = await panel.getByRole("heading", { level: 3 }).innerText();
    await panel.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: title })).toHaveCount(0);

    // replay from the graveyard
    await page.goto("/graveyard");
    await page.getByRole("button", { name: /Replay latest midnight review/ }).click();
    await expect(page.getByTestId("midnight-review")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByTestId("midnight-review")).toBeHidden();
  });

  test("works with reduced motion + sound disabled (content is immediately present)", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", timezoneId: "Asia/Kolkata", baseURL: "http://localhost:3100" });
    const page = await context.newPage();
    await signIn(page, { seed: true });
    await expect(page.getByTestId("midnight-review")).toContainText("These commitments remain");
    await expect(page.getByTestId("midnight-review").getByTestId("review-items")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await page.goto("/settings");
    await expect(page.getByRole("switch", { name: "Sound effects" })).not.toBeChecked();
    await context.close();
  });
});

test.describe("preferences", () => {
  test("reduce-motion and sound settings persist across reloads and are independent", async ({ page }) => {
    await signIn(page, { seed: false });
    await page.goto("/settings");
    const motion = page.getByRole("switch", { name: "Reduce motion" });
    const sound = page.getByRole("switch", { name: "Sound effects" });
    await expect(motion).not.toBeChecked();
    await motion.click();
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
    await expect(sound).not.toBeChecked(); // disabling/enabling one does not touch the other
    await sound.click();
    await page.reload();
    await expect(page.getByRole("switch", { name: "Reduce motion" })).toBeChecked();
    await expect(page.getByRole("switch", { name: "Sound effects" })).toBeChecked();
    await expect(page.getByRole("switch", { name: "Ambient wind" })).not.toBeChecked();

    // invalid time zone is refused with a clear message
    await page.locator("#tz").fill("Mars/Olympus");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(alerts(page)).toContainText("valid IANA time zone");
  });

  test("a failing audio asset never breaks the app", async ({ page, context }) => {
    await context.route("**/sounds/**", (r) => r.abort());
    await signIn(page, { seed: true });
    await skipReview(page);
    await page.request.patch("/api/preferences", { data: { soundEnabled: true, soundVolume: 0.5 } });
    await page.reload();
    const panel = page.getByTestId("ghost-panel");
    await panel.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByTestId("live-region")).toContainText("Completed");
  });
});

test.describe("google calendar (demo provider)", () => {
  test("connect, review a past event explicitly, then disconnect", async ({ page }) => {
    await signIn(page, { seed: false });
    await page.goto("/calendar");
    await page.getByRole("button", { name: "Connect demo calendar" }).click();
    await expect(page).toHaveURL(/connected=1/);
    await expect(page.getByText("Events were imported read-only.")).toBeVisible();

    const dentist = page.getByTestId("event-card").filter({ hasText: "Dentist appointment" });
    await expect(dentist).toBeVisible();
    await expect(dentist).toContainText("Awaiting your review");
    await expect(dentist).toContainText("DEMO CALENDAR (SAMPLE DATA)");
    await expect(dentist).not.toContainText("missed by you"); // an ended event is never assumed missed
    await expect(dentist.getByRole("link", { name: /Open original/ })).toHaveAttribute("href", /google\.com\/calendar/);

    await dentist.getByRole("button", { name: "I missed it" }).click();
    await expect(dentist).toContainText("Marked missed by you");

    // past events also show on the dashboard as awaiting review (not missed)
    await page.goto("/dashboard");
    await expect(page.getByText(/past events? (is|are) waiting for your review/)).toBeVisible();

    await page.goto("/calendar");
    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByRole("button", { name: "Connect demo calendar" })).toBeVisible();
    await expect(page.getByTestId("event-card")).toHaveCount(0);
  });

  test("calendar failures degrade gracefully and tasks keep working", async ({ page }) => {
    await signIn(page, { seed: false });
    await page.route("**/api/calendar/connection", (r) => r.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { code: "calendar_unavailable", message: "Google Calendar could not be reached. Your tasks are unaffected." } }) }));
    await page.goto("/calendar");
    await expect(alerts(page)).toContainText("Your tasks are unaffected");
    await page.goto("/dashboard");
    await page.locator("#qa-title").fill("Still works");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(page.getByTestId("task-row").filter({ hasText: "Still works" })).toBeVisible();
  });

  test("a forged OAuth callback is rejected", async ({ page }) => {
    await signIn(page, { seed: false });
    await page.goto("/api/calendar/callback?state=forged&code=mock-demo-code");
    await expect(page).toHaveURL(/error=oauth_state_missing/);
    await expect(alerts(page)).toContainText("authorisation session was not found");
    await expect(page.getByRole("button", { name: "Connect demo calendar" })).toBeVisible();
  });
});

test.describe("security and scheduler", () => {
  test("API requires a session; foreign ids are 404; cross-origin writes are refused", async ({ page, request }) => {
    expect((await request.get("/api/tasks")).status()).toBe(401);
    expect((await request.post("/api/tasks", { data: { title: "x" } })).status()).toBe(401);

    await signIn(page, { seed: false });
    expect((await page.request.get("/api/tasks/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
    const cross = await page.request.post("/api/tasks", { data: { title: "csrf" }, headers: { origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);
    const bad = await page.request.post("/api/tasks", { data: { title: "", userId: "x" } });
    expect(bad.status()).toBe(400);
  });

  test("scheduler endpoints reject missing/wrong secrets and are idempotent", async ({ page, request }) => {
    expect((await request.post("/api/jobs/process-deadlines")).status()).toBe(401);
    expect((await request.post("/api/jobs/midnight-review", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);

    await signIn(page, { seed: false });
    const due = istInstant(istDate(1), 9);
    const created = await page.request.post("/api/tasks", { data: { title: "Job-detected", dueAt: due.toISOString() } });
    expect(created.status()).toBe(201);
    const after = new Date(due.getTime() + 60_000);

    // the scheduler works while no browser is involved in the detection
    const headers = { authorization: CRON, ...nowHeader(after) };
    const first = await (await request.post("/api/jobs/process-deadlines", { headers })).json();
    const second = await (await request.post("/api/jobs/process-deadlines", { headers })).json();
    expect(first.ok).toBe(true);
    expect(first.created).toBeGreaterThanOrEqual(1);
    expect(second.created).toBe(0);
    const missed = await page.request.get("/api/hauntings?type=deadline_missed", { headers: nowHeader(after) });
    expect((await missed.json()).hauntings).toHaveLength(1);

    const r1 = await (await request.post("/api/jobs/midnight-review", { headers })).json();
    const r2 = await (await request.post("/api/jobs/midnight-review", { headers })).json();
    expect(r1.ok).toBe(true);
    expect(r2.created).toBe(0);
  });

  test("AI is optional: dialogue falls back deterministically with no provider", async ({ page, context }) => {
    await signIn(page, { seed: true });
    await skipReview(page);
    const tasks = (await (await page.request.get("/api/tasks?status=overdue")).json()).tasks;
    const haunted = tasks.find((t: { haunting: unknown }) => t.haunting);
    expect(haunted).toBeTruthy();
    await page.request.patch("/api/preferences", { data: { aiDialogueEnabled: true } });
    const d = await (await page.request.post(`/api/hauntings/${haunted.haunting.eventId}/dialogue`)).json();
    expect(d.source).toBe("fallback");
    expect(d.text.length).toBeGreaterThan(10);
    void context;
  });
});
