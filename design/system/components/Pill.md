# Status label (formerly Pill)

A read-only status word set in the status color: plain uppercase mono text, with no capsule and no dot (changed Oct 2026, because the pills read as generic and "vibe-coded"). Variants: `--building` (green), `--scoping` (blue), `--dead` (grey), `--live` (green), and no modifier for muted (e.g. "Manual"). Extra detail goes in a `<small>` on the same line: `Manual · entered by hand · updated Oct 11, 2026`.

**Markup**: `<span class="mn-state mn-state--building">Building</span>`. The word is always present, so color is never the only signal. `.mn-pill` / `.mn-pill--*` still work as aliases and render the new look; new markup should use `.mn-state`.

| State | Look | Trigger |
|---|---|---|
| Default | Status-color uppercase mono, 12px, .08em tracking | — |
| Hover / Pressed / Focus | N/A: not interactive. Need a clickable chip? That is a Tag | — |
| Disabled | N/A: use `--dead` for retired things | — |
| Loading | N/A: the page's own loading state covers it (no pulsing dot any more) | — |
| Empty | N/A: no status, no label | — |
| Error | N/A: errors are Feedback messages | — |
