# Modal

A centered card that floats over a dimmed, blurred page. Uses `neu-float` (plain drop shadow, no light half), because a neumorphic highlight over a backdrop reads as a glow. Buttons inside use `neu-raised-sm`.

**Markup**: native `<dialog class="mn-modal" aria-labelledby="…">` opened with `showModal()`, containing `.mn-modal__in` → head (label + title + close ×), a `dl.mn-facts` of label/value pairs, then actions. Escape and a click on the backdrop close it; focus returns to the element that opened it.

| State | Look | Trigger |
|---|---|---|
| Open | Scales in from .96 over 180ms (none with reduced motion) | `[open]` |
| Hover / Pressed / Focus | On its buttons, per Button | — |
| Disabled | N/A | — |
| Loading | Skeleton lines in the facts list | — |
| Empty | N/A | — |
| Error | `mn-msg--error` above the actions | — |
