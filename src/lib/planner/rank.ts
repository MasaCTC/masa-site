// Fractional ranks for the checklist order. Pure module (no server-only, no
// "@/" imports) so node:test can load it directly.
//
// A rank is a non-empty base-62 string read as a fraction 0.d1d2d3…, with no
// trailing "0" (so there is always room before and after it). The digits are
// in ASCII order, so comparing ranks byte by byte (Postgres COLLATE "C", or
// JS `<` on these strings) is the same as comparing the fractions.

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length; // 62
const VALID = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

const digit = (c: string) => DIGITS.indexOf(c);

export function isValidRank(r: string): boolean {
  return VALID.test(r);
}

/**
 * A rank strictly between `a` and `b` (null = open end). Throws on invalid
 * input or a >= b; callers that read ranks from the DB should check with
 * isValidRank and compare first, and fall back to rankSequence to rebalance.
 */
export function rankBetween(a: string | null, b: string | null): string {
  if (a !== null && !isValidRank(a)) throw new Error("invalid rank (before)");
  if (b !== null && !isValidRank(b)) throw new Error("invalid rank (after)");
  if (a !== null && b !== null && !(a < b)) throw new Error("ranks out of order");
  if (a === null && b === null) return DIGITS[BASE >> 1]; // "V"
  if (b === null) return after(a!);
  if (a === null) return before(b);
  return midpoint(a, b);
}

// Bump the first digit that is not "z"; ~61 appends per extra character.
function after(a: string): string {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== "z") return a.slice(0, i) + DIGITS[digit(a[i]) + 1];
  }
  return a + "1";
}

// Lower the first digit that is not "0"; ~61 prepends per extra character.
function before(b: string): string {
  for (let i = 0; i < b.length; i++) {
    const d = digit(b[i]);
    if (d === 0) continue;
    if (d > 1) return b.slice(0, i) + DIGITS[d - 1];
    return b.slice(0, i) + "0z"; // b[i] is "1": go one level deeper
  }
  throw new Error("invalid rank (after)"); // unreachable for valid ranks
}

// Midpoint of a < b, where "" means 0 and null means 1.
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? digit(a[0]) : 0;
  const db = b !== null ? digit(b[0]) : BASE;
  if (db - da > 1) return DIGITS[Math.round((da + db) / 2)];
  if (b !== null && b.length > 1) return b[0];
  return DIGITS[da] + midpoint(a.slice(1), null);
}

/** n evenly spaced, strictly increasing ranks (for rebalancing a list). */
export function rankSequence(n: number): string[] {
  if (n <= 0) return [];
  const base = BigInt(BASE);
  const slots = BigInt(n + 1);
  let width = 1;
  let space = base;
  // Leave ~62 slots between neighbours so later inserts stay short.
  while (space < slots * base) {
    width++;
    space *= base;
  }
  const out: string[] = [];
  for (let i = BigInt(1); i <= BigInt(n); i++) {
    let v = (i * space) / slots;
    let s = "";
    for (let k = 0; k < width; k++) {
      s = DIGITS[Number(v % base)] + s;
      v /= base;
    }
    out.push(s.replace(/0+$/, ""));
  }
  return out;
}
