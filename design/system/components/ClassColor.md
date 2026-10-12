# Class color

Each planner class or category gets one of 8 tokens (`cls-clay, moss, sea, plum, ochre, slate, rose, teal`), picked in the class detail view. Shown as a 10px rounded swatch (`.mn-swatch` with `--c`) before the class name, and as a light tint behind calendar chips. Never as text color, never as the only signal: the class name is always printed. Planner only; public pages keep one data hue.

**Picker**: `role="radiogroup"` of 32px `button.mn-color[role=radio]`; the chosen one is pressed in and ringed in `ink`.

| State | Look | Trigger |
|---|---|---|
| Default | Raised swatch | — |
| Hover | Cursor pointer | — |
| Pressed / selected | Inset + 2px `ink` ring | `aria-checked="true"` |
| Focus | 3px `focus-ring` | `:focus-visible` |
| Disabled / Loading / Empty / Error | N/A | — |
