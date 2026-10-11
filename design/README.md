# Design handoff — masa-site

Exported from Claude Design (canvas "Masa — Personal Site", design system "Masa Neu"). This folder is the **source of truth for every visual decision**. Do not invent styling: if something isn't covered here, stop and ask.

## What's here

| Path | What it is |
|---|---|
| `system/tokens.css` | All design tokens as CSS variables (colors for light + dark via `[data-theme]`, shadows, spacing, radius, fonts). |
| `system/bundle.css` | Every component as plain CSS classes (prefix `mn-`). Screens must be built only from these. |
| `system/tokens.json` | Same tokens as data (for reference). |
| `system/README.md` | Design rules: neumorphism, red = primary button only, contrast + focus rules, type. |
| `system/components/*.md` | One guideline per component, including all 8 states (default, hover, pressed, focus, disabled, loading, empty, error). |
| `screens/*.dc.html` | The approved screens. Each is an HTML file with a small `<script>` holding its data/logic. Read the markup for structure and class usage; read the script for data shapes and interactions. |

## Approved screens → routes

| Screen file | Route | Notes |
|---|---|---|
| `HomeA.dc.html` | `/` | Use the **dock** header variant (the `navDock` block). Ignore the `float` / `split` variants and the `tagline` tweak; use tagline 1. |
| `Stats.dc.html` | `/stats` | Has live / loading / error / empty states driven by a `status` value. Range tabs 30D / 90D / All. Chart hover + arrow-key focus. |
| `Projects.dc.html` | `/projects` | One Basket demo area supports 3 modes: clip / live / none. PullPilot uses the dead card variant. |
| `Resume.dc.html` | `/resume` | Timeline tab (default) + `$ terminal` tab. Skill tags in the Skills card filter the timeline and time lanes. |
| `Main.dc.html`, `States.dc.html` | — | Reference only: token sheet and every component in every state. Not routes. |

## Things that are NOT in the screen files

- `{{…}}` holes, `<sc-if>`, `<sc-for>`, `data-props`, `<x-dc>`, `<helmet>`, `support.js` are the design tool's template syntax. Translate them into React (conditionals, `.map`, props). Don't copy them literally.
- "Tweaks" (`theme`, `typeSet`, `header`, `tagline`, `oneBasketDemo`, `status`, `startView`) are design-time switches. Final decisions: **type = A (Space Grotesk + IBM Plex Mono)**, header = **dock**, light theme default with a dark theme available via `data-theme="dark"` on `<html>`.
- Fonts load from Google Fonts in the mocks; in Next.js use `next/font/google` (Space Grotesk, IBM Plex Mono) and map them to `--font-display`, `--font-body`, `--font-mono`.

## Data that is placeholder

All Instagram numbers (10.2K followers, 6.0M views, 412K likes, 73.5K shares, 41.3K saves, reel figures, follower series) are **placeholders**. Bracketed text like `[START]`, `[REEL 1 THUMBNAIL]`, `[SCREEN 1]` marks content Masa will supply later. Keep the brackets visible; don't fabricate values.
