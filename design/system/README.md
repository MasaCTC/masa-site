# Masa Neu — design system

The design system for Masa Chien's personal site (Next.js on Vercel): Instagram stats from @masamcodes, projects with honest build maps, and an interactive resume. Visitors come mostly from Instagram, plus recruiters.

## Voice

Down-to-earth and honest. Real numbers, no hype.

- Do: say what is true right now ("building", "scoping", "dead"). Show the date a number was pulled. Admit what broke.
- Don't: guru phrasing ("10x your…", "secrets"), superlatives, exclamation marks, emoji, fake urgency.
- Numbers are shown as data: mono face, tabular figures, with units and a timestamp nearby.

## Visual foundations

**Neumorphism on one base color.** Every surface is the `surface` token (warm bone `#ece6dd` in light, graphite `#2b2722` in dark). Depth comes only from the shadow tokens. One light source, top-left:

| Depth | Token | Means |
|---|---|---|
| Raised | `neu-raised-sm / md / lg` | Something you can act on or read as an object (button, card, tile). `lg` = hover lift. |
| Inset | `neu-inset-sm / md` | A well that holds content (chart, demo, terminal) or a control that is pressed / selected. |
| Flat | `neu-flat` | Not alive: disabled controls and the retired (dead) project card. |

Never hand-write a shadow in a screen. If a new depth is needed, add a token.

Dark theme highlight (`shadow-light` dark) is `#332f29`, toned down on Oct 11, 2026 from `#3a352f` because it read as a glow around raised things.

**Motion: selection slides.** Where one item out of a row is selected (Tabs, the dock NavBar), the raised piece is a single thumb that slides to the new item and morphs to its size (340 ms, `cubic-bezier(.3, .8, .25, 1.06)`, a slight overshoot). Nothing else on the site animates position. Respect `prefers-reduced-motion`: the thumb jumps.

**One red.** `red` is the fill of the primary button and nothing else: one per view, so the eye goes there. Errors use `danger` (burnt amber), status uses the `status-*` colors, the current build phase uses `status-scoping` (blue). Red never marks data.

**Contrast rules** (neumorphism is famous for failing these, so they are hard rules):
- All text uses `ink`, `ink-muted` or `ink-subtle`: each is at least 4.5:1 on `surface` and `surface-sunken` in both themes. Nothing lighter, ever, except `ink-disabled` on disabled controls.
- Controls are never identified by shadow alone: buttons have a text label, tabs have a selected fill, toggles show a dot, disabled controls go flat AND get a dashed edge.
- Focus: `outline: 3px solid var(--focus-ring); outline-offset: 4px` on every focusable element. `focus-ring` is near-black in light, near-white in dark. It is the strongest edge on the page on purpose.
- Status pills carry a text label, not only a color; status colors also differ in lightness.

**Radius**: `radius-md` (16) for controls, `radius-lg` (24) for cards, `radius-pill` for pills, dots and icon buttons. Soft but not bubbly.

**Spacing**: 4-based scale `space-1`…`space-9`. Phone side gutter `space-4` (16px), desktop gutter `space-6` (32px), between sections `space-7` (48px).

## Typography

**Decided (Oct 11, 2026): Option A.** Pairing: **Space Grotesk** for display and body, **IBM Plex Mono** for every number, timestamp and terminal line. Families are tokens (`--font-display`, `--font-body`, `--font-mono`), so a pairing can be swapped in one place. B and C were explored and not chosen; they stay in `bundle.css` only as a record and should not be used on the site:

| Option | Display | Body | Numbers |
|---|---|---|---|
| A · Builder (default) | Space Grotesk | Space Grotesk | IBM Plex Mono |
| B · Rounded | Nunito | Nunito | Nunito, tabular figures |
| C · Editorial | Instrument Serif | Instrument Sans | IBM Plex Mono |

Switch pairing with `data-type="a|b|c"` on `<html>` (or any ancestor); `bundle.css` re-points the three font variables. All are Google Fonts: load them with one `fonts.googleapis.com/css2` link (in Next.js: `next/font/google`).

## Components

All components are plain CSS classes in `components/bundle.css` (prefix `mn-`), built only from tokens. Screens are composed ONLY from these; layout helpers (`mn-page`, `mn-section`, `mn-grid`, `mn-row`) cover page structure. Each component documents all 8 states: default, hover, pressed, focus, disabled, loading, empty, error. Where a state cannot apply (a pill is not pressable), its README says so and why.

| Group | Components |
|---|---|
| Actions | Button, Link, Tag, Tabs |
| Containers | Card (incl. dead variant), NavBar |
| Data | StatTile (with sparkline), Chart, BarList, Meter, ReelCard |
| Projects | Pill, ProgressTrack, DemoArea |
| Resume | Timeline, TimeLanes, Terminal |

**Show numbers as graphics.** Wherever a number has history or a comparison, pair it with a graphic: stat tiles carry a sparkline, comparisons use a BarList, ratios use a Meter, time spans use TimeLanes. One hue for data (ink / ink-muted), `chart-point` blue for "latest" or "hovered". The number is always printed next to its graphic.
| Feedback | Feedback (spinner, skeleton, state message) |

Every class with a hover/pressed/focus rule also accepts `.is-hover`, `.is-pressed`, `.is-focus` so a state can be shown statically (spec sheets, visual tests).

## Iconography

Inline stroke SVGs, 1.75px stroke, `currentColor`, 16–20px. No emoji. No third-party logos: Instagram and GitHub links are text links with an arrow.

## Moving to Next.js

Copy `tokens.css` (generated from `tokens.json`) and `components/bundle.css` into `app/`, import both in `layout.tsx`, set `data-theme="light|dark"` on `<html>`. Wrap each class set in a tiny React component (`<Button variant="primary">`) so screens never spell class names by hand.
