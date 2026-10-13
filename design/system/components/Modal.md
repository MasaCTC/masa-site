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

Destructive actions (delete task, delete class, remove Canvas feed) ask first with the same Modal: title "Delete \"{task}\"?", one plain sentence on what happens, then **Keep it** (default focus) and **Delete** (`mn-btn`, label in `danger`). Never red: red is only the primary CTA. Escape or backdrop click = Keep it.
