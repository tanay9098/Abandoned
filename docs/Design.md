
# Abandonment — Design System

**Design direction:** Analog paranormal investigation meets haunted personal computing  
**Visual theme:** Ghost in the Machine  
**Primary mood:** Quiet dread, forgotten commitments, midnight solitude  
**Product personality:** Mysterious, restrained, slightly sardonic, humane

---

## 1. Design Philosophy

Abandonment should look like a functional productivity application that has been subtly invaded by a paranormal presence.

The default experience is quiet and usable. The supernatural elements emerge when a task becomes overdue, an unresolved appointment is reviewed, or the midnight summary opens.

The design must avoid:
- Generic purple AI dashboards.
- Neon gradients on every surface.
- Excessive glassmorphism.
- Random glowing borders.
- Halloween clip-art overload.
- Excessive animation on ordinary tasks.
- Cartoonish ghosts everywhere.
- Oversized marketing headlines inside the working dashboard.
- Red warning badges on every overdue item.
- Artificial charts and metrics that do not help users.

The product should feel distinctive even when all animations and sound are disabled.

---

## 2. Visual Concept: The Haunted Archive

The interface combines three visual references:

1. **A midnight archive:** Dark ink surfaces, muted paper, precise dividers, compact labels.
2. **Paranormal evidence:** Timestamped incident records, case-file terminology, ghost sightings, and haunting history.
3. **Spectral intrusions:** Pale translucent ghost artwork, violet light, soft shadows, fog, and occasional visual distortion.

The task list is the archive. The ghost is the intrusion. The midnight review is the ritual.

---

## 3. Color System

Use CSS variables so colors remain consistent across components.

### Core palette

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#0D0E12` | Main application background |
| `--surface` | `#15171D` | Sidebar, panels, cards |
| `--surface-raised` | `#1C1F28` | Menus, dialogs, elevated surfaces |
| `--surface-hover` | `#242733` | Interactive hover states |
| `--border` | `#30333F` | Dividers and card borders |
| `--text-primary` | `#E8E5DF` | Main text |
| `--text-secondary` | `#A5A4AD` | Supporting text |
| `--text-muted` | `#737582` | Timestamps and secondary metadata |
| `--spectral` | `#B9A5FF` | Ghost highlights and spectral accents |
| `--spectral-soft` | `#8873CB` | Secondary supernatural details |
| `--spectral-surface` | `#211C31` | Selected haunted states |
| `--danger` | `#E58B91` | Errors and critical overdue indicators |
| `--success` | `#A6C9AD` | Completion and resolution |
| `--warning` | `#D7B879` | Upcoming deadlines and review prompts |

### Color rules

- Use the spectral violet sparingly.
- Reserve brighter violet for active ghosts, selected haunted items, and meaningful transitions.
- Use warm off-white for readable content rather than pure white everywhere.
- Use muted red for critical status, not as the dominant theme.
- Use green only for completion and resolution.
- Do not communicate status through color alone; pair color with labels and icons.
- Ensure text contrast remains accessible.
- Avoid animated color changes in the task list unless they communicate a real state change.

### Light mode

Dark mode is the primary design target for the hackathon.

If light mode is implemented, use an archival-paper treatment with warm off-white surfaces, charcoal text, subdued violet accents, and the same restrained interaction patterns. Do not invert the dark theme mechanically.

---

## 4. Typography

Use a maximum of three font families.

### Primary interface font: Manrope

Use Manrope for navigation, task titles, buttons, forms, and body text.

It provides a contemporary interface voice without looking overly futuristic.

### Editorial accent: DM Mono

Use DM Mono for timestamps, case identifiers, event metadata, overdue durations, and diagnostic labels.

Examples:
- `CASE 0042`
- `OVERDUE · 03H 18M`
- `SIGHTING LOG`
- `LAST SEEN 23:42`

Use this font sparingly. Long body paragraphs should remain in the primary font.

### Ghost dialogue: Lora

Use Lora selectively for ghost monologues and reflective messages. Its editorial character contrasts with the technical interface.

Do not use it for every heading or button.

### Typography rules

- Body text: approximately 14–16 px.
- Supporting metadata: approximately 11–13 px.
- Task titles: approximately 15–17 px.
- Main dashboard heading: approximately 26–32 px.
- Ghost dialogue: approximately 16–19 px.
- Use restrained letter spacing for uppercase metadata.
- Keep line lengths comfortable.
- Avoid excessive font weights and oversized hero text in the dashboard.

Load fonts efficiently and provide local or system fallbacks. Use `next/font` if appropriate for the chosen source.

---

## 5. Layout

### Desktop application shell

Use a compact left navigation rail, a central task workspace, and a contextual right-side panel.

```text
┌──────────────────────────────────────────────────────────────────┐
│ ABANDONMENT                               Date / Settings / User  │
├──────────────┬─────────────────────────────┬─────────────────────┤
│ Navigation   │ Main workspace              │ Haunting panel      │
│              │                             │                     │
│ Today        │ Good evening.               │ CURRENT SIGHTING    │
│ Upcoming     │                             │                     │
│ Calendar     │ Today's tasks               │ Ghost character     │
│ Graveyard    │                             │ Contextual dialogue │
│              │ [Task rows and deadlines]   │ Task actions        │
│ Settings     │                             │                     │
└──────────────┴─────────────────────────────┴─────────────────────┘
```

The right panel is contextual, not permanently filled with a ghost. Empty states should have breathing room.

### Sidebar

- Product wordmark at the top.
- Compact navigation.
- Subtle dividers.
- A distinct Graveyard destination.
- Settings at the bottom.
- Active navigation indicated by a restrained spectral accent and a clear label.

### Main workspace

- A small date or time-context label.
- One clear page heading.
- Task creation control.
- Filters and sorting.
- Tasks grouped by meaningful time ranges.
- Overdue tasks differentiated through metadata and the haunting treatment.
- No unnecessary charts.

### Contextual panel

- Current ghost or selected task details.
- A short monologue.
- Overdue duration.
- Primary action.
- Secondary actions for rescheduling or releasing.
- Optional sound or animation control.

### Mobile layout

- Single-column task workspace.
- Navigation collapses into a drawer or bottom navigation.
- Ghost detail opens in a sheet or dedicated page.
- No hover-only interactions.
- Controls remain touch-friendly.
- Sound settings are easy to reach.

### Spacing

Use a consistent spacing scale based on 4 px.

- 4–8 px: tight metadata groups.
- 12–16 px: controls and compact cards.
- 20–24 px: sections.
- 32–40 px: major layout separation.

Avoid excessive empty space that pushes the actual task list below the fold.

---

## 6. Task Card Design

A task is first a task and only then a possible haunting.

### Normal task

- Neutral surface.
- Clear task title.
- Deadline metadata.
- Checkbox or completion control.
- Optional source indicator for Calendar-linked items.

### Overdue task

- Slightly darker surface.
- Muted violet edge or spectral indicator.
- Overdue duration in DM Mono.
- Small ghost artwork or icon.
- A concise action to inspect the haunting.

Do not animate every overdue card continuously.

### Completed task

- Reduced visual emphasis.
- Completion timestamp where helpful.
- Optional brief release animation.
- No permanent bright glow.

### Calendar event

- Clearly labeled as an external event.
- Display source and original event link.
- Differentiate upcoming events from past events awaiting confirmation.
- Never visually imply that an event was missed without confirmation.

---

## 7. Ghost Character

The ghost should be an original visual asset, not a stock emoji enlarged into the primary character.

### Art direction

- Pale, translucent silhouette.
- Distinctive silhouette readable at small sizes.
- Subtle violet rim lighting.
- Soft, irregular edges.
- Restrained facial expression.
- Slight asymmetry to make the character memorable.
- No excessive particles or constant glow.

Avoid making the ghost excessively cute or excessively grotesque. It should feel like a digital presence that has become attached to unfinished work.

### Character states

1. **Idle:** Slow, gentle floating and occasional blinking.
2. **Awakening:** Ghost emerges through a short mist or opacity transition.
3. **Observing:** Eyes or posture respond subtly to the selected task.
4. **Confrontation:** Slight tilt or expression change during dialogue.
5. **Rescheduled:** Ghost retreats and becomes dormant.
6. **Released:** Ghost fades into a few spectral particles.
7. **Completed:** Brief, calm disappearance animation.

Implement these as explicit animation states. Do not build unrelated animation logic independently in multiple components.

---

## 8. Motion System

Use Motion for React for interface animation and Rive for the ghost character.

### Timing guidelines

| Interaction | Duration |
|---|---|
| Hover or focus transition | 100–180 ms |
| Button response | 120–200 ms |
| Task state transition | 180–300 ms |
| Dialog or panel entry | 250–400 ms |
| Ghost awakening | 500–900 ms |
| Midnight sequence | 1.5–3 seconds |
| Release animation | 500–900 ms |

These are design targets, not mandatory constants for every animation.

### Animation rules

- Animate opacity and transform before expensive layout properties.
- Keep everyday interactions fast.
- Reserve slow motion for significant haunting events.
- Avoid constant screen shake.
- Avoid flicker patterns that could be uncomfortable.
- Do not block task actions while animations play.
- Respect `prefers-reduced-motion`.
- Provide a reduced-motion preference within the application.
- In reduced-motion mode, replace complex movement with a simple fade or static visual state.

---

## 9. Sound Design

Sound is a narrative layer, not a requirement for navigation.

### Sound events

| Event | Sound design |
|---|---|
| App opened | Optional low-volume wind ambience |
| Ghost awakens | Short airy whoosh |
| Midnight review | Three distant clock chimes |
| Ghost interaction | Optional brief whisper |
| Task completed | Gentle fading chime |
| Task released | Soft descending or fading tone |

### Audio rules

- Use Howler.js for playback and volume management.
- Keep audio assets local where licensing permits.
- Avoid loading every sound before it is needed.
- Default to muted or clearly opt-in ambient audio.
- Provide a global mute switch.
- Provide a volume slider.
- Keep individual effects short.
- Respect browser autoplay restrictions.
- Do not automatically play loud audio at midnight.
- Respect quiet hours for notifications.
- Do not rely on audio to communicate task state.
- Avoid overlapping multiple copies of the same sound.
- Stop ambient audio when disabled or when no longer needed.

### Asset requirements

Use original assets or assets whose licenses permit the intended use. Record the source, license, attribution requirements, and local filename in an asset manifest.

Do not assume that a sound available for personal use is automatically allowed in a distributed commercial application.

---

## 10. Midnight Review Screen

This is the signature visual moment of Abandonment.

### Composition

- Darken the surrounding interface slightly.
- Introduce a restrained clock or midnight marker.
- Reveal a small number of ghost characters.
- Display the count of unresolved commitments.
- Present a short summary.
- Provide explicit actions to review, reschedule, complete, or release tasks.

### Copy style

Prefer:
- "The day has changed. These commitments remain."
- "Three unfinished tasks followed you into tomorrow."
- "This one has been waiting for four days."
- "Do you still want to carry this forward?"

Avoid:
- Insults.
- Threats.
- Excessive guilt.
- Claims that the user has failed as a person.
- Aggressive notifications.

### Interaction

The midnight sequence must be skippable. The task list must remain accessible. Users must not be forced to confront every ghost before using the application.

---

## 11. Buttons and Controls

### Primary button

- Solid spectral accent with accessible foreground contrast.
- Used for creating tasks and confirming the primary action.
- Clear action-oriented labels.
- Visible hover, focus, disabled, and loading states.

### Secondary button

- Neutral raised surface.
- Subtle border.
- Used for rescheduling and opening details.

### Destructive or release action

- Use restrained danger styling.
- Require confirmation when the action would permanently delete data.
- Distinguish releasing a commitment from deleting it.
- Never make a destructive action the most visually prominent control by default.

### Icon buttons

- Use consistent Lucide React icons.
- Provide accessible labels.
- Avoid unlabeled decorative symbols as the only source of meaning.
- Ensure sufficient hit area on mobile.

### Form controls

- Clear labels.
- Visible focus indicators.
- Helpful validation.
- No placeholder-only labels.
- Explicit date, time, and time-zone handling.
- Clear errors without losing user input.

---

## 12. Sound and Accessibility Settings

Provide controls for:

- Master sound enabled/disabled.
- Ambient sound enabled/disabled.
- Sound volume.
- Reduced motion.
- Quiet hours.
- Time zone.
- Midnight review presentation.

Settings must persist according to the application's selected storage model.

Sound and motion are independent preferences. Disabling one must not unexpectedly disable the other.

---

## 13. Responsive and Accessibility Requirements

- Keyboard-accessible task creation and actions.
- Semantic HTML.
- Proper dialog focus management.
- Visible keyboard focus.
- Sufficient contrast.
- Text alternatives for meaningful images.
- Decorative ghosts hidden from assistive technology where appropriate.
- Screen-reader announcements for meaningful state changes.
- No essential information conveyed solely through color, animation, or sound.
- Support browser zoom and small screens.
- Avoid rapid flashes and intense strobing.
- Honor reduced-motion preferences.

---

## 14. Performance Requirements

- Avoid introducing a 3D rendering engine for a 2D ghost.
- Lazy-load the interactive ghost runtime if appropriate.
- Use static artwork as a fallback.
- Load sound files on demand.
- Avoid running animation loops for off-screen components.
- Pause or reduce ambient effects when the page is hidden.
- Avoid unnecessary client-side state duplication.
- Keep deadline processing independent of visual effects.
- Provide a functional interface when animation assets fail to load.

---

## 15. Design Acceptance Criteria

The design is accepted when:

- The application looks like a coherent haunted productivity tool.
- The dashboard remains readable and task-focused.
- Ghost effects appear in response to meaningful events.
- Midnight review is visually distinctive but skippable.
- Sound can be muted globally.
- Reduced motion is supported.
- Calendar events are visually distinct from native tasks.
- The design works on desktop and mobile.
- Empty, loading, error, and disconnected states are designed.
- The interface remains usable when every supernatural effect is disabled.
