# Calendar (week + month)

Two views behind a sliding Tabs control. **Week**: 7 day columns, Sunday to Saturday (`.mn-week > .mn-day`), today raised, others inset, a load bar for estimated hours (8h = full), then task chips (`button.mn-due`). **Month**: a Sunday-first 7-column grid (Sun on the left, Sat on the right, US convention) (`.mn-month`) of day cells (`.mn-cell`); days outside the month are dashed and transparent; today is raised. Each cell shows up to 3 task chips (`button.mn-cell__item`) then "+N more" (jumps to that week). Prev / Next / Today buttons; next goes as far ahead as you like.

Task chips carry the class color: `style="--c: var(--cls-sea)"` gives a 14-16% tint plus a swatch; the title is always text. Hover lifts a chip 1px with `neu-raised-sm`; click or Enter opens the task Modal. Undated tasks never appear here. The Calendar is where you pick what goes on Today: a chip already on Today shows a small check (`svg.mn-listed`) before its title and `.is-listed` (bolder title; week chips add "on Today" to their meta line). The mono note under the grid explains the check: "✓ = on Today · click anything to add it to Today".

| State | Look | Trigger |
|---|---|---|
| Default | As above | — |
| Hover | Chip lifts | `:hover` |
| Pressed | Opens Modal | click / Enter |
| Focus | 3px `focus-ring` around the chip | `:focus-visible` |
| Disabled | N/A | — |
| Loading | Grid with skeleton chips | — |
| Empty | Cells stay; week columns say "nothing due" | — |
| Error | `mn-msg--error` above the grid | — |
