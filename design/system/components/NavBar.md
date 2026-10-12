# NavBar

The site header: a floating, sticky pill that stays 16px below the top of the window while the page scrolls under it. It is the most raised thing on the page (`neu-raised-lg`) and slightly translucent with a background blur, so content visibly passes beneath it.

**Markup**: `<nav class="mn-nav" aria-label="Main">` → `<a class="mn-nav__brand" href="/"><span class="mn-nav__mark" aria-hidden="true">MC</span>Masa Chien</a>` + `<div class="mn-nav__right">` holding an optional live stat chip `<a class="mn-nav__stat" href="/stats">10.2K <span>followers</span></a>` and `<div class="mn-nav__links">` of `<a href>` (current page: `aria-current="page"`).

**Variants**
- **`mn-nav--dock` — the site header (decided Oct 11, 2026).** Compact capsule centered over the page: MC badge (links home, `aria-label="Masa Chien, home"`), the three links, and the follower chip. Use this on every page.
- **Sliding thumb (dock, added Oct 11, 2026).** The raised circle behind "MC" is the current-page marker. On Home it sits on the badge; on any other page it has slid over and stretched into a pill behind that link. The badge and links themselves are flat. The current item is RAISED (it used to be inset). The follower chip stays inset: it's a readout, not a place.
- Default (float): full-width pill. Explored, not used.
- Split: wrap a brand capsule (`mn-nav__brand mn-nav__brand--capsule`) and a `mn-nav` of links in `<div class="mn-navsplit">`.

On phones the pill becomes a rounded rectangle and the links wrap under the brand (no hamburger: only 3 links). Without `backdrop-filter` support it falls back to a solid surface.

| State | Look | Trigger |
|---|---|---|
| Default | Floating pill, `neu-raised-lg`; links `ink-muted` | — |
| Hover | Link → `ink` | `:hover` / `.is-hover` |
| Current | On the raised thumb (`neu-raised-sm`), `ink`. Home: `aria-current="page"` on the brand link, thumb sits on the 44px badge. Other badge states: flat, `ink-muted` letters | `aria-current="page"` |
| Changing page | Thumb slides from the old item to the clicked one and morphs size (circle ↔ pill), 340 ms. Move it on click so it feels instant; settle it on the new pathname. Reduced motion: it jumps. | click / route change |
| Pressed | Link label `ink` (no extra depth; the thumb is about to arrive) | `:active` |
| Focus | 3px `focus-ring` outline on the link, brand or stat chip | `:focus-visible` / `.is-focus` |
| Disabled | N/A: never link to a page that doesn't exist | — |
| Loading | Stat chip shows `—` until the first pull | — |
| Empty | N/A | — |
| Error | Stat chip keeps the last good number (the Stats page explains the error) | — |

## Sliding thumb

Same mechanism as Tabs: ONE `<span class="mn-thumb" aria-hidden="true">` as the first child of the dock `nav`, positioned by a script that measures the target and sets `--thumb-x/-y/-w/-h`. Target = the element with `aria-current="page"`; if that's the brand link, measure its `.mn-nav__mark` (the 44px circle), not the whole link. `.mn-nav` is `position: sticky`, which already anchors the thumb.

The nav must live in the shared layout so it is NOT re-mounted on navigation: that is what lets the thumb travel from the old page's item to the new one instead of appearing in place.

Without the script, the current link is raised on its own and the badge keeps its own raised circle. On phones the dock wraps to two rows; the thumb measures `y` too, so it still lands on the right item.
