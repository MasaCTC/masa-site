# ProgressTrack

A project's build map: phases as raised dots on an inset groove. Done phases have a filled dot; the current phase gets a blue ring (`status-scoping`) and a bold name; upcoming phases stay quiet. General, not detailed: phase names only, no dates or percentages.

**Markup**: `<ol class="mn-track" aria-label="Build map">` → `<li class="mn-phase is-done|is-current">` with `<span class="mn-phase__dot"></span><span class="mn-phase__name">Vertical slice</span>`; current phase also gets `aria-current="step"`. Optional `<li class="mn-track__fill" aria-hidden="true" style="width: calc(100% / N * currentIndex)">` behind the dots up to the current one. On phones use `mn-track--vertical`, or add `mn-track--stack-sm` to a horizontal track so it turns vertical under 640px automatically.

| State | Look | Trigger |
|---|---|---|
| Default | Groove + dots; done / current / upcoming | `is-done`, `is-current` |
| Hover / Pressed / Focus | N/A: the map is read-only. Phase detail lives on the project page | — |
| Disabled | N/A: a retired project keeps its map as it was (on a flat dead card) | — |
| Loading | N/A: static content from the repo | — |
| Empty | Only one phase defined ("scoping"): the groove becomes a dashed outline with the one dot; text "Phases get mapped after scoping" | `.is-empty` |
| Error | N/A | — |
