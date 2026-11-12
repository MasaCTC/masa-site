// Meter (Meter.md): one ratio against a whole, printed value + filled inset track.
// No ratio = the designed empty state: value "—", empty track, a muted line saying why,
// and no role="meter" / aria-valuenow. Loading: value "—", skeleton track, aria-busy.
// Error: Feedback error line under the track.
import type { ReactNode } from "react";
import { Message, Skeleton } from "./Feedback";
import styles from "./Meter.module.css";
import { cx, fillWidth, type DataState } from "./types";

export type MeterProps = {
  label: string;
  /** Display-ready value ("43%"). */
  valueText: string;
  /** 0..1. Omitted = empty state (no fill, no meter role). */
  ratio?: number;
  /** Why there is no value (muted line, empty state). */
  emptyReason?: ReactNode;
  /** Accessible name for the meter. Defaults to `label`. */
  ariaLabel?: string;
  /** Optional mono footnote under the track ("13 of 30 months · done Mar 2028"). */
  footnote?: ReactNode;
  state?: DataState;
  errorText?: ReactNode;
  className?: string;
};

export function Meter({
  label,
  valueText,
  ratio,
  emptyReason,
  ariaLabel,
  footnote,
  state = "ready",
  errorText = "Couldn't load.",
  className,
}: MeterProps) {
  const loading = state === "loading";
  const hasValue = state === "ready" && ratio != null;
  const shownValue = hasValue ? valueText : "—";
  const valueNow = hasValue ? Math.round(Math.min(1, Math.max(0, ratio ?? 0)) * 1000) / 10 : undefined;

  return (
    <div
      className={cx("mn-meter", className)}
      role={hasValue ? "meter" : undefined}
      aria-valuemin={hasValue ? 0 : undefined}
      aria-valuemax={hasValue ? 100 : undefined}
      aria-valuenow={valueNow}
      aria-label={hasValue ? (ariaLabel ?? label) : undefined}
      aria-busy={loading || undefined}
    >
      <div className="mn-meter__head">
        <span className="mn-label">{label}</span>
        <span className="mn-meter__value">{shownValue}</span>
      </div>
      {loading ? (
        <Skeleton className={styles.skelTrack} />
      ) : (
        <div className="mn-meter__track">
          {hasValue ? <span className="mn-meter__fill" style={{ width: fillWidth(ratio ?? 0) }} /> : null}
        </div>
      )}
      {state === "error" ? <Message tone="error">{errorText}</Message> : null}
      {state !== "error" && !loading && !hasValue && emptyReason ? (
        <Message as="span">{emptyReason}</Message>
      ) : null}
      {hasValue && footnote ? <span className="mn-mono">{footnote}</span> : null}
    </div>
  );
}
