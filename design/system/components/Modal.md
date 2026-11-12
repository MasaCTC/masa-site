# Modal

A centered card that floats over a dimmed, blurred page. The dim layer is the `scrim` token (darker than the page in both themes). Uses `neu-float` (plain drop shadow, no light half), because a neumorphic highlight over a backdrop reads as a glow. Buttons inside use `neu-raised-sm`.

**Markup**: native `<dialog class="mn-modal" aria-labelledby="…">` opened with `showModal()`, containing `.mn-modal__in` → head (label + title + close ×), a `dl.mn-facts` of label/value pairs, then actions. Escape and a click on the backdrop close it; focus returns to the element that opened it.

| State | Look | Trigger |
|---|---|---|
| Open | Scales in from .96 over 180ms (none with reduced motion) | `[open]` |
| Hover / Pressed / Focus | On its buttons, per Button | — |
| Disabled | N/A | — |
| Loading | Skeleton lines in the facts list | — |
| Empty | N/A | — |
| Error | `mn-msg--error` above the actions | — |

## Confirm variant

Destructive actions (delete task, delete class, remove Canvas feed) ask first with the same Modal plus `mn-modal--confirm` (420px wide, 24px padding): title "Delete \"{task}\"?" in `mn-heading-sm` (20px), one plain sentence in `mn-body-sm` (14px), then **Keep it** (default focus) and **Delete** (`mn-btn mn-btn--sm`, label in `danger`). Never red: red is only the primary CTA. Escape or backdrop click = Keep it.

## Pressed buttons

Pressing a button pushes it into the surface: the raised shadow turns into an inset well (`neu-inset-md`, or `neu-inset-sm` for the smaller buttons inside a modal) on `surface-sunken`. The footprint never changes: no scale, no translate. A button that only loses its shadow reads as shrinking, not pressing.

## Today action

The task Modal's first button toggles the running checklist: **Add to Today** (appends to the bottom of Today, live region "Added to the bottom of Today.") or **Take off Today**. The facts list has a "Today" row: "#3 of 8 on the list" or "Not on the list" (replaces the old "Priority" row).
