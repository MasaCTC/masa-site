# Chart

A line chart in an inset well (follower growth). One line in `chart-line` (ink) over a 7% area fill, three hairline gridlines in `line`, mono axis labels in `ink-subtle`, a hover guide + point in `chart-point` (blue) with a raised tooltip.

**Markup**: `<figure class="mn-chart">` → inline `<svg role="img" aria-label="Followers grew from 1.1K to 10.2K over 90 days">` with classes `grid`, `axis`, `area`, `line`, `pt`, `guide`; tooltip `<div class="mn-chart__tip">`. Pair with Tabs for the range above it. Always give the chart a text summary in `aria-label`.

Rules: no legend for one series; label the end value directly; gridlines only at round numbers (0 / 5K / 10K); y-axis starts at 0 (honest scale). An annotation (e.g. the viral reel) is a small label + dashed guide, never a red marker.

| State | Look | Trigger |
|---|---|---|
| Default | Line + area, latest point marked | — |
| Hover | Dashed vertical guide, ringed point, tooltip with date + exact value | pointer over plot / `.is-hover` |
| Pressed | N/A: tap = hover on touch | — |
| Focus | The plot is focusable (`tabindex="0"`); arrow keys move the point; focus draws the 3px `focus-ring` around the well | `:focus-visible` |
| Disabled | N/A | — |
| Loading | Well keeps its size (no layout jump); skeleton line + "Pulling from Instagram…" with spinner | `__center` content |
| Empty | "Not enough history yet. Growth shows after 2 days of data." | `__center` content |
| Error | `danger` message + "Try again" secondary button; last good timestamp if any | `__center` content |
