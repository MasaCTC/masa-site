# StatTile

One headline number: an uppercase label, the value in the mono face, and a meta line (change or source). `--md` is the smaller size.

**Markup**: `<div class="mn-stat">` → `<span class="mn-label">Followers</span>` `<span class="mn-stat__value">10.2K</span>` `<span class="mn-stat__delta">+1,180 · 30d</span>` or `<span class="mn-stat__meta">`.

**Sparkline (default on every tile that has history)**: after the meta line, `<svg class="mn-spark" viewBox="0 0 120 36" role="img" aria-label="Followers, last 90 days: 1.1K → 10.2K">` with `<line class="base">`, `<path class="line">` (13 points, `ink-subtle`) and `<circle class="pt">` on the latest point (`chart-point` blue). The tile's number is the headline; the sparkline only shows the shape. The aria-label states start and end.

Number format: under 10,000 show the full number with a comma; 10K and up, one decimal + K/M (10.2K, 6.0M). Give the exact value in `title`/`aria-label` ("10,214 followers").

| State | Look | Trigger |
|---|---|---|
| Default | `neu-raised-md`, `ink` value | — |
| Hover | N/A: tiles are read-only. If a tile ever links somewhere, wrap it as a Card `--link` | — |
| Pressed | N/A (read-only) | — |
| Focus | N/A (not focusable) | — |
| Disabled | N/A: a metric is either available, loading, empty or errored | — |
| Loading | Label stays; value and meta become skeleton bars; `aria-busy="true"` | skeletons |
| Empty | Value `—` in `ink-subtle`, meta explains ("No data yet") | `.is-empty` |
| Error | Tile sinks to `neu-inset-sm`, value `—`, meta is a `danger` message ("Couldn't reach Instagram") | `.is-error` |

Delta uses `status-building` (green) only for growth and is always prefixed with + or −; never red.
