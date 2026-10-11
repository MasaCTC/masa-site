# Card

The base container: a raised surface at `radius-lg`. Variants: `--link` (whole card is a link, lifts on hover), `--inset` (a well), `--lg` (more padding), and `--dead` (retired project).

**Markup**: `<article class="mn-card">`; clickable: `<a class="mn-card mn-card--link" href>`. Rows inside: `mn-card__row`.

| State | Look | Trigger |
|---|---|---|
| Default | `neu-raised-md` | — |
| Hover | (`--link` only) lifts to `neu-raised-lg`, 2px up | `:hover` / `.is-hover` |
| Pressed | (`--link` only) `neu-inset-sm` | `:active` / `.is-pressed` |
| Focus | (`--link` only) 3px `focus-ring` outline around the card | `:focus-visible` / `.is-focus` |
| Disabled | Flat + dashed edge, `ink-disabled` text. Rare: use for "coming soon" slots only | `.is-disabled` |
| Loading | Same card, contents replaced by Feedback skeleton bars matching the final layout | skeletons inside |
| Empty | Same card, a Feedback empty message ("No projects yet") | message inside |
| Error | Same card, a Feedback error message + "Try again" secondary button | message inside |

## Dead variant (`mn-card--dead`)

For projects that are retired but stay visible. It is the only card that is FLAT (`neu-flat`): no depth means not alive. A dashed `status-dead` edge, the title struck through in `ink-muted`, a `dead` Pill, and an **epitaph** block (`mn-epitaph`): a label "Why it died" and one honest sentence in full `ink` so it stays readable. Never fade the whole card below 4.5:1.
