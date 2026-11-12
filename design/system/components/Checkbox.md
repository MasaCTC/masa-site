# Checkbox

A 24px rounded square. Unchecked: pressed in (`neu-inset-sm`). Checked: raised (`neu-raised-sm`) with an `ink` check mark, so the depth flips as well as the mark.

**Markup**: `<input type="checkbox" class="mn-box" aria-label="Done: Problem set 4">`. It is a native checkbox, so Space toggles it and screen readers announce it.

| State | Look | Trigger |
|---|---|---|
| Default | Inset square | — |
| Hover | Cursor pointer | `:hover` |
| Pressed / checked | Raised, check mark | `:checked` |
| Focus | 3px `focus-ring` outline | `:focus-visible` |
| Disabled | Flat, no shadow | `disabled` |
| Loading / Empty / Error | N/A | — |
