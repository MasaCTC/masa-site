// TimeLanes (TimeLanes.md, Resume.dc.html): a small Gantt on a shared year axis with a
// blue "now" line. Positions are percentages of the axis span (data, so style props).
// `current` = ongoing bar (blue); `dim` = filtered out by a skill Tag.
import { cx } from "./types";

export type TimeLane = {
  label: string;
  /** Native tooltip with the dates ("Sep 2025 – Mar 2028"). */
  title: string;
  /** Bar start, % of the axis. */
  left: number;
  /** Bar width, % of the axis. */
  width: number;
  current?: boolean;
  dim?: boolean;
};

export type TimeLanesProps = {
  /** Text summary of every lane (role="img"). */
  ariaLabel: string;
  ticks: { label: string; left: number }[];
  /** "now" line position, % of the axis. */
  now?: number;
  lanes: TimeLane[];
  className?: string;
};

const pct = (n: number) => `${Number(n.toFixed(1))}%`;

export function TimeLanes({ ariaLabel, ticks, now, lanes, className }: TimeLanesProps) {
  return (
    <div className={cx("mn-lanes", className)} role="img" aria-label={ariaLabel}>
      <div className="mn-lanes__axis">
        <span />
        <div className="mn-lanes__ticks">
          {ticks.map((t) => (
            <span key={t.label} style={{ left: pct(t.left) }}>
              {t.label}
            </span>
          ))}
          {now != null ? <span className="mn-lanes__now" style={{ left: pct(now) }} /> : null}
        </div>
      </div>
      {lanes.map((l) => (
        <div key={l.label} className={cx("mn-lane", l.dim && "is-dim")} title={l.title}>
          <span className="mn-lane__label">{l.label}</span>
          <span className="mn-lane__track">
            <span
              className={cx("mn-lane__bar", l.current && "is-current")}
              style={{ left: pct(l.left), width: pct(l.width) }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
