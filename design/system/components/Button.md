# Button

A raised neumorphic control that performs an action; `--primary` is the one red CTA per view.

**Markup**: `<button class="mn-btn">`, or `<a class="mn-btn" href>` when it navigates. Modifiers: `mn-btn--primary` (red), `mn-btn--ghost` (no depth until hover), `mn-btn--icon` (48px round, needs `aria-label`), `mn-btn--sm` (44px, still a full touch target).

| State | How it looks | How to trigger |
|---|---|---|
| Default | Raised `neu-raised-md` (primary: red fill) | — |
| Hover | Lifts to `neu-raised-lg`; primary goes `red-hover` | `:hover` / `.is-hover` |
| Pressed | Pushed into the surface: the raised shadow becomes an inset well (`neu-inset-md`; `neu-inset-sm` inside a modal) on `surface-sunken`. Same footprint: no scale, no translate. Primary: `red-pressed` + `neu-red-pressed` | `:active` / `.is-pressed` |
| Focus | 3px `focus-ring` outline, 4px offset | `:focus-visible` / `.is-focus` |
| Disabled | Flat (`neu-flat`), `ink-disabled` label, dashed edge. Primary loses its red: a disabled CTA must not pull the eye | `disabled` / `.is-disabled` + `aria-disabled` |
| Loading | Spinner replaces the icon, label says what is happening ("Preparing PDF…"), `aria-busy="true"`, keeps its size | `.is-loading` |
| Empty | N/A: a button always has a label. Never render an unlabeled button | — |
| Error | N/A on the button itself. Show the failure in a Feedback message next to it and keep the button enabled for retry ("Try again") | — |

**Rules**
- One primary per view. Everything else is secondary or ghost.
- Label = verb + object ("Download PDF", "Follow on Instagram"). No "Click here".
- Consumer provides: label text, optional leading icon (inline SVG), `href` or handler.
