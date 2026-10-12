// StatusLabel (Pill.md, renamed Oct 2026): read-only status word, plain colored text (.mn-state).
// The word is always present. `neutral` is the muted .mn-state, used for "Manual" / "Stale" / "New".
// `detail` renders in a <small> on the same line ("Manual · entered by hand · updated Oct 11, 2026").
import type { ReactNode } from "react";
import { cx } from "./types";

export type StatusLabelProps = {
  children: ReactNode;
  /** Extra detail on the same line, rendered in <small>. */
  detail?: ReactNode;
  variant?: "neutral" | "building" | "scoping" | "dead" | "live";
  className?: string;
};

export function StatusLabel({ children, detail, variant = "neutral", className }: StatusLabelProps) {
  return (
    <span className={cx("mn-state", variant !== "neutral" && `mn-state--${variant}`, className)}>
      {children}
      {detail ? <small> {detail}</small> : null}
    </span>
  );
}
