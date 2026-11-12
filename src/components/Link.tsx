// Link (Link.md): inline text link. External (http) links get the arrow-up-right SVG and
// rel="noopener". Disabled links render without href and with aria-disabled="true"
// (decision 4). `onClick` without href renders the Resume "Back to the timeline" button-link.
import NextLink from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { ArrowRightIcon, ArrowUpRightIcon } from "./icons";
import styles from "./Link.module.css";
import { cx, isExternalHref } from "./types";

export type LinkProps = {
  children: ReactNode;
  href?: string;
  /** Trailing arrow. Default: "external" for http(s) hrefs, otherwise none. */
  arrow?: "external" | "next" | "none";
  disabled?: boolean;
  /** Renders a <button class="mn-link"> (no href) for in-page actions. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  className?: string;
};

export function Link({
  children,
  href,
  arrow,
  disabled = false,
  onClick,
  ariaLabel,
  className,
}: LinkProps) {
  const external = href ? isExternalHref(href) : false;
  const resolvedArrow = arrow ?? (external ? "external" : "none");
  const icon =
    resolvedArrow === "external" ? (
      <ArrowUpRightIcon />
    ) : resolvedArrow === "next" ? (
      <ArrowRightIcon />
    ) : null;
  const content = (
    <>
      {children}
      {icon}
    </>
  );

  if (disabled || (!href && !onClick)) {
    return (
      <a className={cx("mn-link", className)} aria-disabled="true" aria-label={ariaLabel}>
        {content}
      </a>
    );
  }

  if (!href) {
    return (
      <button
        type="button"
        className={cx("mn-link", styles.asButton, className)}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }

  if (external || href.startsWith("mailto:")) {
    return (
      <a
        className={cx("mn-link", className)}
        href={href}
        rel={external ? "noopener" : undefined}
        aria-label={ariaLabel}
      >
        {content}
      </a>
    );
  }

  return (
    <NextLink className={cx("mn-link", className)} href={href} aria-label={ariaLabel}>
      {content}
    </NextLink>
  );
}
