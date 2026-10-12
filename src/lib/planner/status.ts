// Public status wording (planner preview and /now). Pure module.
export type StatusMode = "study" | "build" | "free";

/** "Studying for ICS 46" · "Building Cofura chat" · "Free right now". */
export function statusText(s: {
  mode: StatusMode;
  text: string | null;
  className: string | null;
}): string {
  if (s.mode === "free") return "Free right now";
  if (s.mode === "build") return "Building " + (s.text || "something");
  return s.className ? "Studying for " + s.className : "Studying";
}
