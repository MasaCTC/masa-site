# NavBar

The site header: a floating, sticky pill that stays 16px below the top of the window while the page scrolls under it. It is the most raised thing on the page (`neu-raised-lg`) and slightly translucent with a background blur, so content visibly passes beneath it.

**Markup**: `<nav class="mn-nav" aria-label="Main">` → `<a class="mn-nav__brand" href="/"><span class="mn-nav__mark" aria-hidden="true">MC</span>Masa Chien</a>` + `<div class="mn-nav__right">` holding an optional live stat chip `<a class="mn-nav__stat" href="/stats">10.2K <span>followers</span></a>` and `<div class="mn-nav__links">` of `<a href>` (current page: `aria-current="page"`).

**Variants**
- **`mn-nav--dock` — the site header (decided Oct 11, 2026).** Compact capsule centered over the page: MC badge (links home, `aria-label="Masa Chien, home"`), the three links, and the live follower chip. Use this on every page.
- Default (float): full-width pill. Explored, not used.
- Split: wrap a brand capsule (`mn-nav__brand mn-nav__brand--capsule`) and a `mn-nav` of links in `<div class="mn-navsplit">`.

On phones the pill becomes a rounded rectangle and the links wrap under the brand (no hamburger: only 3 links). Without `backdrop-filter` support it falls back to a solid surface.

| State | Look | Trigger |
|---|---|---|
| Default | Floating pill, `neu-raised-lg`; links `ink-muted` | — |
| Hover | Link → `ink` | `:hover` / `.is-hover` |
| Pressed / current | `neu-inset-sm`, sunken fill, `ink` | `aria-current="page"` |
| Focus | 3px `focus-ring` outline on the link, brand or stat chip | `:focus-visible` / `.is-focus` |
| Disabled | N/A: never link to a page that doesn't exist | — |
| Loading | Stat chip shows `—` until the first pull | — |
| Empty | N/A | — |
| Error | Stat chip keeps the last good number (the Stats page explains the error) | — |
