# Field

A label plus a text input or select, pressed into the surface (`neu-inset-sm` on `surface-sunken`). Used by the planner's add-task row, the status setter and Settings.

**Markup**: `<div class="mn-field"><label class="mn-label" for="x">Due</label><input class="mn-input" id="x"></div>`. Selects use `.mn-select` (custom chevron). Use `.mn-input--mono` for dates, URLs and numbers. Every input has a visible label, or an `sr-only` label when the placeholder already says it (the quick-add box).

| State | Look | Trigger |
|---|---|---|
| Default | Inset well, `ink` text, `ink-subtle` placeholder | — |
| Hover | No change (the well is already the affordance) | — |
| Pressed | N/A | — |
| Focus | 3px `focus-ring` outline, 3px offset | `:focus-visible` |
| Disabled | `ink-disabled`, flat (`neu-flat`) | `disabled` |
| Loading | N/A on the field; the form's button shows the spinner | — |
| Empty | Placeholder text in `ink-subtle` | — |
| Error | `mn-msg--error` line under the field, `aria-describedby` pointing at it | `aria-invalid="true"` |
