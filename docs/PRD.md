
# Abandonment — Product Requirements Document

**Product:** Abandonment  
**Tagline:** Your unfinished business has come back to haunt you.  
**Status:** Initial specification  
**Project type:** Hackathon MVP / web application  
**Theme:** Ghost in the Machine

---

## 1. Product Overview

Abandonment is a paranormal-themed productivity application that turns unfinished tasks and forgotten commitments into interactive digital ghosts.

Users manage tasks in a native to-do list and connect Google Calendar to bring appointments and events into the same workspace. When a task's deadline passes without completion, the application marks it overdue and awakens a ghost associated with that commitment.

At midnight, the application performs a daily review of overdue tasks and presents a haunting summary.

Users can confront, complete, reschedule, or consciously release unfinished tasks.

The product combines practical task management, reliable deadline tracking, atmospheric animation, sound design, and optional AI-generated ghost dialogue.

### Product principle

The haunting is a presentation layer over a reliable productivity system. Deadlines, task states, and event processing must remain deterministic and testable. AI must never decide whether a task is overdue.

---

## 2. Problem Statement

Traditional to-do applications often rely on generic reminders, red overdue labels, and broken streaks. Users can become desensitized to notifications or repeatedly postpone commitments without reviewing whether those commitments remain relevant.

Abandonment makes forgotten commitments visible through a distinctive paranormal experience.

The product should encourage users to take action without shaming them. A user must be able to complete, reschedule, simplify, or release a commitment.

---

## 3. Goals

1. Provide a usable, reliable to-do application.
2. Integrate Google Calendar to display relevant upcoming and past events.
3. Detect overdue tasks consistently, including when the application is closed.
4. Turn overdue tasks into persistent, interactive ghost experiences.
5. Deliver a memorable midnight review.
6. Use sound and animation to reinforce meaningful events.
7. Demonstrate a technically credible interpretation of the Ghost in the Machine theme.
8. Maintain clear separation between task logic, integrations, animation, audio, and AI-generated content.

### Non-goals for the initial MVP

- Gmail integration.
- Notion integration.
- Full project-management functionality.
- Social feeds, public profiles, or collaborative workspaces.
- A complete 3D game world.
- Autonomous AI changes to tasks or calendar events.
- Medical, psychological, or behavioral diagnoses.
- Complex gamification, leaderboards, or subscription billing.

---

## 4. Target Users

### Primary: Students and early-career professionals

People balancing coursework, projects, deadlines, appointments, and personal goals who want a task manager that feels engaging rather than generic.

### Secondary: Independent developers and creators

People managing personal projects, GitHub-related work, learning goals, and appointments who appreciate customizable tools and distinctive interfaces.

### Tertiary: Habit and personal-goal trackers

People who want to review abandoned commitments, restart realistic goals, or consciously stop pursuing goals that no longer matter.

### User needs

- Quickly capture a task.
- Assign a deadline and optionally a reminder.
- See upcoming tasks and Calendar events in one place.
- Understand why an item is overdue.
- Review neglected commitments without losing their history.
- Reschedule or complete tasks with minimal friction.
- Control animations, sound, notifications, and time-zone settings.
- Trust that the application will not modify external data without permission.

---

## 5. Core User Stories

1. As a user, I want to create, edit, complete, and delete tasks.
2. As a user, I want to assign a due date, time, and optional recurrence.
3. As a user, I want to connect Google Calendar and view upcoming events.
4. As a user, I want overdue tasks to awaken their associated ghosts.
5. As a user, I want to see a midnight summary of unfinished commitments.
6. As a user, I want a ghost to have a distinctive appearance and contextual dialogue.
7. As a user, I want to reschedule, complete, or release a haunted task.
8. As a user, I want to review past hauntings and their resolution history.
9. As a user, I want to disable sound and reduce motion.
10. As a user, I want to disconnect Google Calendar and revoke access.
11. As a user, I want the application to use my configured time zone correctly.
12. As a user, I want a past Calendar event to be flagged for review rather than automatically declared missed.

---

## 6. Functional Requirements

### FR-01: Task Management

Users must be able to:

- Create a task with a title and optional description.
- Set a due date and optional due time.
- Edit task details.
- Mark tasks complete.
- Reschedule tasks.
- Delete tasks with appropriate confirmation.
- View active, completed, overdue, and released tasks.
- Filter and sort tasks.
- Create tasks without a deadline.

Tasks without deadlines must never become overdue automatically.

### FR-02: Task Lifecycle

Supported task states:

- `pending`
- `completed`
- `released`

Overdue is a derived condition based on the task's status, due date, and current time. It should not be represented as an independent status that can become inconsistent with the deadline.

Ghost presentation states may include:

- `dormant`
- `awakened`
- `acknowledged`
- `resting`

Ghost state must not replace the authoritative task state.

### FR-03: Deadline Detection

A task is overdue when:

- It has a deadline.
- Its deadline has passed.
- It is not completed or released.

Deadline detection must work when the application is closed.

The system must reconcile deadlines when the user opens the application and run a server-side scheduled process for background processing.

Repeated scheduler executions must not create duplicate haunting events.

### FR-04: Midnight Haunting

At local midnight, the application must:

1. Identify tasks that became overdue since the previous review.
2. Create a daily summary of outstanding commitments.
3. Reveal the summary on the dashboard.
4. Generate or retrieve appropriate ghost dialogue.
5. Respect user preferences for sound and notifications.
6. Avoid duplicate events when a scheduled job is retried.

Midnight review must use the user's IANA time zone, such as `Asia/Kolkata`.

A task due at 11:00 PM must not become overdue before that deadline. A task due tomorrow must not haunt the user at the midnight starting tomorrow.

The midnight review should summarize overdue tasks; it must not automatically mark every incomplete task as overdue.

### FR-05: Google Calendar Integration

Users must be able to:

- Connect Google Calendar through OAuth.
- Grant only the permissions needed for the selected functionality.
- View relevant events alongside tasks.
- Identify the source of each imported event.
- Open the original Calendar event.
- Disconnect the integration.

For the MVP, prefer read-only Calendar access.

An event that has ended must be considered a past event requiring review, not proof that the user missed it.

The application must distinguish:

- Upcoming event.
- Past event awaiting review.
- Confirmed missed event.
- Cancelled event, where that status is available.

Do not automatically modify or delete Google Calendar events.

### FR-06: Ghost Experience

Each haunted task must be represented by a ghostly UI treatment.

Required effects:

- Ghost entrance animation.
- Floating idle animation.
- Contextual dialogue.
- Overdue duration.
- Task-specific actions.
- Completion or release animation.

Ghost personalities may differ by task type or overdue duration, but the UI must remain understandable without animations.

### FR-07: Sound Design

Supported sound events:

| Event | Sound |
|---|---|
| App opened | Optional quiet wind ambience |
| Ghost awakens | Short airy whoosh |
| Midnight review | Three distant clock chimes |
| Ghost interaction | Optional brief whisper |
| Task completed | Gentle fading chime |
| Task released | Soft descending or fading tone |

Requirements:

- Provide a global sound toggle.
- Provide volume controls.
- Respect browser audio restrictions.
- Never require sound to understand the interface.
- Avoid automatically playing loud audio at midnight.
- Provide quiet-hour and notification preferences.
- Support reduced-motion preferences independently of sound preferences.

### FR-08: Resurrection and Release

Users must be able to:

- Complete a task.
- Reschedule a task.
- Edit its details.
- Break a task into smaller steps, if subtasks are implemented.
- Release a commitment they no longer intend to pursue.

Rescheduling must update the deadline and recalculate overdue status.

Releasing a task must preserve appropriate history without continuing to treat it as overdue.

### FR-09: AI Ghost Dialogue

AI-generated dialogue is optional and must not be required for the core application to function.

AI may:

- Generate a short ghost monologue.
- Personalize dialogue using task title, overdue duration, and non-sensitive task metadata.
- Suggest a smaller next action.
- Offer a neutral rescheduling suggestion.

AI must not:

- Determine whether a task is overdue.
- Invent Calendar events or claim that an event was missed without confirmation.
- Execute external actions autonomously.
- Expose private task data to an unapproved provider.
- shame, threaten, or manipulate users.
- Generate dialogue containing unnecessary sensitive information.

Use deterministic fallback dialogue if AI is unavailable.

### FR-10: Accessibility and Preferences

The application must support:

- Keyboard navigation.
- Visible focus indicators.
- Semantic controls and labels.
- Sufficient text contrast.
- Reduced-motion preferences.
- Muted audio by preference.
- Time-zone configuration.
- Clear error and loading states.

---

## 7. Primary User Journey

1. The user opens Abandonment.
2. The user creates a task or connects Google Calendar.
3. Tasks and relevant events appear in the dashboard.
4. The user misses a task deadline.
5. The deadline engine detects the overdue condition.
6. A haunting event is recorded once.
7. A ghost appears with contextual dialogue.
8. The user completes, reschedules, or releases the task.
9. At midnight, the dashboard presents a summary of unresolved commitments.
10. The user reviews progress and starts the next day.

---

## 8. Main Screens

- Landing page.
- Authentication and onboarding.
- Main dashboard.
- Today's tasks.
- Upcoming deadlines.
- Calendar-connected events.
- Haunted task detail.
- Graveyard / haunting history.
- Midnight review.
- Settings and integrations.
- Empty, error, loading, and disconnected states.

---

## 9. Success Criteria

The MVP is successful when:

- A user can create and manage tasks.
- Overdue detection works correctly across time zones.
- A missed deadline triggers one persistent haunting event.
- Midnight summaries are generated without duplicates.
- Google Calendar can be connected and disconnected safely.
- Past events require appropriate confirmation.
- Ghost animation and sound correspond to actual application events.
- The product remains usable with sound disabled and reduced motion enabled.
- The application works when AI is unavailable.
- The README explains setup, permissions, architecture, and limitations.
- The demo shows the complete journey from task creation to haunting and resolution.

---

## 10. MVP Priorities

### P0 — Required

- Native task CRUD.
- Task deadline engine.
- Persistent task storage.
- Google Calendar OAuth and read-only event retrieval.
- Ghost presentation and dialogue fallback.
- Overdue dashboard.
- Midnight review.
- Sound toggle and reduced-motion support.
- Tests for deadline and duplicate-event behavior.

### P1 — Important

- AI-generated ghost dialogue.
- Calendar event review and missed-event confirmation.
- Haunting history.
- Rescheduling and release animations.
- User preferences and time-zone settings.

### P2 — Future

- Gmail integration.
- Notion integration.
- GitHub issues and pull requests.
- Advanced recurring tasks.
- Multiple ghost personalities.
- Push notifications.
- More elaborate environmental effects.

---

## 11. Product Guardrails

- Never equate an incomplete task with personal failure.
- Allow users to consciously abandon goals.
- Do not make frightening animations or sounds unavoidable.
- Do not infer that an appointment was missed merely because it ended.
- Never sacrifice deadline correctness for an animation or AI effect.
- Do not request unnecessary Google permissions.
- Preserve user data and existing application functionality during development.
