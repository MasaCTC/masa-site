// Pure, typed display helpers. Placeholders pass through verbatim; known values are formatted.
// Components receive the resulting strings/ratios, never a Metric.
import { fillWidth } from "@/components/types";
import type { Metric, TextField } from "./types";

export { fillWidth };

/**
 * Compact rule (one rule, matches every design example):
 *  - under 1,000: the plain integer
 *  - 1,000 to 99,949: thousands with ONE decimal  (10,214 -> 10.2K, 73,500 -> 73.5K, 6,677 -> 6.7K, 14,136 -> 14.1K)
 *  - 100,000 up to 999,499: thousands, no decimal (412,300 -> 412K, 491,000 -> 491K, 380,000 -> 380K)
 *  - 1,000,000 and up: millions with ONE decimal  (6,024,310 -> 6.0M, 7,700,000 -> 7.7M)
 * Rounding is half-up on the displayed digit; a value that would round to "1000K" becomes "1.0M".
 */
export function compact(n: number): string {
  const v = Math.round(n);
  if (v < 1000) return String(v);
  if (v < 100_000) {
    const k = Math.round(v / 100) / 10;
    if (k < 100) return `${k.toFixed(1)}K`;
  }
  if (v < 1_000_000) {
    const k = Math.round(v / 1000);
    if (k < 1000) return `${k}K`;
  }
  return `${(Math.round(v / 100_000) / 10).toFixed(1)}M`;
}

/** 14136 -> "14,136". */
export function exact(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** value / max clamped to 0-1. 0 when max <= 0. Use fillWidth(ratio) for the CSS width. */
export function barRatio(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(1, Math.max(0, value / max));
}

export function isKnown(m: Metric): m is { kind: "value"; value: number } {
  return m.kind === "value";
}

/** "14.1K", or the placeholder label verbatim. */
export function metricCompact(m: Metric): string {
  return m.kind === "value" ? compact(m.value) : m.label;
}

/** "14,136", or the placeholder label verbatim. */
export function metricExact(m: Metric): string {
  return m.kind === "value" ? exact(m.value) : m.label;
}

/** Tooltip/title text: `${exact} ${unit}` ("14,136 followers"), or the placeholder label. */
export function metricTitle(m: Metric, unit: string): string {
  return m.kind === "value" ? `${exact(m.value)} ${unit}` : m.label;
}

/** 0-1 ratio of a known metric to a known max; undefined if either is unknown (no fill). */
export function metricRatio(m: Metric, max: Metric): number | undefined {
  return m.kind === "value" && max.kind === "value" ? barRatio(m.value, max.value) : undefined;
}

/** CSS width for a metric's bar fill, or undefined when unknown (omit the fill element). */
export function metricFillWidth(m: Metric, max: Metric): string | undefined {
  const r = metricRatio(m, max);
  return r === undefined ? undefined : fillWidth(r);
}

export function textFieldText(t: TextField): string {
  return t.kind === "text" ? t.text : t.label;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "2026-10-11" -> "Oct 11" (chart axis / tooltip). Pure string math, like formatPulledDate. */
export function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : iso;
}

/** Signed exact change: "+3,114", "−120" (U+2212, StatTile.md), "0". */
export function signedExact(n: number): string {
  const v = Math.round(n);
  if (v > 0) return `+${exact(v)}`;
  if (v < 0) return `\u2212${exact(-v)}`;
  return "0";
}

/** "2026-10-11" -> "Oct 11, 2026". Pure string math: no Date, no timezone drift. */
export function formatPulledDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : iso;
}
