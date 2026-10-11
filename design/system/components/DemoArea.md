# DemoArea

The inset well on a project card that shows what exists right now. Exactly one of three modes:

1. **Live** — a raised preview frame (screenshot or poster) + a "Try the live demo" link. A `Live` pill if it's deployed.
2. **Clip** — a video/GIF in the frame (`<video muted loop playsinline>` with a poster), a raised play button, and the clip length in mono.
3. **No demo yet** — up to three phone-shaped screenshot slots and the honest line "No demo yet. Screenshots from the current build." Never a fake demo.

**Markup**: `<div class="mn-demo">` → `.mn-demo__media` (or `.mn-demo__shots` with `.mn-demo__shot` ×3) + `.mn-demo__bar`.

| State | Look | Trigger |
|---|---|---|
| Default | One of the three modes | — |
| Hover | On the play button / link: their own hover (Button, Link) | — |
| Pressed | Play button sinks (`neu-inset-sm`) | — |
| Focus | Play button or link shows the 3px `focus-ring` | — |
| Disabled | N/A: if the demo is down, use Error | — |
| Loading | Frame as a skeleton, same aspect ratio (no layout jump) | skeleton in media |
| Empty | Mode 3 IS the empty state | — |
| Error | Clip failed to load or demo is down: `danger` message in the frame + fall back to screenshots | message |
