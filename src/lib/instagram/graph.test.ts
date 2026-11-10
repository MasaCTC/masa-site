// Graph client: the token must only ever travel in the Authorization header
// and must never survive into a thrown error.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  graphGet,
  instagramConfig,
  InstagramApiError,
  scrubSecrets,
  type FetchLike,
} from "./graph.ts";

const TOKEN = "EAAFAKE_TOKEN_123";
const cfg = { token: TOKEN };

type Call = { url: string; init?: RequestInit };
function fakeFetch(
  respond: (url: string) => Response | Promise<Response>,
  calls: Call[] = [],
): FetchLike {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url);
  }) as FetchLike;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function catchErr(p: Promise<unknown>): Promise<InstagramApiError> {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof InstagramApiError);
    return e;
  }
  assert.fail("expected rejection");
}
function assertClean(err: Error) {
  for (const s of [
    err.message,
    err.stack ?? "",
    JSON.stringify(err),
    JSON.stringify(err, Object.getOwnPropertyNames(err)),
    String(err.cause ?? ""),
  ]) {
    assert.ok(!s.includes(TOKEN), "token leaked");
  }
}

test("token only in Authorization header, never in URL", async () => {
  const calls: Call[] = [];
  const f = fakeFetch(() => json({ id: "1" }), calls);
  const out = await graphGet("123", { fields: "id,username" }, cfg, f);
  assert.deepEqual(out, { id: "1" });
  assert.equal(calls.length, 1);
  const u = new URL(calls[0].url);
  assert.equal(u.origin + u.pathname, "https://graph.facebook.com/v25.0/123");
  assert.equal(u.searchParams.get("fields"), "id,username");
  assert.ok(!calls[0].url.includes(TOKEN));
  assert.ok(!u.searchParams.has("access_token"));
  const init = calls[0].init!;
  assert.equal(
    new Headers(init.headers).get("authorization"),
    `Bearer ${TOKEN}`,
  );
  assert.equal(init.cache, "no-store");
  assert.ok(init.signal instanceof AbortSignal);
});

test("400 echoing the token -> scrubbed InstagramApiError with status/code", async () => {
  const f = fakeFetch(() =>
    json(
      {
        error: {
          message: `Invalid token ${TOKEN} in Bearer ${TOKEN} ?access_token=${TOKEN}&x=1`,
          code: 190,
        },
      },
      400,
    ),
  );
  const err = await catchErr(graphGet("123", {}, cfg, f));
  assert.equal(err.status, 400);
  assert.equal(err.code, 190);
  assert.match(err.message, /^Instagram API 400: /);
  assertClean(err);
});

test("non-JSON error body -> generic message", async () => {
  const f = fakeFetch(() => new Response(`oops ${TOKEN}`, { status: 502 }));
  const err = await catchErr(graphGet("123", {}, cfg, f));
  assert.equal(err.status, 502);
  assert.match(err.message, /^Instagram API 502/);
  assertClean(err);
});

test("invalid JSON on 200 -> InstagramApiError", async () => {
  const f = fakeFetch(() => new Response("not json", { status: 200 }));
  const err = await catchErr(graphGet("123", {}, cfg, f));
  assert.ok(err instanceof InstagramApiError);
  assertClean(err);
});

test("network error carrying the token -> scrubbed, no raw cause", async () => {
  const f: FetchLike = (async () => {
    throw new TypeError(`fetch failed for Bearer ${TOKEN} token=${TOKEN}`);
  }) as FetchLike;
  const err = await catchErr(graphGet("123", {}, cfg, f));
  assert.equal(err.cause, undefined);
  assertClean(err);
});

test("timeout -> InstagramApiError", async () => {
  const f: FetchLike = (async () => {
    throw new DOMException("The operation was aborted", "TimeoutError");
  }) as FetchLike;
  const err = await catchErr(graphGet("123", {}, cfg, f));
  assertClean(err);
});

test("scrubSecrets removes token, Bearer runs and access_token values", () => {
  const s = scrubSecrets(
    `a ${TOKEN} b ${TOKEN} Bearer abc.DEF-123 ?access_token=zzz999&y=2`,
    TOKEN,
  );
  assert.ok(!s.includes(TOKEN));
  assert.ok(!s.includes("abc.DEF-123"));
  assert.ok(!s.includes("zzz999"));
  assert.ok(s.includes("y=2"));
  assert.ok(!scrubSecrets("Bearer xyz").includes("xyz"));
});

test("instagramConfig: null if either var missing or blank", () => {
  assert.equal(instagramConfig({}), null);
  assert.equal(
    instagramConfig({ INSTAGRAM_ACCESS_TOKEN: TOKEN }),
    null,
  );
  assert.equal(instagramConfig({ INSTAGRAM_USER_ID: "1" }), null);
  assert.equal(
    instagramConfig({ INSTAGRAM_ACCESS_TOKEN: "   ", INSTAGRAM_USER_ID: "1" }),
    null,
  );
  assert.equal(
    instagramConfig({ INSTAGRAM_ACCESS_TOKEN: TOKEN, INSTAGRAM_USER_ID: " " }),
    null,
  );
  assert.deepEqual(
    instagramConfig({
      INSTAGRAM_ACCESS_TOKEN: ` ${TOKEN} `,
      INSTAGRAM_USER_ID: "17841",
    }),
    { token: TOKEN, userId: "17841" },
  );
});
