# TimeLanes

A small Gantt: one lane per resume entry, a bar from start to end on a shared year axis, a blue "now" line. Shows overlap and length at a glance (e.g. coaching 2020–2024 alongside school and projects).

**Markup**: `<div class="mn-lanes" role="img" aria-label="…">` → `.mn-lanes__axis` (empty label cell + `.mn-lanes__ticks` with `<span style="left: x%">2022</span>` and `.mn-lanes__now`) → `.mn-lane` rows: `.mn-lane__label` + `.mn-lane__track` holding `.mn-lane__bar` (`left` / `width` in % of the axis span; ongoing entries `is-current`, ending at "now"). Pair it with the Timeline: it summarizes, the Timeline has the words.

| State | Look | Trigger |
|---|---|---|
| Default | Ink-muted bars; ongoing ones blue | `is-current` |
| Hover | Row label → `ink`, bar → `ink`; native tooltip with dates | `:hover` / `.is-hover` |
| Pressed / Focus | N/A: summary only; the Timeline below is the interactive part | — |
| Disabled | Filtered out by a skill Tag: row fades to 38% (same as Timeline) | `.is-dim` |
| Loading / Error | N/A: static resume content | — |
| Empty | N/A: never shown without entries | — |
