# Timeline

A vertical, expandable resume timeline: an inset spine, a raised node per entry, and a raised header button that sinks in when open to reveal bullet details.

**Markup**: `<ol class="mn-timeline">` → `<li class="mn-tl">` → `<span class="mn-tl__node">` (icon) + `<button class="mn-tl-head" aria-expanded aria-controls>` holding `.mn-tl__title`, `.mn-tl__sub`, `.mn-tl__when`, chevron `.mn-tl__chev` → `<div class="mn-tl__body" id>` with a `<ul>` and Tags for the skills used. `.is-current` = ongoing (blue ring), `.is-dim` = filtered out by a skill Tag.

| State | Look | Trigger |
|---|---|---|
| Default (closed) | Header `neu-raised-sm` | `aria-expanded="false"` |
| Hover | Header lifts to `neu-raised-md` | `:hover` / `.is-hover` |
| Pressed / open | Header `neu-inset-sm` + sunken fill, chevron flips, body shows | `:active`, `aria-expanded="true"` |
| Focus | 3px `focus-ring` outline on the header | `:focus-visible` / `.is-focus` |
| Disabled | Filtered out by skill: entry fades to 38% but stays in place and stays readable for the title (never removed, so the timeline keeps its shape) | `.is-dim` |
| Loading | N/A: static resume content | — |
| Empty | A filter matched nothing: Feedback empty message above the list ("Nothing tagged Java yet") | message |
| Error | N/A: static | — |
