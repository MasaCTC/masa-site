# Checklist (running checklist)

An ordered list of tasks where order = priority: top is most important, bottom is "meh". Each row: rank number, drag grip, checkbox, title + meta line (class swatch + class, due label, "Canvas"), estimate, remove button.

**Markup**: `<ol class="mn-checklist" aria-label="Running checklist, most important first">` → `<li class="mn-check">` with `.mn-check__rank`, `button.mn-grip`, `input.mn-box`, `.mn-check__body > .mn-check__title + .mn-check__meta`, `.mn-check__est`, `button.mn-check__x`. Meta parts are optional: a task can be just a title. "show on /now" is a secondary action: hidden until the row is hovered or has keyboard focus, always visible on touch screens. Clicking a task's title opens the task Modal (same as on the calendar), where Edit changes title, class, due date and estimate.

**Reordering**: pointer drag (use a real drag library such as dnd-kit so touch works) AND keyboard: focus the grip, ↑/↓ moves the row, a polite live region announces "moved to position 2 of 9". Move the actual row while dragging and commit the order once on drop, never re-render the list mid-drag.

| State | Look | Trigger |
|---|---|---|
| Default | Raised row (`neu-raised-sm`) | — |
| Hover | Grip goes `ink` | `:hover` |
| Pressed / dragging | Row lifts to `neu-raised-lg` and scales 1.015; the gap it leaves is an inset placeholder | `.is-dragging`, `.is-placeholder` |
| Focus | Focus ring on grip / checkbox / remove; a keyboard-lifted row shows `.is-lifted` | `:focus-visible` |
| Disabled | N/A | — |
| Done | Flat with a dashed hairline, title struck through in `ink-subtle` | `.is-done` |
| Loading | Three skeleton rows (Feedback) | — |
| Empty | `mn-msg`: "Nothing on the list. Add a task, or connect Canvas in Settings." | — |
| Delete | The × asks first with the Modal confirm variant (Keep it / Delete) |  click × |
| Error | `mn-msg--error` above the list; existing tasks stay visible | — |
