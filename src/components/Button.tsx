// Button (Button.md): raised control; `primary` is the one red CTA per view.
// With `href` it renders a link styled as a button (next/link for internal routes).
// A disabled button is always a real <button disabled> (decision 4: no href="#").
import NextLink from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { Spinner } from "./Feedback";
import { cx, isExternalHref } from "./types";

export type ButtonProps = {
  children: ReactNode;
  variant?: "default" | "primary" | "ghost";
  size?: "md" | "sm";
  /** 48px round icon button. Requires `ariaLabel`. */
  iconOnly?: boolean;
  /** Leading inline SVG (see ./icons). */
  icon?: ReactNode;
  /** Trailing inline SVG (e.g. the external arrow on the Home GitHub button). */
  trailingIcon?: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  /** Spinner replaces the icon, aria-busy, label should say what is happening. */
  loading?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function Button({
  children,
  variant = "default",
  size = "md",
  iconOnly = false,
  icon,
  trailingIcon,
  href,
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  ariaLabel,
  className,
}: ButtonProps) {
  const classes = cx(
    "mn-btn",
    variant === "primary" && "mn-btn--primary",
    variant === "ghost" && "mn-btn--ghost",
    size === "sm" && "mn-btn--sm",
    iconOnly && "mn-btn--icon",
    loading && "is-loading",
    className,
  );
  const content = (
    <>
      {loading ? <Spinner /> : icon}
      {children}
      {!loading && trailingIcon}
    </>
  );

  if (href && !disabled) {
    if (isExternalHref(href) || href.startsWith("mailto:")) {
      return (
        <a
          className={classes}
          href={href}
          rel={isExternalHref(href) ? "noopener" : undefined}
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
        >
          {content}
        </a>
      );
    }
    return (
      <NextLink
        className={classes}
        href={href}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
      >
        {content}
      </NextLink>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
