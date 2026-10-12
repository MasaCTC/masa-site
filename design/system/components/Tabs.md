# Tabs

A segmented control in an inset rail; the selected tab is raised out of it by one sliding thumb. Used for chart ranges (30D / 90D / All) and the resume's Timeline / $ terminal toggle.

**Markup**: `<div class="mn-tabs" role="tablist" aria-label="Range">` with `<button class="mn-tab" role="tab" aria-selected="true|false">`.

| State | Look | Trigger |
|---|---|---|
| Default | Unselected: flat in the rail, `ink-muted`. Selected: `ink`, sitting on the raised thumb (`neu-raised-sm`) | `aria-selected` |
| Changing selection | The thumb slides from the old tab to the new one and resizes to it (340 ms, slight overshoot). The labels don't move. Reduced motion: it jumps. | click / arrow keys |
| Hover | Label to `ink` | `:hover` / `.is-hover` |
| Pressed | Sunken fill | `:active` / `.is-pressed` |
| Focus | 3px `focus-ring` outline around the tab | `:focus-visible` / `.is-focus` |
| Disabled | `ink-disabled` + strikethrough (e.g. "All" before enough history exists) | `disabled` |
| Loading | Rail stays; the newly selected tab is raised but its label goes `ink-subtle` while its panel loads; `aria-busy` on the panel | `.mn-tabs.is-loading` |
| Empty | N/A: never render a tablist with no tabs | — |
| Error | N/A on the tabs: the PANEL shows the error, tabs stay usable so the user can try another range | — |

## Sliding thumb

The raised piece is ONE element (`<span class="mn-thumb" aria-hidden="true">`, first child of `.mn-tabs`), not a style on the selected tab. A script measures the selected tab and sets `--thumb-x`, `--thumb-y`, `--thumb-w`, `--thumb-h` on the thumb; CSS animates between them. The script adds `.has-thumb` (turns off the tab's own raised fill) and, one frame later, `.is-thumb-ready` (turns on the transition, so the first paint doesn't animate in from 0,0). Re-measure on resize and once fonts load.

Without the script, the selected tab keeps its own `neu-raised-sm`, so the control still works and still shows the selection. The thumb is decorative: selection is carried by `aria-selected` and the `ink` label.

Reference script: `design/system/thumb.js` (`mnThumb(container, getTarget)`). Port it into a React hook; keep the behaviour.
