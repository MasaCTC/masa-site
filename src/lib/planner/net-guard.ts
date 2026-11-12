// SSRF guard for the server-side Canvas feed fetch. Pure (node:net only, no
// "@/" imports) so node:test can check it. The fetcher (canvas-fetch.ts)
// checks every URL (first and after each redirect) with checkFeedUrl, and
// every DNS answer, at connect time, with allPublic.
import { isIP } from "node:net";

// Hostnames that never belong to a public Canvas instance.
const BLOCKED_HOST = /(^|\.)(localhost|local|internal|localdomain|home\.arpa|lan)$/i;

/**
 * An https URL on port 443 with a dotted DNS hostname and no credentials.
 * IP literals are refused outright (they would skip the DNS check).
 * `base` resolves relative redirect targets.
 */
export function checkFeedUrl(raw: string, base?: string): { ok: true; url: URL } | { ok: false } {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return { ok: false };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port !== "" && url.port !== "443") ||
    !host ||
    isIP(host) !== 0 ||
    !host.includes(".") ||
    BLOCKED_HOST.test(host)
  ) {
    return { ok: false };
  }
  return { ok: true, url };
}

/** True when every address is public (and there is at least one). */
export function allPublic(addresses: readonly string[]): boolean {
  return addresses.length > 0 && addresses.every(isPublicIp);
}

function v4Bytes(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const b = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return b.every((n) => n >= 0 && n <= 255) ? b : null;
}

// [prefix bytes, prefix length]
const V4_BLOCKED: [number[], number][] = [
  [[0], 8], // "this" network
  [[10], 8], // private
  [[100, 64], 10], // carrier-grade NAT
  [[127], 8], // loopback
  [[169, 254], 16], // link-local, cloud metadata
  [[172, 16], 12], // private
  [[192, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2], 24], // TEST-NET-1
  [[192, 88, 99], 24], // 6to4 relay anycast
  [[192, 168], 16], // private
  [[198, 18], 15], // benchmarking
  [[198, 51, 100], 24], // TEST-NET-2
  [[203, 0, 113], 24], // TEST-NET-3
  [[224], 4], // multicast
  [[240], 4], // reserved + broadcast
];

function inPrefix(bytes: number[], prefix: number[], len: number): boolean {
  for (let bit = 0; bit < len; bit++) {
    const i = bit >> 3;
    const mask = 0x80 >> (bit & 7);
    if ((bytes[i] & mask) !== ((prefix[i] ?? 0) & mask)) return false;
  }
  return true;
}

function isPublicV4(b: number[]): boolean {
  return !V4_BLOCKED.some(([p, len]) => inPrefix(b, p, len));
}

function v6Bytes(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) return null; // scoped (link-local) addresses
  // Embedded dotted IPv4 tail -> two hex groups.
  const dot = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (dot) {
    const b = v4Bytes(dot[1]);
    if (!b) return null;
    s = s.slice(0, -dot[1].length) + ((b[0] << 8) | b[1]).toString(16) + ":" + ((b[2] << 8) | b[3]).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    out.push(n >> 8, n & 0xff);
  }
  return out.length === 16 ? out : null;
}

function isPublicV6(b: number[]): boolean {
  const zero = (from: number, to: number) => b.slice(from, to).every((x) => x === 0);
  // ::ffff:a.b.c.d (mapped) and 64:ff9b::a.b.c.d (NAT64): judge the IPv4.
  if (zero(0, 10) && b[10] === 0xff && b[11] === 0xff) return isPublicV4(b.slice(12));
  if (inPrefix(b, [0x00, 0x64, 0xff, 0x9b], 32) && zero(4, 12)) return isPublicV4(b.slice(12));
  // Only global unicast (2000::/3), minus special-purpose blocks inside it.
  if (!inPrefix(b, [0x20], 3)) return false;
  const blocked: [number[], number][] = [
    [[0x20, 0x01, 0x00, 0x00], 23], // IETF protocol assignments (Teredo, ORCHID…)
    [[0x20, 0x01, 0x0d, 0xb8], 32], // documentation
    [[0x20, 0x02], 16], // 6to4 (embeds any IPv4)
  ];
  return !blocked.some(([p, len]) => inPrefix(b, p, len));
}

/** False for loopback, private, link-local, metadata, multicast, reserved and malformed. */
export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const b = v4Bytes(ip);
    return b !== null && isPublicV4(b);
  }
  if (kind === 6) {
    const b = v6Bytes(ip);
    return b !== null && isPublicV6(b);
  }
  return false;
}
