# BarList

Horizontal bars to compare a handful of values at a glance (top reels by views; likes vs shares vs saves). Label left, inset track, value right in mono.

**Markup**: `<ol class="mn-bars" aria-label="Top reels by views">` → `<li class="mn-bar" title="Reel 1 · 4,100,000 views">` with `.mn-bar__label`, `<span class="mn-bar__track"><span class="mn-bar__fill" style="width: calc((100% - 8px) * 0.68)"></span></span>`, `.mn-bar__value`. The fill width = value ÷ the largest value in the list (or the stated total), so bars share one honest scale starting at 0.

Rules: one hue. The leader gets `is-top` (ink); the rest `ink-muted`; hover turns a bar `chart-point` blue. Every bar shows its number, so color never carries meaning alone. Max ~7 rows; more → a table. On phones the track drops under the label.

| State | Look | Trigger |
|---|---|---|
| Default | Bars on a shared 0-based scale | — |
| Hover | Fill → `chart-point`, label → `ink`, native tooltip with the exact value | `:hover` / `.is-hover` |
| Pressed | N/A: read-only | — |
| Focus | N/A: not focusable; the exact values are already printed | — |
| Disabled | N/A | — |
| Loading | Tracks stay, fills replaced by skeleton, values `—` | `aria-busy` + `mn-skel` |
| Empty | Feedback message instead of the list ("No reels yet") | `mn-msg` |
| Error | Feedback error message | `mn-msg--error` |
