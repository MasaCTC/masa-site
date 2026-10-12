"use client";
// Chart (Chart.md, Stats.dc.html): follower line chart in an inset well.
// SVG 600x214. Hover snaps to the nearest point; the figure is focusable and ArrowLeft /
// ArrowRight move the point. With no hover the latest point is marked.
// Loading / empty / error replace the plot with __center content in the same well.
// Paths come from ./chart-geometry (pure); this component never fetches.
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Message, Skeleton } from "./Feedback";
import {
  BASELINE_Y,
  CHART_HEIGHT,
  CHART_WIDTH,
  GRID_RIGHT,
  PLOT_LEFT,
  PLOT_RIGHT,
  nearestIndex,
  tooltipPosition,
  type ChartPoint,
  type ChartTick,
} from "./chart-geometry";
import styles from "./Chart.module.css";
import { cx, type DataState } from "./types";

/** Design gridlines: 0 / 5K / 10K. */
export const DEFAULT_TICKS: ChartTick[] = [
  { y: 190, label: "0" },
  { y: 115, label: "5K" },
  { y: 41, label: "10K" },
];

export type ChartProps = {
  state?: DataState;
  /** Display-ready points in viewBox coordinates (see projectSeries). */
  points?: ChartPoint[];
  /** Line path (see chartPaths). */
  linePath?: string;
  /** Area path (see chartPaths). */
  areaPath?: string;
  /** Text summary of the chart for the SVG (required by Chart.md). */
  ariaLabel?: string;
  /** Label of the focusable figure. */
  focusLabel?: string;
  ticks?: ChartTick[];
  /** X-axis labels: start (x=40), optional middle (x=310), end (x=580). */
  xLabels?: { start: string; mid?: string; end: string };
  /** Annotation: dashed guide + small label, e.g. "reel #1 posted". */
  note?: { x: number; label: string };
  /** Word under the tooltip value ("followers"). */
  unitText?: string;
  /** false = static chart (Home): latest point only, no hover, not focusable. */
  interactive?: boolean;
  /** Optional figcaption row (Home: label + change). */
  caption?: ReactNode;
  loadingText?: ReactNode;
  emptyText?: ReactNode;
  errorText?: ReactNode;
  errorDetail?: ReactNode;
  /** Retry slot for the error state, e.g. <Button size="sm">Try again</Button>. */
  errorAction?: ReactNode;
  className?: string;
};

export function Chart({
  state = "ready",
  points = [],
  linePath = "",
  areaPath = "",
  ariaLabel = "",
  focusLabel = "Follower growth chart. Use left and right arrow keys to move between days.",
  ticks = DEFAULT_TICKS,
  xLabels,
  note,
  unitText = "followers",
  interactive = true,
  caption,
  loadingText = "Pulling follower history…",
  emptyText = "Not enough history yet. Growth shows after 2 days of snapshots.",
  errorText = "Couldn't load follower history.",
  errorDetail = "Daily snapshots resume on the next pull.",
  errorAction,
  className,
}: ChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const showPlot = state === "ready" && n > 0;
  const figureClass = cx("mn-chart", styles.figure, caption != null && styles.withCaption, className);
  const captionEl = caption != null ? <figcaption className="mn-card__row">{caption}</figcaption> : null;

  if (!showPlot) {
    let center: ReactNode;
    if (state === "loading") {
      center = (
        <>
          <Skeleton className={styles.skelWide} />
          <Skeleton className={styles.skelNarrow} />
          <Message tone="loading">{loadingText}</Message>
        </>
      );
    } else if (state === "error") {
      center = (
        <>
          <Message tone="error" detail={errorDetail} className={styles.centerMsg}>
            {errorText}
          </Message>
          {errorAction}
        </>
      );
    } else {
      center = (
        <Message icon="chart" className={styles.centerMsg}>
          {emptyText}
        </Message>
      );
    }
    return (
      <figure className={figureClass} aria-busy={state === "loading" || undefined}>
        {captionEl}
        <div className="mn-chart__center">{center}</div>
      </figure>
    );
  }

  const active = hover == null ? n - 1 : Math.min(hover, n - 1);
  const hp = points[active];
  const tip = tooltipPosition(hp);

  const onPointer = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    if (r.width === 0) return;
    const x = ((e.clientX - r.left) / r.width) * CHART_WIDTH;
    const best = nearestIndex(points, x);
    if (best !== hover) setHover(best);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowLeft" ? -1 : 1;
    // Functional update: held / repeated keys must not read a stale `hover`.
    setHover((h) => {
      const cur = h == null ? n - 1 : Math.min(h, n - 1);
      return Math.max(0, Math.min(n - 1, cur + step));
    });
  };

  return (
    <figure
      className={cx(figureClass, interactive && "mn-focusable")}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? focusLabel : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
    >
      {captionEl}
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <line key={`g${t.y}`} className="grid" x1={PLOT_LEFT} x2={GRID_RIGHT} y1={t.y} y2={t.y} />
        ))}
        {ticks.map((t) => (
          <text key={`t${t.y}`} className="axis" x="0" y={t.y + 4}>
            {t.label}
          </text>
        ))}
        {xLabels ? (
          <>
            <text className="axis" x={PLOT_LEFT} y="212">
              {xLabels.start}
            </text>
            {xLabels.mid ? (
              <text className="axis" x="310" y="212" textAnchor="middle">
                {xLabels.mid}
              </text>
            ) : null}
            <text className="axis" x={PLOT_RIGHT} y="212" textAnchor="end">
              {xLabels.end}
            </text>
          </>
        ) : null}
        <path className="area" d={areaPath} />
        <path className="line" d={linePath} />
        {note ? (
          <g>
            <line
              className={cx("guide", interactive && styles.noteGuide)}
              x1={note.x}
              x2={note.x}
              y1="60"
              y2={BASELINE_Y}
            />
            <text className="axis" x={note.x - 6} y="54" textAnchor="end">
              {note.label}
            </text>
          </g>
        ) : null}
        {interactive ? (
          <line className="guide" x1={hp.x} x2={hp.x} y1="30" y2={BASELINE_Y} />
        ) : null}
        <circle className="pt" cx={hp.x} cy={hp.y} r="6" />
        {interactive ? (
          <rect
            x={PLOT_LEFT}
            y="20"
            width="550"
            height="175"
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setHover(null)}
          />
        ) : null}
      </svg>
      {interactive ? (
        <div className={cx("mn-chart__tip", styles.tip)} style={{ left: tip.left, top: tip.top }}>
          {hp.date}
          <b>{hp.valueText}</b>
          {unitText}
        </div>
      ) : null}
    </figure>
  );
}
