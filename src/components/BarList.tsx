// BarList (BarList.md): compare a handful of values on one 0-based scale.
// Items are display-ready: `ratio` is 0..1 of the list's scale; omit it and the row renders
// no fill element (.mn-bar__fill has min-width 8px, so "no value" must mean no fill).
// States: loading (skeleton tracks, values "—", aria-busy), empty / error (Feedback message
// instead of the list).
import type { ReactNode } from "react";
import { Message, Skeleton } from "./Feedback";
import styles from "./BarList.module.css";
import { cx, fillWidth, type DataState } from "./types";

export type BarItem = {
  label: string;
  valueText: string;
  /** Native tooltip with the exact value ("Reel 1 · 7,700,000 views"). */
  title: string;
  /** 0..1 of the shared scale. Omitted = no fill. */
  ratio?: number;
  /** The leader (ink fill). */
  top?: boolean;
};

export type BarListProps = {
  items: BarItem[];
  ariaLabel: string;
  state?: DataState;
  emptyText?: ReactNode;
  errorText?: ReactNode;
  /** Reel-card engagement bars: tighter rows (Stats.dc.html). */
  variant?: "default" | "compact";
  className?: string;
};

export function BarList({
  items,
  ariaLabel,
  state = "ready",
  emptyText = "No reels yet.",
  errorText = "Couldn't load.",
  variant = "default",
  className,
}: BarListProps) {
  if (state === "empty") {
    return <Message className={className}>{emptyText}</Message>;
  }
  if (state === "error") {
    return (
      <Message tone="error" className={className}>
        {errorText}
      </Message>
    );
  }

  const compact = variant === "compact";
  const loading = state === "loading";
  return (
    <ol
      className={cx("mn-bars", compact && styles.compact, className)}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {items.map((item) => (
        <li
          key={item.label}
          className={cx("mn-bar", item.top && !loading && "is-top")}
          title={loading ? undefined : item.title}
        >
          <span className="mn-bar__label">{item.label}</span>
          {loading ? (
            <Skeleton className={styles.skelTrack} />
          ) : (
            <span className="mn-bar__track">
              {item.ratio != null ? (
                <span className="mn-bar__fill" style={{ width: fillWidth(item.ratio) }} />
              ) : null}
            </span>
          )}
          <span className="mn-bar__value">{loading ? "—" : item.valueText}</span>
        </li>
      ))}
    </ol>
  );
}
