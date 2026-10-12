// The 8 class colors from design/system (ClassColor.md, tokens.css --cls-*).
// Kept in its own dependency-free module so client code and node:test can
// import it without pulling in drizzle.
export const CLASS_COLORS = [
  "clay",
  "moss",
  "sea",
  "plum",
  "ochre",
  "slate",
  "rose",
  "teal",
] as const;
export type ClassColor = (typeof CLASS_COLORS)[number];
