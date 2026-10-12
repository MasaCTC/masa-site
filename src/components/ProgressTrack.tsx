// ProgressTrack (ProgressTrack.md): a project's build map. Phases as dots on an inset
// groove; done = filled dot, current = blue ring + bold name + aria-current="step".
// The fill runs behind the dots up to the furthest done/current phase (dynamic geometry,
// so it stays a style prop). `empty` = only scoping defined: dashed groove (.is-empty).
import type { ReactNode } from "react";
import styles from "./ProgressTrack.module.css";
import { cx } from "./types";

export type Phase = {
  /** Omit for the dot-only map on Home cards. */
  name?: string;
  status: "done" | "current" | "upcoming";
};

export type ProgressTrackProps = {
  phases: Phase[];
  /** "Build map: phase 2 of 6, Vertical slice". */
  ariaLabel: string;
  /** Scoping-only map (dashed groove, two-column layout, no fill). */
  empty?: boolean;
  /** stack-sm = horizontal, vertical under 640px; vertical = always vertical. */
  layout?: "horizontal" | "stack-sm" | "vertical";
  /** Mono line under the map (e.g. "phases get mapped once scoping is done"). */
  note?: ReactNode;
  className?: string;
};

export function ProgressTrack({
  phases,
  ariaLabel,
  empty = false,
  layout = "horizontal",
  note,
  className,
}: ProgressTrackProps) {
  const n = phases.length;
  let reached = -1;
  phases.forEach((p, i) => {
    if (p.status !== "upcoming") reached = i;
  });
  const showFill = !empty && reached > 0;

  const track = (
    <ol
      className={cx(
        "mn-track",
        layout === "stack-sm" && "mn-track--stack-sm",
        layout === "vertical" && "mn-track--vertical",
        empty && "is-empty",
        empty && styles.empty,
        className,
      )}
      aria-label={ariaLabel}
    >
      {showFill ? (
        <li
          className="mn-track__fill"
          aria-hidden="true"
          style={{ width: `calc(100% / ${n} * ${reached})` }}
        />
      ) : null}
      {phases.map((p, i) => (
        <li
          key={i}
          className={cx(
            "mn-phase",
            p.status === "done" && "is-done",
            p.status === "current" && "is-current",
          )}
          aria-current={p.status === "current" ? "step" : undefined}
        >
          <span className="mn-phase__dot" />
          {p.name ? <span className="mn-phase__name">{p.name}</span> : null}
        </li>
      ))}
    </ol>
  );

  if (!note) return track;
  return (
    <>
      {track}
      <span className="mn-mono">{note}</span>
    </>
  );
}
