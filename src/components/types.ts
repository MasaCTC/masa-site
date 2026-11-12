/** Data state every data-bearing component accepts (Task 2 <-> Task 3/4 interface). */
export type DataState = "ready" | "loading" | "empty" | "error";

/** Joins class names, skipping falsy entries. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

/** True for absolute http(s) URLs, which get rel="noopener" and the external arrow. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Bar / meter fill width: the design's honest 0-based scale inside the 4px-inset track. */
export function fillWidth(ratio: number): string {
  const r = Math.min(1, Math.max(0, ratio));
  return `calc((100% - 8px) * ${Number(r.toFixed(3))})`;
}
