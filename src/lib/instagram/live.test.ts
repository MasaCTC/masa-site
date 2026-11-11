import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchLiveResult, fetchLiveStats, mapLiveStats } from "./live.ts";
import { ACCOUNT_START_DATE } from "./config.ts";
import { InstagramApiError, type FetchLike } from "./graph.ts";
import { NOW, profile, media, reelInsights, accountChunks } from "./fixtures/live-fixtures.ts";

const TOKEN = "EAAFAKE_TOKEN_123";
const cfg = { token: TOKEN, userId: "17841000000000001" };
const nowSec = Math.floor(NOW.getTime() / 1000);
const sinceFor = (i: number) => String(nowSec - i * 30 * 86400 - 30 * 86400 + 60);

type Call = { url: string; init?: RequestInit };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function makeFetch(
  calls: Call[] = [],
  over: {
    media?: unknown;
    chunks?: unknown[];
    fail?: (u: URL) => Response | undefined;
  } = {},
): FetchLike {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const u = new URL(url);
    const f = over.fail?.(u);
    if (f) return f;
    const p = u.pathname;
    if (p.endsWith("/media")) return json(over.media ?? media);
    if (p.endsWith("/insights")) {
      const id = p.split("/").at(-2)!;
      if (id === cfg.userId) {
        const since = u.searchParams.get("since");
        const i = [0, 1, 2].find((n) => sinceFor(n) === since);
        assert.notEqual(i, undefined, `unexpected since ${since}`);
        return json((over.chunks ?? accountChunks)[i!]);
      }
      return json(reelInsights[id]);
    }
    return json(profile);
  }) as FetchLike;
}

const live = (over?: Parameters<typeof makeFetch>[1], calls: Call[] = []) =>
  fetchLiveStats({ fetchImpl: makeFetch(calls, over), now: NOW, cfg });

test("basic fields", async () => {
  const s = await live();
  assert.equal(s.source, "instagram-api");
  assert.equal(s.status, "live");
  assert.equal(s.pulledAt, "2026-11-10");
  assert.deepEqual(s.followers, { kind: "value", value: 14200 });
  assert.equal(s.startDate, "2026-09-07");
  assert.equal(s.followerHistory, null);
  assert.deepEqual(s.othersViews, { kind: "placeholder", label: "[ALL OTHERS VIEWS]" });
  assert.deepEqual(s.followerGain30d, { kind: "placeholder", label: "[30-DAY GAIN]" });
});

test("totals are the sum of the three chunks", async () => {
  const s = await live();
  assert.deepEqual(s.totals.views, { kind: "value", value: 60000 });
  assert.deepEqual(s.totals.interactions, { kind: "value", value: 9000 });
  assert.deepEqual(s.totals.likes, { kind: "value", value: 6000 });
  assert.deepEqual(s.totals.shares, { kind: "value", value: 1800 });
  assert.deepEqual(s.totals.saves, { kind: "value", value: 1200 });
});

test("missing metric in one chunk makes that whole total a placeholder", async () => {
  const chunks = structuredClone(accountChunks);
  chunks[1].data = chunks[1].data.filter((d) => d.name !== "shares");
  const s = await live({ chunks });
  assert.deepEqual(s.totals.shares, { kind: "placeholder", label: "[TOTAL SHARES]" });
  assert.deepEqual(s.totals.views, { kind: "value", value: 60000 });
});

test("all placeholder labels for missing totals", () => {
  const s = mapLiveStats(
    { profile, media, reelInsights, account90d: [{ data: [] }, { data: [] }, { data: [] }] },
    NOW,
  );
  assert.deepEqual(
    [s.totals.views, s.totals.interactions, s.totals.likes, s.totals.shares, s.totals.saves].map(
      (m) => (m.kind === "placeholder" ? m.label : "x"),
    ),
    ["[TOTAL VIEWS]", "[TOTAL INTERACTIONS]", "[TOTAL LIKES]", "[TOTAL SHARES]", "[TOTAL SAVES]"],
  );
  assert.deepEqual(s.engagementRate, { kind: "placeholder", label: "[ENGAGEMENT RATE]" });
  assert.deepEqual(s.topReelShare, { kind: "placeholder", label: "[TOP REEL SHARE]" });
});

test("topReels: reels only, ranked by views, top 3 of 4", async () => {
  const s = await live();
  assert.equal(s.topReels.length, 3);
  assert.deepEqual(
    s.topReels.map((r) => [r.rank, r.url]),
    [
      [1, "https://www.instagram.com/reel/BBB222/"],
      [2, "https://www.instagram.com/reel/CCC333/"],
      [3, "https://www.instagram.com/reel/AAA111/"],
    ],
  );
  const r1 = s.topReels[0];
  assert.equal(r1.postedOn, "2026-09-12");
  assert.deepEqual(r1.views, { kind: "value", value: 9000 });
  assert.deepEqual(r1.likes, { kind: "value", value: 800 });
  assert.deepEqual(r1.comments, { kind: "value", value: 30 });
  assert.deepEqual(r1.shares, { kind: "value", value: 200 });
  assert.deepEqual(r1.saves, { kind: "value", value: 90 });
  assert.deepEqual(r1.follows, { kind: "placeholder", label: "[REEL 1 FOLLOWS]" });
  assert.deepEqual(r1.thumbnail, { kind: "placeholder", label: "[REEL 1 THUMBNAIL]" });
});

test("fewer than 3 reels gives a shorter array", () => {
  const m = { data: [media.data[0], media.data[4]] };
  const s = mapLiveStats({ profile, media: m, reelInsights, account90d: accountChunks }, NOW);
  assert.equal(s.topReels.length, 1);
});

test("caption trimmed; empty caption -> placeholder", async () => {
  const s = await live();
  const byUrl = (u: string) => s.topReels.find((r) => r.url?.includes(u))!;
  assert.deepEqual(byUrl("AAA111").caption, { kind: "text", text: "First reel caption" });
  assert.deepEqual(byUrl("BBB222").caption, {
    kind: "placeholder",
    label: `[REEL ${byUrl("BBB222").rank} CAPTION]`,
  });
  const all = mapLiveStats(
    { profile, media: { data: [media.data[3]] }, reelInsights, account90d: accountChunks },
    NOW,
  );
  assert.deepEqual(all.topReels[0].caption, { kind: "placeholder", label: "[REEL 1 CAPTION]" });
});

test("thumbnailUrl host allow-list", async () => {
  const s = await live();
  const byUrl = (u: string) => s.topReels.find((r) => r.url?.includes(u))!;
  assert.equal(byUrl("AAA111").thumbnailUrl, media.data[0].thumbnail_url);
  assert.equal(byUrl("CCC333").thumbnailUrl, media.data[2].thumbnail_url);
  assert.equal("thumbnailUrl" in byUrl("BBB222"), false);
  const http = mapLiveStats(
    { profile, media: { data: [media.data[3]] }, reelInsights, account90d: accountChunks },
    NOW,
  );
  assert.equal("thumbnailUrl" in http.topReels[0], false);
  const lookalike = structuredClone(media.data[0]);
  lookalike.thumbnail_url = "https://evilcdninstagram.com/x.jpg";
  const l = mapLiveStats(
    { profile, media: { data: [lookalike] }, reelInsights, account90d: accountChunks },
    NOW,
  );
  assert.equal("thumbnailUrl" in l.topReels[0], false);
});

test("engagementRate and topReelShare", async () => {
  const s = await live();
  assert.deepEqual(s.engagementRate, { kind: "value", value: 15 });
  // 9000 / 60000 = 15%
  assert.deepEqual(s.topReelShare, { kind: "value", value: 15 });
});

test("topReelShare placeholder when top reel is older than 90 days", () => {
  const old = structuredClone(media);
  old.data[1].timestamp = "2026-06-01T00:00:00+0000";
  const s = mapLiveStats({ profile, media: old, reelInsights, account90d: accountChunks }, NOW);
  assert.deepEqual(s.topReelShare, { kind: "placeholder", label: "[TOP REEL SHARE]" });
});

test("startDate is the fixed account start date regardless of media timestamps", () => {
  const withStamps = (ts: string[]) => ({
    data: ts.map((timestamp, i) => ({ id: `m${i}`, media_product_type: "REELS", timestamp })),
  });
  for (const m of [
    { data: [] },
    withStamps(["2026-10-30T00:00:00+0000"]), // all later
    withStamps(["2026-01-01T00:00:00+0000"]), // earlier
  ]) {
    const s = mapLiveStats({ profile, media: m, reelInsights: {}, account90d: accountChunks }, NOW);
    assert.equal(s.startDate, ACCOUNT_START_DATE);
    assert.equal(s.startDate, "2026-09-07");
  }
});

test("no media yields no top reels", () => {
  const s = mapLiveStats(
    { profile, media: { data: [] }, reelInsights: {}, account90d: accountChunks },
    NOW,
  );
  assert.deepEqual(s.topReels, []);
});

test("requests: no follows, Bearer header, token never in URL, 3 chunks", async () => {
  const calls: Call[] = [];
  await live(undefined, calls);
  assert.equal(calls.length, 2 + 3 + 4);
  for (const c of calls) {
    assert.ok(!c.url.includes(TOKEN));
    assert.ok(!c.url.includes("access_token"));
    const h = new Headers(c.init?.headers);
    assert.equal(h.get("authorization"), `Bearer ${TOKEN}`);
  }
  const reelCalls = calls.filter((c) => /\/m\d\/insights/.test(c.url));
  assert.equal(reelCalls.length, 4);
  for (const c of reelCalls) {
    const metric = new URL(c.url).searchParams.get("metric")!;
    assert.equal(metric, "views,likes,comments,shares,saved");
    assert.ok(!metric.includes("follows"));
  }
  const acct = calls.filter((c) => new URL(c.url).searchParams.has("since"));
  assert.equal(acct.length, 3);
  for (const c of acct) {
    const q = new URL(c.url).searchParams;
    assert.ok(Number(q.get("until")) - Number(q.get("since")) <= 30 * 86400);
    assert.equal(q.get("metric_type"), "total_value");
  }
});

test("a failing account-level request rejects with a scrubbed error", async () => {
  await assert.rejects(
    live({
      fail: (u) =>
        u.pathname.endsWith(`/${cfg.userId}`)
          ? json({ error: { message: `bad ${TOKEN}`, code: 100 } }, 400)
          : undefined,
    }),
    (e: unknown) => {
      assert.ok(e instanceof InstagramApiError);
      assert.ok(!e.message.includes(TOKEN));
      return true;
    },
  );
});

async function captureErrors<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const orig = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  try {
    return { result: await fn(), logs: lines.join("\n") };
  } finally {
    console.error = orig;
  }
}

test("one reel insights failure: stays live, that reel's metrics are placeholders, others intact", async () => {
  const fail = (u: URL) =>
    u.pathname.endsWith("/m2/insights")
      ? json({ error: { message: `boom ${TOKEN}` } }, 500)
      : undefined;
  const { result, logs } = await captureErrors(() =>
    fetchLiveResult({
      fetchImpl: makeFetch([], { fail, media: { data: [media.data[0], media.data[1], media.data[2]] } }),
      now: NOW,
      cfg,
    }),
  );
  const s = result.stats;
  assert.equal(result.failedReels, 1);
  assert.equal(s.status, "live");
  assert.equal(s.source, "instagram-api");
  assert.deepEqual(s.totals.views, { kind: "value", value: 60000 });
  assert.equal(s.topReels.length, 3);
  const bad = s.topReels.find((r) => r.url?.includes("BBB222"))!;
  for (const k of ["views", "likes", "comments", "shares", "saves"] as const) {
    assert.equal(bad[k].kind, "placeholder");
  }
  assert.equal(bad.caption.kind, "placeholder"); // m2 has no caption in the fixture; link stays
  assert.equal(bad.url, "https://www.instagram.com/reel/BBB222/");
  const ok = s.topReels.find((r) => r.url?.includes("CCC333"))!;
  assert.deepEqual(ok.views, { kind: "value", value: 7000 });
  assert.equal(s.topReels.at(-1), bad); // unknown views rank last
  assert.equal(logs.split("\n").length, 1);
  assert.ok(!logs.includes(TOKEN));
  assert.ok(!logs.includes("m2"));
});

test("account-level failure still throws (full manual fallback)", async () => {
  const fail = (u: URL) =>
    u.pathname.endsWith("/media") ? json({ error: { message: "down" } }, 500) : undefined;
  await assert.rejects(() => live({ fail }), InstagramApiError);
  const failChunk = (u: URL) =>
    u.pathname.endsWith(`/${cfg.userId}/insights`) && u.searchParams.get("since") === sinceFor(1)
      ? json({ error: { message: "down" } }, 500)
      : undefined;
  await assert.rejects(() => live({ fail: failChunk }), InstagramApiError);
});

test("no reel failures: failedReels is 0 and nothing is logged", async () => {
  const { result, logs } = await captureErrors(() =>
    fetchLiveResult({ fetchImpl: makeFetch(), now: NOW, cfg }),
  );
  assert.equal(result.failedReels, 0);
  assert.equal(logs, "");
});

test("a reel whose insights failed ranks after known reels (may fall out of the top 3)", async () => {
  const fail = (u: URL) => (u.pathname.endsWith("/m2/insights") ? json({}, 500) : undefined);
  const { result } = await captureErrors(() =>
    fetchLiveResult({ fetchImpl: makeFetch([], { fail }), now: NOW, cfg }),
  );
  assert.equal(result.failedReels, 1);
  assert.deepEqual(
    result.stats.topReels.map((r) => r.url?.split("/").at(-2)),
    ["CCC333", "AAA111", "DDD444"],
  );
});

test("pulledAt is the Pacific date, across the UTC/Pacific boundary (PST)", () => {
  const at = (iso: string) =>
    mapLiveStats({ profile, media, reelInsights, account90d: accountChunks }, new Date(iso)).pulledAt;
  assert.equal(at("2026-11-11T00:30:00Z"), "2026-11-10"); // 4:30 PM PST Nov 10
  assert.equal(at("2026-11-11T07:59:00Z"), "2026-11-10"); // 23:59 PST Nov 10
  assert.equal(at("2026-11-11T08:00:00Z"), "2026-11-11"); // midnight PST Nov 11
});

test("pulledAt is the Pacific date across the PDT boundary", () => {
  const at = (iso: string) =>
    mapLiveStats({ profile, media, reelInsights, account90d: accountChunks }, new Date(iso)).pulledAt;
  assert.equal(at("2026-07-01T06:59:00Z"), "2026-06-30"); // 23:59 PDT Jun 30
  assert.equal(at("2026-07-01T07:00:00Z"), "2026-07-01"); // midnight PDT Jul 1
});

test("reel postedOn is the Pacific date; unparseable timestamp falls back to pulledAt", () => {
  const one = (timestamp: unknown) =>
    mapLiveStats(
      {
        profile,
        media: { data: [{ ...media.data[0], timestamp }] },
        reelInsights,
        account90d: accountChunks,
      },
      new Date("2026-11-11T00:30:00Z"),
    );
  assert.equal(one("2026-10-21T05:30:00+0000").topReels[0].postedOn, "2026-10-20"); // 22:30 PDT Oct 20
  assert.equal(one("2026-10-21T07:00:00+0000").topReels[0].postedOn, "2026-10-21"); // 00:00 PDT Oct 21
  assert.equal(one("2026-11-11T07:59:00+0000").topReels[0].postedOn, "2026-11-10"); // PST
  const bad = one("garbage");
  assert.equal(bad.topReels[0].postedOn, bad.pulledAt);
  assert.equal(bad.pulledAt, "2026-11-10");
});
