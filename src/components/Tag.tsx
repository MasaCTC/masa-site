// Tag (Tag.md): toggleable filter chip. Controlled: the parent owns `pressed`.
// TagGroup wraps tags in the labelled mn-tags group.
import type { MouseEventHandler, ReactNode } from "react";
import styles from "./Tag.module.css";
import { cx } from "./types";

export type TagProps = {
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Resume skills card size: min-height 40px, padding 0 14px. */
  size?: "md" | "sm";
  className?: string;
};

export function Tag({
  children,
  pressed = false,
  disabled = false,
  onClick,
  size = "md",
  className,
}: TagProps) {
  return (
    <button
      type="button"
      className={cx("mn-tag", size === "sm" && styles.sm, className)}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export type TagGroupProps = {
  children: ReactNode;
  ariaLabel: string;
  /** Resume skills card spacing: gap 8px. */
  size?: "md" | "sm";
  className?: string;
};

export function TagGroup({ children, ariaLabel, size = "md", className }: TagGroupProps) {
  return (
    <div
      className={cx("mn-tags", size === "sm" && styles.groupSm, className)}
      role="group"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
