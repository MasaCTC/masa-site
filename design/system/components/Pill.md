# Pill

A read-only status label pressed into the surface: colored dot + uppercase word. Variants: `--building` (green), `--scoping` (blue), `--dead` (grey, dash instead of dot), `--live` (pulsing dot, for "live" data).

**Markup**: `<span class="mn-pill mn-pill--building">Building</span>`. The word is always present: color is never the only signal.

| State | Look | Trigger |
|---|---|---|
| Default | `neu-inset-sm`, status color text + dot | — |
| Hover / Pressed / Focus | N/A: pills are not interactive. Need a clickable chip? That is a Tag | — |
| Disabled | N/A: use `--dead` for retired things | — |
| Loading | `--live` pulses while data is fresh-pulling; otherwise N/A | `.mn-pill--live` |
| Empty | N/A: no status → no pill | — |
| Error | N/A: errors are Feedback messages, not pills | — |
