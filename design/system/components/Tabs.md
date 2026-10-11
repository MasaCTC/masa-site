# Tabs

A segmented control in an inset rail; the selected tab is raised out of it. Used for chart ranges (30D / 90D / All) and the resume's Recruiter / Story toggle.

**Markup**: `<div class="mn-tabs" role="tablist" aria-label="Range">` with `<button class="mn-tab" role="tab" aria-selected="true|false">`.

| State | Look | Trigger |
|---|---|---|
| Default | Unselected: flat in the rail, `ink-muted`. Selected: `neu-raised-sm`, `ink` | `aria-selected` |
| Hover | Label to `ink` | `:hover` / `.is-hover` |
| Pressed | Sunken fill | `:active` / `.is-pressed` |
| Focus | 3px `focus-ring` outline around the tab | `:focus-visible` / `.is-focus` |
| Disabled | `ink-disabled` + strikethrough (e.g. "All" before enough history exists) | `disabled` |
| Loading | Rail stays; the newly selected tab is raised but its label goes `ink-subtle` while its panel loads; `aria-busy` on the panel | `.mn-tabs.is-loading` |
| Empty | N/A: never render a tablist with no tabs | — |
| Error | N/A on the tabs: the PANEL shows the error, tabs stay usable so the user can try another range | — |
