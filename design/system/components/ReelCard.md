# ReelCard

A top-reel card: a 9:12 inset thumbnail with a rank badge and the view count floating on a raised label, then likes / shares / saves in a 3-column metric list and a 2-line caption.

**Markup**: `<a class="mn-reel" href="https://instagram.com/reel/…">` → `.mn-reel__thumb` (`<img>` from the API's `thumbnail_url`, or the placeholder) with `.mn-reel__rank` and `.mn-reel__views`, then `<dl class="mn-reel__metrics">`, then `<p class="mn-reel__cap">`.

| State | Look | Trigger |
|---|---|---|
| Default | `neu-raised-md` | — |
| Hover | Lifts to `neu-raised-lg` (same as Card `--link`) | `:hover` / `.is-hover` (add `mn-card--link`) |
| Pressed | `neu-inset-sm` | `:active` / `.is-pressed` |
| Focus | 3px `focus-ring` outline | `:focus-visible` / `.is-focus` |
| Disabled | N/A: a reel that can't be linked is still shown, just not wrapped in `<a>` | — |
| Loading | Thumb and metrics as skeletons, same size | skeletons |
| Empty | Fewer than 3 reels: the missing slots show "Post more reels to fill this" in an inset well (no fake reels) | message |
| Error | Thumbnail failed to load: inset thumb with "Preview unavailable" in mono; numbers still show | text in thumb |
