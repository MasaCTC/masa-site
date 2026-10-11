# Link

An inline text link: ink, 2px underline 4px below the baseline, optional trailing arrow for external links.

**Markup**: `<a class="mn-link" href>`; external links add the arrow-up-right SVG and `rel="noopener"`.

| State | Look | Trigger |
|---|---|---|
| Default | `ink` text, `ink-subtle` underline | — |
| Hover | Underline darkens to `ink` | `:hover` / `.is-hover` |
| Pressed | Text drops to `ink-muted` | `:active` / `.is-pressed` |
| Focus | 3px `focus-ring` outline | `:focus-visible` / `.is-focus` |
| Disabled | `ink-disabled`, dashed underline, `aria-disabled="true"`, no `href` | `.is-disabled` |
| Loading | N/A: links navigate immediately; the destination shows its own loading state | — |
| Empty | N/A: a link with no destination is not rendered (e.g. no demo URL → DemoArea shows "no demo yet") | — |
| Error | N/A: broken destinations are fixed at the source, not styled | — |

Links are never the only thing colored red: red belongs to the primary button.
