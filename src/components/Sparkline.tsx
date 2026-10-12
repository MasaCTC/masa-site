// Sparkline (StatTile.md): shape only, 120x36, latest point marked in chart-point blue.
// `d` is a display-ready path (e.g. "M2 33.0 L12 32.3 ... L118 3.0"); the latest-point dot
// is placed on the path's last coordinate.

export type SparklineProps = {
  /** SVG path data in the 120x36 viewBox. */
  d: string;
  /** States start and end ("Followers, last 90 days: 1.1K to 10.2K"). */
  ariaLabel: string;
};

/** Last "x y" pair of an M/L path. Pure. */
export function lastPathPoint(d: string): { x: number; y: number } {
  const nums = d.match(/-?\d*\.?\d+/g) ?? [];
  const x = Number(nums[nums.length - 2] ?? 0);
  const y = Number(nums[nums.length - 1] ?? 0);
  return { x, y };
}

export function Sparkline({ d, ariaLabel }: SparklineProps) {
  const end = lastPathPoint(d);
  return (
    <svg className="mn-spark" viewBox="0 0 120 36" role="img" aria-label={ariaLabel}>
      <line className="base" x1="0" x2="120" y1="35" y2="35" />
      <path className="line" d={d} />
      <circle className="pt" cx={end.x} cy={end.y} r="3.5" />
    </svg>
  );
}
