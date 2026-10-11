# Terminal

A command-palette resume: an inset well of mono output, a raised input line with a `$` prompt, and clickable command chips (Tags in mono) so recruiters never have to type.

**Markup**: `<section class="mn-term" aria-label="Resume terminal">` → `.mn-term__out` (`role="log" aria-live="polite"`) lines using `.mn-term__prompt`, `.mn-term__muted`, `.mn-term__ok`, `.mn-term__err` → `<label class="mn-term__line">` with `<span>$</span><input aria-label="Command">` → `.mn-term__chips` of `<button class="mn-tag">`.

Commands: `help`, `whoami`, `projects`, `experience`, `skills`, `skills --filter python`, `resume.pdf`, `clear`.

| State | Look | Trigger |
|---|---|---|
| Default | Output + idle input with blinking caret placeholder | — |
| Hover | Chips: Tag hover | — |
| Pressed | Chips: Tag pressed | — |
| Focus | Input: 3px `focus-ring` on the input line | `:focus-visible` |
| Disabled | N/A: always usable; if JS fails, the page renders the Recruiter view instead | — |
| Loading | `resume.pdf` prints "preparing pdf…" with a spinner line, then "✓ downloaded" in `status-building` | `.mn-term__muted` + spinner |
| Empty | After `clear`: only the prompt and a muted hint "type help, or tap a command" | — |
| Error | Unknown command: `danger` line "command not found: foo. try help" | `.mn-term__err` |
