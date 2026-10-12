// StatTile (StatTile.md): one headline number + label + meta line, optional sparkline.
// States: ready, loading (skeletons, aria-busy), empty (.is-empty, value "—"),
// error (.is-error, value "—", danger message as the meta line).
import type { ReactNode } from "react";
import { Message, Skeleton } from "./Feedback";
import { Sparkline } from "./Sparkline";
import styles from "./StatTile.module.css";
import { cx, type DataState } from "./types";

export type StatTileProps = {
  label: string;
  /** Display-ready value ("14.1K"). Empty/error show "—" when omitted. */
  valueText?: string;
  /** Exact value for title ("14,136 followers"). */
  title?: string;
  /** Meta line (change or source). */
  meta?: ReactNode;
  /** delta = green growth line (+ / − prefixed); meta = neutral mono line. */
  metaKind?: "meta" | "delta";
  /** Sparkline; omit when there is no history. */
  spark?: { d: string; ariaLabel: string };
  /** Error copy ("Couldn't reach Instagram"). */
  errorText?: ReactNode;
  state?: DataState;
  size?: "lg" | "md";
  className?: string;
};

export function StatTile({
  label,
  valueText,
  title,
  meta,
  metaKind = "meta",
  spark,
  errorText,
  state = "ready",
  size = "lg",
  className,
}: StatTileProps) {
  const classes = cx(
    "mn-stat",
    size === "md" && "mn-stat--md",
    state === "empty" && "is-empty",
    state === "error" && "is-error",
    className,
  );

  if (state === "loading") {
    return (
      <div className={classes} aria-busy="true">
        <span className="mn-label">{label}</span>
        {size === "md" ? (
          <Skeleton className={styles.skelValueMd} />
        ) : (
          <>
            <Skeleton className={styles.skelValue} />
            <Skeleton className={styles.skelMeta} />
            <Skeleton className={styles.skelSpark} />
          </>
        )}
      </div>
    );
  }

  const shownValue = state === "ready" ? valueText : (valueText ?? "—");

  return (
    <div className={classes} aria-busy="false">
      <span className="mn-label">{label}</span>
      <span className="mn-stat__value" title={title}>
        {shownValue}
      </span>
      {state === "error" ? (
        errorText ? (
          <Message tone="error" as="span">
            {errorText}
          </Message>
        ) : null
      ) : meta ? (
        <span className={metaKind === "delta" ? "mn-stat__delta" : "mn-stat__meta"}>{meta}</span>
      ) : null}
      {state === "ready" && spark ? <Sparkline d={spark.d} ariaLabel={spark.ariaLabel} /> : null}
    </div>
  );
}
