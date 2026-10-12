// Pill (Pill.md): read-only status label. The word is always present.
// `neutral` is the plain mn-pill (no status color), used for "Manual" / "Stale" / "New".
import type { ReactNode } from "react";
import { cx } from "./types";

export type PillProps = {
  children: ReactNode;
  variant?: "neutral" | "building" | "scoping" | "dead" | "live";
  className?: string;
};

export function Pill({ children, variant = "neutral", className }: PillProps) {
  return (
    <span className={cx("mn-pill", variant !== "neutral" && `mn-pill--${variant}`, className)}>
      {children}
    </span>
  );
}
