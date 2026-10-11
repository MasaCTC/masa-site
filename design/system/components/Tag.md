# Tag

A toggleable filter chip (skills filter on the resume): raised when off, pressed-in with a dot when on.

**Markup**: `<button class="mn-tag" aria-pressed="false|true">Python</button>` inside `<div class="mn-tags" role="group" aria-label="Filter by skill">`.

| State | Look | Trigger |
|---|---|---|
| Default (off) | `neu-raised-sm`, `ink-muted` label | `aria-pressed="false"` |
| Hover | Label to `ink` | `:hover` / `.is-hover` |
| Pressed / On | `neu-inset-sm`, sunken fill, `ink` dot before label. On is shown by dot + inset, not color | `:active`, `aria-pressed="true"` |
| Focus | 3px `focus-ring` outline | `:focus-visible` / `.is-focus` |
| Disabled | Flat, dashed edge, `ink-disabled` (e.g. a skill with no matching items) | `disabled` |
| Loading | N/A: filters act locally and instantly | — |
| Empty | A filter group with no tags is not rendered. If a filter matches nothing, the RESULTS show an empty Feedback message ("Nothing tagged C# yet"), not the tag | — |
| Error | N/A: local filter | — |

Use Pill (not Tag) for read-only status.
