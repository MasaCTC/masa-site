# Meter

One ratio against a whole, as a filled inset track with the number printed: degree progress, build phase 2 of 6, top reel's share of all views.

**Markup**: `<div class="mn-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="43" aria-label="Degree progress">` → `.mn-meter__head` (label + `.mn-meter__value` "43%") → `.mn-meter__track` with `.mn-meter__fill` (`width: calc((100% - 8px) * 0.43)`).

Fill is `chart-point` blue; the track is the sunken surface. Always print the number. Never a pie or donut for a single ratio.

| State | Look | Trigger |
|---|---|---|
| Default | Fill + printed value | — |
| Hover / Pressed / Focus / Disabled | N/A: read-only, value printed | — |
| Loading | Track with skeleton, value `—` | `mn-skel` |
| Empty | Value `—` and a muted line saying why | — |
| Error | Feedback error line under the track | `mn-msg--error` |
