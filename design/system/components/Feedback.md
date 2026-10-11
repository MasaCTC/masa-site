# Feedback

The shared loading / empty / error vocabulary every other component uses: `mn-spinner`, `mn-skel` (inset skeleton bar), and `mn-msg` (icon + sentence; `--error` adds the `danger` color).

**Rules**
- Loading keeps the final layout's size: skeletons match the real content's shape, so nothing jumps when data arrives. Spinners only inside buttons or next to a sentence that says what is loading.
- Empty states say why and what happens next ("Growth shows after 2 days of data"). No illustrations, no fake data.
- Errors use `danger` (burnt amber) + an icon + a plain sentence + a way out ("Try again", or the last good timestamp). Never the CTA red. Errors get `role="alert"`.
- `prefers-reduced-motion`: pulses and spins stop.

| State | Applies as |
|---|---|
| Default / Hover / Pressed / Focus / Disabled | N/A: Feedback is not interactive; its retry action is a Button |
| Loading | `mn-spinner`, `mn-skel` |
| Empty | `mn-msg` |
| Error | `mn-msg mn-msg--error` |
