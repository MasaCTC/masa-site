// Card (Card.md): raised container. Variants: link (whole card navigates), inset (well),
// lg (more padding), dead (retired project, flat + dashed). `disabled` = "coming soon" slot.
// Loading / empty / error: pass `state` and the card renders skeleton bars or a Feedback
// message in place of children; `action` is the retry slot (a Button) for errors.
import NextLink from "next/link";
import type { ReactNode } from "react";
import { Message, Skeleton } from "./Feedback";
import styles from "./Card.module.css";
import { cx, isExternalHref, type DataState } from "./types";

export type CardProps = {
  children?: ReactNode;
  variant?: "default" | "inset" | "dead";
  size?: "md" | "lg";
  /** Whole card is a link (lifts on hover, focus ring). */
  href?: string;
  /** Element when not a link. Default article. */
  as?: "article" | "section" | "div";
  disabled?: boolean;
  state?: DataState;
  /** Empty state copy ("No projects yet"). */
  emptyText?: ReactNode;
  /** Error state copy ("Couldn't load."). */
  errorText?: ReactNode;
  /** Error retry slot, e.g. <Button size="sm">Try again</Button>. */
  action?: ReactNode;
  ariaLabel?: string;
  className?: string;
};

export function Card({
  children,
  variant = "default",
  size = "md",
  href,
  as: Tag = "article",
  disabled = false,
  state = "ready",
  emptyText,
  errorText,
  action,
  ariaLabel,
  className,
}: CardProps) {
  const classes = cx(
    "mn-card",
    size === "lg" && "mn-card--lg",
    variant === "inset" && "mn-card--inset",
    variant === "dead" && "mn-card--dead",
    href && state === "ready" && "mn-card--link",
    disabled && "is-disabled",
    className,
  );

  let body: ReactNode = children;
  if (state === "loading") {
    body = (
      <>
        <Skeleton className={styles.skelTitle} />
        <Skeleton className={styles.skelLine} />
      </>
    );
  } else if (state === "empty") {
    body = <Message as="span">{emptyText}</Message>;
  } else if (state === "error") {
    body = (
      <>
        <Message tone="error" as="span">
          {errorText}
        </Message>
        {action}
      </>
    );
  }

  if (href && state === "ready") {
    if (isExternalHref(href)) {
      return (
        <a className={classes} href={href} rel="noopener" aria-label={ariaLabel}>
          {body}
        </a>
      );
    }
    return (
      <NextLink className={classes} href={href} aria-label={ariaLabel}>
        {body}
      </NextLink>
    );
  }

  return (
    <Tag
      className={classes}
      aria-label={ariaLabel}
      aria-busy={state === "loading" || undefined}
    >
      {body}
    </Tag>
  );
}
