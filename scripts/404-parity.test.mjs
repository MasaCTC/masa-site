// 404 parity: a signed-out request to /planner (or /planner/*) must be
// indistinguishable from any other missing URL — same status, same headers,
// same body. Direct hits on the internal /owner-planner route are checked too,
// with only the proxy-rewrite headers allowed to differ (see INTERNAL_PAIRS). Runs against a real server, so it lives outside the src/** glob
// that `npm test` uses. Run `npm run build` first, then `npm run test:404`.
// Set BASE_URL to test a running deployment instead of starting `next start`.
//
// Only localhost is contacted unless BASE_URL says otherwise.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Headers that legitimately differ between any two responses (per request
// timing / socket state). Against the local `next start` nothing else is
// ignored.
const VOLATILE_HEADERS = new Set(["date", "connection", "keep-alive"]);

// Only with BASE_URL (a deployment behind a CDN): per-request CDN/edge headers
// that differ between ANY two requests, missing or not. Fixed list; each one
// that is actually ignored is printed. x-matched-path and the like are NOT here
// on purpose: they could reveal a route.
const CDN_VOLATILE_HEADERS = new Set([
  "x-vercel-id",
  "x-vercel-cache",
  "age",
  "server-timing",
  "x-vercel-execution-region",
  "cf-ray",
  "x-amz-cf-id",
  "x-amz-cf-pop",
  "x-cache",
  "via",
]);

// Must be identical in every respect (status, all headers, body).
const PAIRS = [
  ["/planner", "/nope-xyz"],
  ["/planner/a/b", "/nope-xyz/a/b"],
  ["/%70lanner", "/%6Eope-xyz"],
];

// The internal route the owner is rewritten to, reached directly (any spelling
// Next routes there). A non-owner gets the same status and body as an unknown
// URL, but the proxy has to rewrite to get it, and Next adds rewrite headers to
// every proxy rewrite. Those headers, and only those, are the known difference;
// anything else fails.
const INTERNAL_PAIRS = [
  ["/owner-planner", "/nope-xyz"],
  ["/owner-planner/a/b", "/nope-xyz/a/b"],
  ["/owner%2Dplanner", "/nope%2Dxyz"],
  ["/%6Fwner-planner", "/%6Eope-xyz"],
];
const INTERNAL_KNOWN_DIFFS = new Set(["x-middleware-rewrite", "x-nextjs-rewritten-path"]);

const VARIANTS = [
  { name: "GET", method: "GET", headers: {} },
  { name: "GET with RSC: 1", method: "GET", headers: { RSC: "1" } },
  { name: "HEAD", method: "HEAD", headers: {} },
  {
    name: "GET with a garbage session cookie",
    method: "GET",
    headers: { Cookie: "authjs.session-token=garbage" },
  },
  { name: "prefetch (RSC + Next-Router-Prefetch)", method: "GET", headers: { RSC: "1", "Next-Router-Prefetch": "1" } },
  {
    name: "server action POST",
    method: "POST",
    headers: { "Next-Action": "0".repeat(40), "Content-Type": "text/plain;charset=UTF-8" },
    body: "[]",
  },
];

const remote = Boolean(process.env.BASE_URL);
const ignoredCdnHeaders = new Set();

let base = process.env.BASE_URL?.replace(/\/$/, "");
let server;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited with ${child.exitCode}`);
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("next start did not come up in time");
}

before(async () => {
  if (base) return;
  const port = await freePort();
  server = spawn(
    process.execPath,
    [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      // Empty Instagram config (next start keeps keys already set, even empty,
      // over .env.local): if a cached page regenerates during the run, the
      // server uses the manual stats instead of calling Instagram.
      env: { ...process.env, NODE_ENV: "production", INSTAGRAM_ACCESS_TOKEN: "", INSTAGRAM_USER_ID: "" },
    },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  base = `http://127.0.0.1:${port}`;
  try {
    await waitForServer(`${base}/nope-warmup`, server);
  } catch (err) {
    throw new Error(`${err.message}\n${log}`);
  }
});

after(() => {
  server?.kill("SIGTERM");
  if (remote) {
    const list = [...ignoredCdnHeaders].sort().join(", ") || "(none seen)";
    console.log(`BASE_URL run: ignored CDN-volatile headers: ${list}`);
  }
});

async function snapshot(p, variant) {
  const res = await fetch(base + p, {
    method: variant.method,
    headers: variant.headers,
    body: variant.body,
    redirect: "manual",
  });
  const body = variant.method === "HEAD" ? "" : await res.text();
  const headers = {};
  // getSetCookie keeps multiple Set-Cookie headers apart.
  for (const [k, v] of res.headers) {
    if (VOLATILE_HEADERS.has(k) || k === "set-cookie") continue;
    if (remote && CDN_VOLATILE_HEADERS.has(k)) {
      ignoredCdnHeaders.add(k);
      continue;
    }
    headers[k] = v.split(p).join("<PATH>");
  }
  const cookies = res.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies.map((c) => c.split(p).join("<PATH>"));
  return { status: res.status, headers, body: body.split(p).join("<PATH>") };
}

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return null;
  return { at: i, planner: a.slice(Math.max(0, i - 80), i + 120), unknown: b.slice(Math.max(0, i - 80), i + 120) };
}

/** Every status/header/body difference between a and b (path-normalized). */
function differences(a, b, labelA, labelB) {
  const diffs = [];
  if (a.status !== b.status) diffs.push({ kind: "status", text: `status: ${a.status} vs ${b.status}` });
  for (const k of new Set([...Object.keys(a.headers), ...Object.keys(b.headers)])) {
    const av = JSON.stringify(a.headers[k]);
    const bv = JSON.stringify(b.headers[k]);
    if (av !== bv) diffs.push({ kind: "header", name: k, text: `header ${k}: ${av ?? "(absent)"} vs ${bv ?? "(absent)"}` });
  }
  const d = firstDiff(a.body, b.body);
  if (d) {
    diffs.push({
      kind: "body",
      text: `body differs at ${d.at}:\n  ${labelA}: ${JSON.stringify(d.planner)}\n  ${labelB}: ${JSON.stringify(d.unknown)}`,
    });
  }
  return diffs;
}

async function compare(p, unknown, variant) {
  // Warm both once so a cold cache on either side cannot cause a difference.
  await snapshot(unknown, variant);
  await snapshot(p, variant);
  const a = await snapshot(p, variant);
  const b = await snapshot(unknown, variant);
  return { a, b, diffs: differences(a, b, p, unknown) };
}

for (const variant of VARIANTS) {
  describe(variant.name, () => {
    for (const [planner, unknown] of PAIRS) {
      test(`${planner} looks exactly like ${unknown}`, async () => {
        const { b, diffs } = await compare(planner, unknown, variant);
        if (variant.method !== "POST") assert.equal(b.status, 404, `${unknown} should be a real 404`);
        // Collect every difference first, so a header leak cannot hide a body leak.
        assert.deepEqual(
          diffs.map((d) => d.text),
          [],
          `${planner} vs ${unknown}:\n${diffs.map((d) => d.text).join("\n")}`,
        );
      });
    }
    for (const [internal, unknown] of INTERNAL_PAIRS) {
      test(`${internal} matches ${unknown} except rewrite headers`, async (t) => {
        const { diffs } = await compare(internal, unknown, variant);
        const known = diffs.filter((d) => d.kind === "header" && INTERNAL_KNOWN_DIFFS.has(d.name));
        const other = diffs.filter((d) => !known.includes(d));
        for (const d of known) t.diagnostic(`known difference: ${d.text}`);
        assert.deepEqual(
          other.map((d) => d.text),
          [],
          `${internal} vs ${unknown}:\n${other.map((d) => d.text).join("\n")}`,
        );
      });
    }
  });
}
