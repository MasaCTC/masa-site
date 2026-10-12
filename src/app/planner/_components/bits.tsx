// Small shared pieces from the planner prototype: the grip and close icons,
// the class swatch and the class <select> options.
import type { Class } from "@/db/schema";
import { colorVar } from "./context";

export function GripIcon() {
  return (
    <svg viewBox="0 0 14 20" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="4" cy="4" r="1.6" />
        <circle cx="10" cy="4" r="1.6" />
        <circle cx="4" cy="10" r="1.6" />
        <circle cx="10" cy="10" r="1.6" />
        <circle cx="4" cy="16" r="1.6" />
        <circle cx="10" cy="16" r="1.6" />
      </g>
    </svg>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Class color swatch; the class name is always printed next to it. */
export function Swatch({ cls }: { cls: Class | undefined | null }) {
  if (!cls) return null;
  return <span className="mn-swatch" style={colorVar(cls)} aria-hidden="true" />;
}

/** "No class" + Classes / Categories optgroups (prototype fill()). */
export function ClassOptions({ classes, noneLabel = "No class" }: { classes: Class[]; noneLabel?: string | null }) {
  const groups: Array<[Class["kind"], string]> = [
    ["class", "Classes"],
    ["category", "Categories"],
  ];
  return (
    <>
      {noneLabel !== null ? <option value="">{noneLabel}</option> : null}
      {groups.map(([kind, label]) => {
        const items = classes.filter((c) => c.kind === kind);
        if (!items.length) return null;
        return (
          <optgroup key={kind} label={label}>
            {items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

export const EST_OPTIONS: Array<[string, string]> = [
  ["", "None"],
  ["15", "15m"],
  ["30", "30m"],
  ["60", "1h"],
  ["120", "2h"],
  ["180", "3h"],
];
