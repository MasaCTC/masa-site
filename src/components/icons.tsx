// Inline stroke icons from the design screens: 1.75px stroke, currentColor.
// Every icon is decorative (aria-hidden); the surrounding control carries the label.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** External link arrow (Link.md, GitHub button on Home). */
export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

/** Internal "go to" arrow ("See all stats", "All projects"). */
export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Download PDF. */
export function DownloadIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

/** "Try again". */
export function RetryIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
    </svg>
  );
}

/** Error message icon (circle + exclamation). */
export function ErrorIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16.5v.5" />
    </svg>
  );
}

/** Chart empty-state icon. */
export function ChartIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M4 19h16M6 15l4-4 3 3 5-6" />
    </svg>
  );
}

/** "Nothing to show yet" box (message wells). */
export function EmptyBoxIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 12h6" />
    </svg>
  );
}

/** Timeline chevron. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Timeline node dot (stroke-width 2, as drawn). */
export function NodeDotIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

/** Filled play triangle (DemoArea clip). */
export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  );
}
