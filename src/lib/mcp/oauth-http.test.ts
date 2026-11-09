// HTTP handlers for the MCP OAuth endpoints (thin route files call these).
import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken } from "./tokens.ts";
import type { GithubFetch } from "./oauth.ts";
import {
  handleAuthorizationServerMetadata,
  handleAuthorizeGet,
  handleAuthorizePost,
  handleCorsPreflight,
  handleGithubCallback,
  handleToken,
  handleTokenPreflight,
  handleProtectedResourceMetadata,
  handleRegister,
} from "./oauth-http.ts";

process.env.MCP_OAUTH_SECRET = "k".repeat(48);
process.env.AUTH_GITHUB_ID = "gh-client-id";

const BASE = "https://masa.example";
const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

async function registered(name: string, uris = [CLAUDE]) {
  const res = await handleRegister(
    new Request(`${BASE}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: name, redirect_uris: uris }),
    }),
  );
  assert.equal(res.status, 201);
  return ((await res.json()) as { client_id: string }).client_id;
}

async function authorizeUrl(name = "Claude", over: Record<string, string> = {}) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: await registered(name),
    redirect_uri: CLAUDE,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "st",
    ...over,
  });
  return `${BASE}/oauth/authorize?${p}`;
}

function csrfFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const m = /mcp_oauth_csrf=([^;]+)/.exec(set);
  assert.ok(m, `no csrf cookie in ${set}`);
  return m[1];
}

function consentFrom(html: string): string {
  const m = /name="consent" value="([^"]+)"/.exec(html);
  assert.ok(m, "no consent field");
  return m[1];
}

// ---------- metadata ----------

test("AS metadata is JSON for the request origin, with CORS", async () => {
  const res = await handleAuthorizationServerMetadata(
    new Request("http://internal/.well-known/oauth-authorization-server", {
      headers: { "x-forwarded-host": "masa.example", "x-forwarded-proto": "https" },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const m = (await res.json()) as Record<string, unknown>;
  assert.equal(m.issuer, BASE);
  assert.equal(m.registration_endpoint, `${BASE}/oauth/register`);
});

test("protected resource metadata names /api/mcp", async () => {
  const res = await handleProtectedResourceMetadata(
    new Request(`${BASE}/.well-known/oauth-protected-resource`),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const m = (await res.json()) as Record<string, unknown>;
  assert.equal(m.resource, `${BASE}/api/mcp`);
  assert.deepEqual(m.authorization_servers, [BASE]);
});

test("CORS preflight", async () => {
  const res = handleCorsPreflight();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.match(res.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(res.headers.get("access-control-allow-headers") ?? "", /content-type/i);
});

// ---------- register ----------

test("register: 201 JSON with no-store and CORS", async () => {
  const res = await handleRegister(
    new Request(`${BASE}/oauth/register`, {
      method: "POST",
      body: JSON.stringify({ client_name: "Inspector", redirect_uris: ["http://localhost:6274/oauth/callback"] }),
    }),
  );
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const json = (await res.json()) as Record<string, unknown>;
  assert.ok(verifyToken("client", json.client_id as string));
});

test("register: bad JSON is invalid_client_metadata", async () => {
  const res = await handleRegister(new Request(`${BASE}/oauth/register`, { method: "POST", body: "{" }));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "invalid_client_metadata" });
});

test("register: oversize body is rejected", async () => {
  const res = await handleRegister(
    new Request(`${BASE}/oauth/register`, {
      method: "POST",
      body: JSON.stringify({ client_name: "x", redirect_uris: [CLAUDE], pad: "p".repeat(20_000) }),
    }),
  );
  assert.equal(res.status, 400);
});

test("register: off-allowlist URI is invalid_redirect_uri", async () => {
  const res = await handleRegister(
    new Request(`${BASE}/oauth/register`, {
      method: "POST",
      body: JSON.stringify({ redirect_uris: ["https://evil.test/cb"] }),
    }),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "invalid_redirect_uri" });
});

test("handlers return a bare 500 when MCP_OAUTH_SECRET is missing", async () => {
  const saved = process.env.MCP_OAUTH_SECRET;
  delete process.env.MCP_OAUTH_SECRET;
  try {
    const res = await handleRegister(
      new Request(`${BASE}/oauth/register`, {
        method: "POST",
        body: JSON.stringify({ redirect_uris: [CLAUDE] }),
      }),
    );
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.doesNotMatch(text, /MCP_OAUTH_SECRET/);
    assert.doesNotMatch(text, /client_id/);

    process.env.MCP_OAUTH_SECRET = "short";
    const get = await handleAuthorizeGet(
      new Request(`${BASE}/oauth/authorize?response_type=code&client_id=a.b&redirect_uri=${encodeURIComponent(CLAUDE)}`),
    );
    assert.equal(get.status, 500);
    assert.equal(get.headers.get("location"), null);
    assert.doesNotMatch(await get.text(), /MCP_OAUTH_SECRET/);

    const post = await handleAuthorizePost(
      new Request(`${BASE}/oauth/authorize`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: "mcp_oauth_csrf=x" },
        body: "consent=a.b",
      }),
    );
    assert.equal(post.status, 500);
    assert.equal(post.headers.get("location"), null);
  } finally {
    process.env.MCP_OAUTH_SECRET = saved;
  }
});

// ---------- GET /oauth/authorize (consent page) ----------

test("consent page: escaped client name, exact redirect URI, anti-framing, no GitHub redirect", async () => {
  const evilName = `<script>alert("x")</script>&'`;
  const res = await handleAuthorizeGet(new Request(await authorizeUrl(evilName)));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
  assert.match(res.headers.get("content-type") ?? "", /^text\/html; charset=utf-8/);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  const csp = res.headers.get("content-security-policy") ?? "";
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'self' https:\/\/github\.com/);
  assert.doesNotMatch(csp, /script-src [^;]*'unsafe-inline'/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");

  const html = await res.text();
  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;"));
  assert.ok(html.includes(CLAUDE));
  assert.match(html, /<form method="post" action="\/oauth\/authorize">/);
  assert.match(html, />Approve</);
  assert.match(html, /Cancel/);
  // The page itself never points the browser at GitHub.
  assert.equal(html.includes("github.com/login"), false);

  const csrf = csrfFrom(res);
  const set = res.headers.get("set-cookie") ?? "";
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  assert.match(set, /Path=\/oauth\/authorize/);
  assert.match(set, /Max-Age=600/);
  assert.match(set, /Secure/);
  const consent = verifyToken("consent", consentFrom(html));
  assert.ok(consent);
  assert.equal(consent.client_name, evilName);
  assert.ok(csrf.length >= 32);
});

test("consent page escapes a hostile redirect-URI query", async () => {
  const uri = `http://localhost:1/cb?a="><b>x</b>`;
  const p = new URLSearchParams({
    response_type: "code",
    client_id: await registered("c", [uri]),
    redirect_uri: uri,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
  });
  const res = await handleAuthorizeGet(new Request(`${BASE}/oauth/authorize?${p}`));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.equal(html.includes("<b>x</b>"), false);
  assert.ok(html.includes("&quot;&gt;&lt;b&gt;x&lt;/b&gt;"));
});

test("GET with an unknown client renders an error page (400), never redirects", async () => {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: "nope.nope",
    redirect_uri: CLAUDE,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
  });
  const res = await handleAuthorizeGet(new Request(`${BASE}/oauth/authorize?${p}`));
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("location"), null);
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("GET with plain PKCE redirects back to the client with an error, not to GitHub", async () => {
  const res = await handleAuthorizeGet(
    new Request(await authorizeUrl("Claude", { code_challenge_method: "plain" })),
  );
  assert.equal(res.status, 302);
  const loc = new URL(res.headers.get("location")!);
  assert.equal(`${loc.origin}${loc.pathname}`, CLAUDE);
  assert.equal(loc.searchParams.get("error"), "invalid_request");
  assert.equal(loc.searchParams.get("state"), "st");
});

test("GET ?cancelled=1 shows a plain Cancelled page", async () => {
  const res = await handleAuthorizeGet(new Request(`${BASE}/oauth/authorize?cancelled=1`));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null);
  assert.match(await res.text(), /Cancelled/);
});

// ---------- POST /oauth/authorize (approve) ----------

async function consentAndCookie() {
  const res = await handleAuthorizeGet(new Request(await authorizeUrl()));
  return { consent: consentFrom(await res.text()), csrf: csrfFrom(res) };
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request(`${BASE}/oauth/authorize`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
}

test("POST approve: 302 to GitHub with the nonce cookie bound to the state", async () => {
  const { consent, csrf } = await consentAndCookie();
  const res = await handleAuthorizePost(
    post(new URLSearchParams({ consent }).toString(), {
      cookie: `other=1; mcp_oauth_csrf=${csrf}`,
      origin: BASE,
      "sec-fetch-site": "same-origin",
    }),
  );
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const loc = new URL(res.headers.get("location")!);
  assert.equal(`${loc.origin}${loc.pathname}`, "https://github.com/login/oauth/authorize");
  assert.equal(loc.searchParams.get("redirect_uri"), `${BASE}/api/auth/callback/github/mcp`);
  const state = verifyToken("state", loc.searchParams.get("state")!);
  assert.ok(state);
  const cookies = res.headers.getSetCookie();
  const nonceCookie = cookies.find((c) => c.startsWith("mcp_oauth_nonce="));
  assert.ok(nonceCookie);
  assert.equal(nonceCookie.split(";")[0], `mcp_oauth_nonce=${state.nonce}`);
  assert.match(nonceCookie, /HttpOnly/);
  assert.match(nonceCookie, /Secure/);
  assert.match(nonceCookie, /SameSite=Lax/);
  assert.match(nonceCookie, /Max-Age=600/);
});

test("POST approve works without Origin/Sec-Fetch-Site headers (older browsers)", async () => {
  const { consent, csrf } = await consentAndCookie();
  const res = await handleAuthorizePost(
    post(new URLSearchParams({ consent }).toString(), { cookie: `mcp_oauth_csrf=${csrf}` }),
  );
  assert.equal(res.status, 302);
});

test("POST without a consent token is 400, no redirect, no cookie", async () => {
  const { csrf } = await consentAndCookie();
  const res = await handleAuthorizePost(post("", { cookie: `mcp_oauth_csrf=${csrf}` }));
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("location"), null);
  assert.equal(res.headers.get("set-cookie"), null);
});

test("POST with a forged consent token is 400", async () => {
  const { consent, csrf } = await consentAndCookie();
  const res = await handleAuthorizePost(
    post(new URLSearchParams({ consent: consent.slice(0, -3) + "AAA" }).toString(), {
      cookie: `mcp_oauth_csrf=${csrf}`,
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("location"), null);
});

test("cross-site POST with a harvested consent token is rejected", async () => {
  // The attacker can mint a valid consent token by GETting /authorize themselves,
  // but the victim's browser does not hold the matching SameSite=Strict cookie.
  const { consent } = await consentAndCookie();
  const noCookie = await handleAuthorizePost(post(new URLSearchParams({ consent }).toString()));
  assert.equal(noCookie.status, 400);
  assert.equal(noCookie.headers.get("location"), null);

  const { csrf: victimCsrf } = await consentAndCookie();
  const wrongCookie = await handleAuthorizePost(
    post(new URLSearchParams({ consent }).toString(), { cookie: `mcp_oauth_csrf=${victimCsrf}` }),
  );
  assert.equal(wrongCookie.status, 400);
});

test("POST from another origin is rejected even with the right cookie", async () => {
  const { consent, csrf } = await consentAndCookie();
  for (const headers of [
    { origin: "https://evil.test" } as Record<string, string>,
    { origin: "null" },
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
  ]) {
    const res = await handleAuthorizePost(
      post(new URLSearchParams({ consent }).toString(), { cookie: `mcp_oauth_csrf=${csrf}`, ...headers }),
    );
    assert.equal(res.status, 403, JSON.stringify(headers));
    assert.equal(res.headers.get("location"), null);
  }
});

// ---------- GET /api/auth/callback/github/mcp ----------

const OWNER = "152247398";
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CALLBACK = `${BASE}/api/auth/callback/github/mcp`;

/** Runs register → consent → Approve and returns the GitHub state + nonce cookie. */
async function approved() {
  const { consent, csrf } = await consentAndCookie();
  const res = await handleAuthorizePost(
    post(new URLSearchParams({ consent }).toString(), { cookie: `mcp_oauth_csrf=${csrf}`, origin: BASE }),
  );
  assert.equal(res.status, 302);
  const state = new URL(res.headers.get("location") ?? "").searchParams.get("state") ?? "";
  const nonce = /mcp_oauth_nonce=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
  assert.ok(state && nonce);
  return { state, nonce };
}

const ghAs =
  (id: string | null): GithubFetch =>
  async () =>
    id === null ? null : { id };

function callbackReq(q: Record<string, string>, cookie?: string) {
  return new Request(`${CALLBACK}?${new URLSearchParams(q)}`, {
    headers: cookie ? { cookie } : {},
  });
}

function assertNonceCleared(res: Response) {
  const sc = res.headers.get("set-cookie") ?? "";
  assert.match(sc, /mcp_oauth_nonce=;/);
  assert.match(sc, /Max-Age=0/);
  assert.match(sc, /Path=\/api\/auth\/callback\/github\/mcp/);
}

test("callback: owner → 302 to the client with code + state, nonce cookie cleared", async () => {
  const { state, nonce } = await approved();
  const res = await handleGithubCallback(
    callbackReq({ code: "gh", state }, `mcp_oauth_nonce=${nonce}`),
    ghAs(OWNER),
  );
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assertNonceCleared(res);
  const loc = new URL(res.headers.get("location") ?? "");
  assert.equal(`${loc.origin}${loc.pathname}`, CLAUDE);
  assert.equal(loc.searchParams.get("state"), "st");
  assert.equal(verifyToken("code", loc.searchParams.get("code") ?? "")?.sub, OWNER);
});

test("callback: non-owner → 302 access_denied, no code, cookie cleared", async () => {
  const { state, nonce } = await approved();
  const res = await handleGithubCallback(
    callbackReq({ code: "gh", state }, `mcp_oauth_nonce=${nonce}`),
    ghAs("999"),
  );
  assert.equal(res.status, 302);
  assertNonceCleared(res);
  const loc = res.headers.get("location") ?? "";
  assert.doesNotMatch(loc, /code=/);
  assert.equal(new URL(loc).searchParams.get("error"), "access_denied");
});

test("callback: GitHub error param (user cancelled at GitHub) → access_denied redirect", async () => {
  const { state, nonce } = await approved();
  const res = await handleGithubCallback(
    callbackReq({ error: "access_denied", state }, `mcp_oauth_nonce=${nonce}`),
    ghAs(OWNER),
  );
  assert.equal(res.status, 302);
  assert.equal(new URL(res.headers.get("location") ?? "").searchParams.get("error"), "access_denied");
  assertNonceCleared(res);
});

test("callback: missing/mismatched nonce or bad state → 400 page, no Location, cookie cleared", async () => {
  const { state, nonce } = await approved();
  const cases = [
    callbackReq({ code: "gh", state }),
    callbackReq({ code: "gh", state }, "mcp_oauth_nonce=other"),
    callbackReq({ code: "gh", state: state.slice(0, -3) }, `mcp_oauth_nonce=${nonce}`),
    callbackReq({ code: "gh" }, `mcp_oauth_nonce=${nonce}`),
    new Request(`${CALLBACK}?code=gh&state=${state}&state=${state}`, { headers: { cookie: `mcp_oauth_nonce=${nonce}` } }),
  ];
  for (const req of cases) {
    const res = await handleGithubCallback(req, ghAs(OWNER));
    assert.equal(res.status, 400, req.url);
    assert.equal(res.headers.get("location"), null);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assertNonceCleared(res);
    assert.doesNotMatch(await res.text(), /code=/);
  }
});

test("callback: missing MCP_OAUTH_SECRET → bare 500 that still clears the cookie", async () => {
  const { state, nonce } = await approved();
  const saved = process.env.MCP_OAUTH_SECRET;
  delete process.env.MCP_OAUTH_SECRET;
  try {
    const res = await handleGithubCallback(
      callbackReq({ code: "gh", state }, `mcp_oauth_nonce=${nonce}`),
      ghAs(OWNER),
    );
    assert.equal(res.status, 500);
    assert.equal(res.headers.get("location"), null);
    assert.equal(await res.text(), "Server error");
    assertNonceCleared(res);
  } finally {
    process.env.MCP_OAUTH_SECRET = saved;
  }
});

// ---------- POST /oauth/token ----------

async function codeAndClient() {
  const { state, nonce } = await approved();
  const res = await handleGithubCallback(
    callbackReq({ code: "gh", state }, `mcp_oauth_nonce=${nonce}`),
    ghAs(OWNER),
  );
  const code = new URL(res.headers.get("location") ?? "").searchParams.get("code") ?? "";
  const clientId = verifyToken("code", code)?.client_id as string;
  return { code, clientId };
}

function tokenReq(body: string, contentType = "application/x-www-form-urlencoded") {
  return new Request(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

test("POST /oauth/token: full flow issues tokens with no-store and CORS", async () => {
  const { code, clientId } = await codeAndClient();
  const res = await handleToken(
    tokenReq(
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: CLAUDE,
        code_verifier: VERIFIER,
        resource: `${BASE}/api/mcp`,
      }).toString(),
    ),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("pragma"), "no-cache");
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.token_type, "Bearer");
  assert.equal(body.expires_in, 3600);
  assert.equal(body.scope, "planner");
  assert.equal(verifyToken("access", body.access_token as string)?.sub, OWNER);
  assert.ok(verifyToken("refresh", body.refresh_token as string));
});

test("POST /oauth/token: errors are 400 JSON with no-store", async () => {
  const { code, clientId } = await codeAndClient();
  const bad = await handleToken(
    tokenReq(
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: CLAUDE,
        code_verifier: "y".repeat(43),
      }).toString(),
    ),
  );
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("cache-control"), "no-store");
  assert.deepEqual(await bad.json(), { error: "invalid_grant" });

  const json = await handleToken(tokenReq(JSON.stringify({ grant_type: "authorization_code" }), "application/json"));
  assert.equal(json.status, 400);
  assert.deepEqual(await json.json(), { error: "invalid_request" });

  const big = await handleToken(tokenReq("a=" + "x".repeat(20000)));
  assert.equal(big.status, 400);
  assert.deepEqual(await big.json(), { error: "invalid_request" });
});

test("POST /oauth/token: missing secret → bare 500 with no tokens", async () => {
  const saved = process.env.MCP_OAUTH_SECRET;
  delete process.env.MCP_OAUTH_SECRET;
  try {
    const res = await handleToken(
      tokenReq(new URLSearchParams({ grant_type: "refresh_token", refresh_token: "x", client_id: "y" }).toString()),
    );
    assert.equal(res.status, 500);
    assert.equal(await res.text(), "Server error");
  } finally {
    process.env.MCP_OAUTH_SECRET = saved;
  }
});

test("OPTIONS /oauth/token answers CORS preflight", () => {
  const res = handleTokenPreflight();
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  assert.match(res.headers.get("access-control-allow-methods") ?? "", /POST/);
});

test("the forged-sub refresh token is refused over HTTP too", async () => {
  const { clientId } = await codeAndClient();
  const forged = signToken("refresh", { sub: "999", client_id: clientId, scope: "planner", resource: `${BASE}/api/mcp` }, 3600);
  const res = await handleToken(
    tokenReq(new URLSearchParams({ grant_type: "refresh_token", refresh_token: forged, client_id: clientId }).toString()),
  );
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "invalid_grant" });
});
