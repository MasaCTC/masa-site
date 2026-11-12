# Status line

The public "what I'm on right now" line: a 12px dot plus a sentence in the display face. Shown large on `/now`, small in the planner's preview box. Templates: "Studying for {class}", "Building {thing}", "Free right now", or a task title Masa chose to share.

**Markup**: `<div class="mn-status"><span class="mn-status__dot"></span><span class="mn-status__text">Studying for ICS 46</span></div>`; add `.is-free` for the grey dot. Always followed by a mono "since 2:10 PM · updated 2:10 PM" line.

| State | Look | Trigger |
|---|---|---|
| Default (busy) | Green dot (`status-building`) | — |
| Free | Grey dot (`status-dead`) | `.is-free` |
| Hover / Pressed / Focus / Disabled | N/A: read-only | — |
| Loading | Skeleton line | — |
| Empty | "No status set" in `ink-subtle` | — |
| Error | Keep the last status, show "as of {time}" | — |
