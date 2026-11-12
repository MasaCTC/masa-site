// Pure geometry for the follower Chart (Stats.dc.html): a 600x214 viewBox, plot from
// x=40..580 (gridlines run to 590), baseline y=190. No React, no Date, no side effects.

export const CHART_WIDTH = 600;
export const CHART_HEIGHT = 214;
export const PLOT_LEFT = 40;
export const PLOT_RIGHT = 580;
export const GRID_RIGHT = 590;
export const BASELINE_Y = 190;
/** y of the top gridline in the design (10K at y=41). */
export const TOP_GRID_Y = 41;

/** One display-ready point: SVG coords + the strings the tooltip prints. */
export type ChartPoint = {
  x: number;
  y: number;
  /** Tooltip date ("Oct 11"). */
  date: string;
  /** Tooltip value ("10,214"). */
  valueText: string;
};

/** A raw series entry, before projection into SVG space. */
export type SeriesEntry = {
  value: number;
  date: string;
  valueText: string;
};

/** Gridline + y-axis label (design: 0 @190, 5K @115, 10K @41). */
export type ChartTick = { y: number; label: string };

/**
 * Projects a series onto the plot: x evenly spaced from PLOT_LEFT to PLOT_RIGHT, y linear
 * from BASELINE_Y (0) to TOP_GRID_Y (yMax). y-axis starts at 0 (honest scale).
 */
export function projectSeries(series: readonly SeriesEntry[], yMax: number): ChartPoint[] {
  const n = series.length;
  const span = BASELINE_Y - TOP_GRID_Y;
  return series.map((s, i) => {
    const x = n <= 1 ? PLOT_RIGHT : PLOT_LEFT + ((PLOT_RIGHT - PLOT_LEFT) * i) / (n - 1);
    const y = yMax > 0 ? BASELINE_Y - (Math.max(0, s.value) / yMax) * span : BASELINE_Y;
    return { x: round1(x), y: round1(y), date: s.date, valueText: s.valueText };
  });
}

/** y position for a gridline at `value` on the same scale as projectSeries. */
export function tickY(value: number, yMax: number): number {
  if (yMax <= 0) return BASELINE_Y;
  return round1(BASELINE_Y - (value / yMax) * (BASELINE_Y - TOP_GRID_Y));
}

/** Line path ("M40 174 L76 172 ...") and closed area path down to the baseline. */
export function chartPaths(points: readonly { x: number; y: number }[]): {
  line: string;
  area: string;
} {
  if (points.length === 0) return { line: "", area: "" };
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${last.x} ${BASELINE_Y} L${first.x} ${BASELINE_Y} Z`;
  return { line, area };
}

/** Index of the point nearest to `x` (in viewBox units). */
export function nearestIndex(points: readonly { x: number }[], x: number): number {
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
  }
  return best;
}

/** Tooltip anchor as % of the figure: left clamped to 12..88% so it never leaves the well. */
export function tooltipPosition(p: { x: number; y: number }): { left: string; top: string } {
  const leftPct = Math.min(88, Math.max(12, (p.x / CHART_WIDTH) * 100));
  const topPct = (p.y / CHART_HEIGHT) * 100;
  return { left: `${leftPct}%`, top: `${topPct}%` };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
