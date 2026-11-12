// Pure helpers for class colors (no server-only, no "@/" imports).
import { CLASS_COLORS, type ClassColor } from "../../db/class-colors.ts";

export { CLASS_COLORS, type ClassColor };

/** The least used color among existing classes; ties go to palette order. */
export function leastUsedColor(used: readonly ClassColor[]): ClassColor {
  const counts = new Map<ClassColor, number>(CLASS_COLORS.map((c) => [c, 0]));
  for (const c of used) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best: ClassColor = CLASS_COLORS[0];
  for (const c of CLASS_COLORS) if (counts.get(c)! < counts.get(best)!) best = c;
  return best;
}
