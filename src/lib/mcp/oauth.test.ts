// OAuth authorization-server logic for the MCP connector (pure functions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pkceS256, signToken, verifyToken } from "./tokens.ts";
import { OWNER_GITHUB_ID } from "../../test/stubs/auth.ts";
import {
  approveAuthorize,
  completeAuthorize,
  exchangeToken,
  type GithubFetch,
  makeGithubFetch,
  verifyAccessToken,
  authorizationServerMetadata,
  clearNonceCookie,
  isAllowedRedirect,
  nonceCookie,
  protectedResourceMetadata,
  registerClient,
  requestOrigin,
  validateAuthorize,
} from "./oauth.ts";

process.env.MCP_OAUTH_SECRET = "k".repeat(48);
process.env.AUTH_GITHUB_ID = "gh-client-id";

const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const CLAUDE_COM = "https://claude.com/api/mcp/auth_callback";
const LOOPBACK = "http://localhost:6274/oauth/callback";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const ORIGIN = "https://masa.example";

// ---------- isAllowedRedirect ----------

for (const uri of [
  CLAUDE,
  CLAUDE_COM,
  LOOPBACK,
  "http://127.0.0.1:1/x",
  "http://localhost/cb",
  "http://LOCALHOST:5/x",
  "http://127.0.0.1:33418/callback?x=1",
]) {
  test(`isAllowedRedirect accepts ${uri}`, () => assert.equal(isAllowedRedirect(uri), true));
}

for (const uri of [
  "https://evil.test/cb",
  "http://claude.ai/api/mcp/auth_callback",
  "https://claude.ai/other",
  "https://claude.ai/api/mcp/auth_callback?x=1",
  "https://claude.ai/api/mcp/auth_callback/",
  "https://claude.ai/api/mcp/auth_callback#",
  "https://CLAUDE.ai/api/mcp/auth_callback",
  "javascript:alert(1)",
  "http://localhost:6274/cb#frag",
  "http://localhost:6274/cb#",
  "http://localhost.evil.test/cb",
  "http://localhost@evil.test/cb",
  "http://user:pw@127.0.0.1/cb",
  "https://localhost/cb",
  "http://127.0.0.2/cb",
  "http://[::1]:80/cb",
  "",
  "not a url",
  "http://localhost/" + "a".repeat(600),
]) {
  test(`isAllowedRedirect rejects ${JSON.stringify(uri.slice(0, 60))}`, () =>
    assert.equal(isAllowedRedirect(uri), false));
}

test("isAllowedRedirect rejects non-strings", () => {
  assert.equal(isAllowedRedirect(undefined as unknown as string), false);
  assert.equal(isAllowedRedirect(42 as unknown as string), false);
});

// ---------- registerClient ----------

function register(body: unknown) {
  const r = registerClient(body);
  return r;
}

test("registerClient happy path returns a signed, non-expiring client id", () => {
  const r = register({
    client_name: "Claude",
    redirect_uris: [CLAUDE, LOOPBACK],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  assert.equal(r.status, 201);
  assert.ok("client_id" in r.json);
  const json = r.json as Record<string, unknown>;
  assert.equal(json.token_endpoint_auth_method, "none");
  assert.deepEqual(json.redirect_uris, [CLAUDE, LOOPBACK]);
  assert.equal(json.client_name, "Claude");
  assert.deepEqual(json.grant_types, ["authorization_code", "refresh_token"]);
  assert.deepEqual(json.response_types, ["code"]);
  assert.equal(typeof json.client_id_issued_at, "number");
  assert.equal("client_secret" in json, false);
  const claims = verifyToken("client", json.client_id as string);
  assert.ok(claims);
  assert.equal(claims.name, "Claude");
  assert.deepEqual(claims.redirect_uris, [CLAUDE, LOOPBACK]);
  assert.equal("exp" in claims, false);
});

test("registerClient defaults a missing client_name and missing grant types", () => {
  const r = register({ redirect_uris: [CLAUDE] });
  assert.equal(r.status, 201);
  const json = r.json as Record<string, unknown>;
  assert.equal(typeof json.client_name, "string");
  assert.ok((json.client_name as string).length > 0);
  assert.deepEqual(json.grant_types, ["authorization_code", "refresh_token"]);
});

test("registerClient rejects an off-allowlist redirect URI", () => {
  const r = register({ client_name: "x", redirect_uris: [CLAUDE, "https://evil.test/cb"] });
  assert.equal(r.status, 400);
  assert.deepEqual(r.json, { error: "invalid_redirect_uri" });
});

for (const [label, body] of [
  ["no redirect_uris", { client_name: "x" }],
  ["empty redirect_uris", { redirect_uris: [] }],
  ["redirect_uris not array", { redirect_uris: CLAUDE }],
  ["non-string redirect uri", { redirect_uris: [7] }],
  ["too many redirect uris", { redirect_uris: Array(11).fill(LOOPBACK) }],
] as const) {
  test(`registerClient rejects ${label} as invalid_redirect_uri`, () => {
    const r = register(body);
    assert.equal(r.status, 400);
    assert.deepEqual(r.json, { error: "invalid_redirect_uri" });
  });
}

for (const [label, body] of [
  ["null body", null],
  ["array body", [CLAUDE]],
  ["string body", "hi"],
  ["oversize client_name", { client_name: "a".repeat(101), redirect_uris: [CLAUDE] }],
  ["non-string client_name", { client_name: 5, redirect_uris: [CLAUDE] }],
  ["control char in client_name", { client_name: "a\u0000b", redirect_uris: [CLAUDE] }],
  ["implicit grant type", { grant_types: ["implicit"], redirect_uris: [CLAUDE] }],
  ["client_credentials grant", { grant_types: ["client_credentials"], redirect_uris: [CLAUDE] }],
  ["grant_types not array", { grant_types: "authorization_code", redirect_uris: [CLAUDE] }],
  ["token response type", { response_types: ["token"], redirect_uris: [CLAUDE] }],
  ["unsupported scope", { scope: "admin", redirect_uris: [CLAUDE] }],
] as const) {
  test(`registerClient rejects ${label} as invalid_client_metadata`, () => {
    const r = register(body);
    assert.equal(r.status, 400);
    assert.deepEqual(r.json, { error: "invalid_client_metadata" });
  });
}

// ---------- validateAuthorize ----------

function clientId(name = "Claude", uris = [CLAUDE, LOOPBACK]) {
  const r = registerClient({ client_name: name, redirect_uris: uris });
  assert.equal(r.status, 201);
  return (r.json as { client_id: string }).client_id;
}

function params(over: Record<string, string | null> = {}) {
  const base: Record<string, string | null> = {
    response_type: "code",
    client_id: clientId(),
    redirect_uri: CLAUDE,
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    state: "client-state-123",
    resource: `${ORIGIN}/api/mcp`,
    ...over,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v !== null) p.set(k, v);
  return p;
}

const sha = (s: string) => createHash("sha256").update(s).digest("base64url");

test("validateAuthorize happy path returns name, redirect uri, csrf and a verifiable consent token", () => {
  const r = validateAuthorize(params());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.clientName, "Claude");
  assert.equal(r.redirectUri, CLAUDE);
  assert.ok(r.csrf.length >= 32);
  const c = verifyToken("consent", r.consent);
  assert.ok(c);
  assert.equal(c.redirect_uri, CLAUDE);
  assert.equal(c.code_challenge, CHALLENGE);
  assert.equal(c.client_state, "client-state-123");
  assert.equal(c.resource, `${ORIGIN}/api/mcp`);
  assert.equal(c.client_name, "Claude");
  assert.equal(typeof c.client_id, "string");
  assert.equal(c.csrf_hash, sha(r.csrf));
  assert.ok((c.exp as number) - Math.floor(Date.now() / 1000) <= 600);
  assert.ok((c.exp as number) - Math.floor(Date.now() / 1000) >= 590);
});

test("validateAuthorize accepts a missing state/resource and scope=planner", () => {
  const r = validateAuthorize(params({ state: null, resource: null, scope: "planner" }));
  assert.equal(r.ok, true);
});

test("validateAuthorize: missing client_id is a 400 with no redirect", () => {
  const r = validateAuthorize(params({ client_id: null }));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
  assert.equal(r.redirectTo, undefined);
});

test("validateAuthorize: tampered client_id is a 400 with no redirect", () => {
  const id = clientId();
  const [body, sig] = id.split(".");
  const evil = Buffer.from(
    JSON.stringify({ name: "x", redirect_uris: ["https://evil.test/cb"], typ: "client" }),
  ).toString("base64url");
  for (const bad of [`${evil}.${sig}`, `${body}.${sig.slice(0, -2)}AA`, "garbage"]) {
    const r = validateAuthorize(params({ client_id: bad, redirect_uri: "https://evil.test/cb" }));
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.redirectTo, undefined);
  }
});

test("validateAuthorize: a token of another type is not a client id", () => {
  const notClient = signToken("consent", { name: "x", redirect_uris: [CLAUDE] }, 600);
  const r = validateAuthorize(params({ client_id: notClient }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.redirectTo, undefined);
});

test("validateAuthorize: redirect_uri not registered for the client is a 400 with no redirect", () => {
  const r = validateAuthorize(params({ client_id: clientId("c", [CLAUDE]), redirect_uri: CLAUDE_COM }));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
  assert.equal(r.redirectTo, undefined);
});

test("validateAuthorize: missing redirect_uri is a 400 with no redirect", () => {
  const r = validateAuthorize(params({ redirect_uri: null }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.redirectTo, undefined);
});

test("validateAuthorize: a validly signed client with an off-allowlist URI is still rejected", () => {
  // A client token minted directly (bypassing registerClient) cannot widen the allowlist.
  const forged = signToken("client", { name: "x", redirect_uris: ["https://evil.test/cb"] }, null);
  const r = validateAuthorize(params({ client_id: forged, redirect_uri: "https://evil.test/cb" }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.redirectTo, undefined);
});

function assertRedirectError(r: ReturnType<typeof validateAuthorize>, error: string) {
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.status, 400);
  assert.ok(r.redirectTo, "expected an error redirect");
  const u = new URL(r.redirectTo);
  assert.equal(`${u.origin}${u.pathname}`, CLAUDE);
  assert.equal(u.searchParams.get("error"), error);
  assert.equal(u.searchParams.get("state"), "client-state-123");
  assert.equal(u.searchParams.has("code"), false);
}

test("validateAuthorize: missing code_challenge redirects invalid_request", () =>
  assertRedirectError(validateAuthorize(params({ code_challenge: null })), "invalid_request"));

test("validateAuthorize: plain PKCE redirects invalid_request", () =>
  assertRedirectError(
    validateAuthorize(params({ code_challenge_method: "plain" })),
    "invalid_request",
  ));

test("validateAuthorize: missing code_challenge_method redirects invalid_request", () =>
  assertRedirectError(
    validateAuthorize(params({ code_challenge_method: null })),
    "invalid_request",
  ));

test("validateAuthorize: malformed code_challenge redirects invalid_request", () =>
  assertRedirectError(
    validateAuthorize(params({ code_challenge: "short!" })),
    "invalid_request",
  ));

test("validateAuthorize: response_type=token redirects unsupported_response_type", () =>
  assertRedirectError(
    validateAuthorize(params({ response_type: "token" })),
    "unsupported_response_type",
  ));

test("validateAuthorize: missing response_type redirects", () => {
  const r = validateAuthorize(params({ response_type: null }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.redirectTo);
});

test("validateAuthorize: unknown scope redirects invalid_scope", () =>
  assertRedirectError(validateAuthorize(params({ scope: "planner admin" })), "invalid_scope"));

test("validateAuthorize: error redirect keeps the redirect URI's own query", () => {
  const uri = "http://127.0.0.1:9/cb?keep=1";
  const r = validateAuthorize(
    params({ client_id: clientId("c", [uri]), redirect_uri: uri, code_challenge: null }),
  );
  assert.equal(r.ok, false);
  if (r.ok || !r.redirectTo) return assert.fail("expected redirect");
  const u = new URL(r.redirectTo);
  assert.equal(u.searchParams.get("keep"), "1");
  assert.equal(u.searchParams.get("error"), "invalid_request");
});

test("validateAuthorize: oversize state is rejected", () => {
  const r = validateAuthorize(params({ state: "s".repeat(2000) }));
  assert.equal(r.ok, false);
});

// ---------- approveAuthorize ----------

function consentFor(over: Record<string, string | null> = {}) {
  const r = validateAuthorize(params(over));
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("unreachable");
  return r;
}

test("approveAuthorize happy path: GitHub URL with a verifiable state carrying the nonce", () => {
  const { consent, csrf } = consentFor();
  const r = approveAuthorize(consent, ORIGIN, csrf);
  assert.ok("redirectTo" in r);
  const u = new URL(r.redirectTo);
  assert.equal(`${u.origin}${u.pathname}`, "https://github.com/login/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "gh-client-id");
  assert.equal(u.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/callback/github/mcp`);
  assert.equal(u.searchParams.get("scope"), "read:user");
  const state = verifyToken("state", u.searchParams.get("state")!);
  assert.ok(state);
  assert.equal(state.nonce, r.nonce);
  assert.ok(r.nonce.length >= 32);
  assert.equal(state.redirect_uri, CLAUDE);
  assert.equal(state.code_challenge, CHALLENGE);
  assert.equal(state.client_state, "client-state-123");
  assert.equal(state.resource, `${ORIGIN}/api/mcp`);
  assert.equal(typeof state.client_id, "string");
  assert.equal("csrf_hash" in state, false);
  assert.ok((state.exp as number) - Math.floor(Date.now() / 1000) <= 600);
  // The consent token is not usable as a state token.
  assert.equal(verifyToken("state", consent), null);
});

test("approveAuthorize issues a fresh nonce each time", () => {
  const { consent, csrf } = consentFor();
  const a = approveAuthorize(consent, ORIGIN, csrf);
  const b = approveAuthorize(consent, ORIGIN, csrf);
  assert.ok("nonce" in a && "nonce" in b);
  assert.notEqual(a.nonce, b.nonce);
});

test("approveAuthorize rejects a tampered consent token", () => {
  const { consent, csrf } = consentFor();
  const [body, sig] = consent.split(".");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  claims.redirect_uri = "https://evil.test/cb";
  const evil = Buffer.from(JSON.stringify(claims)).toString("base64url");
  for (const bad of [`${evil}.${sig}`, `${body}.x${sig.slice(1)}`, "", "a.b"]) {
    const r = approveAuthorize(bad, ORIGIN, csrf);
    assert.ok("error" in r, `accepted ${bad.slice(0, 20)}`);
    assert.equal(r.status, 400);
  }
});

test("approveAuthorize rejects an expired consent token", () => {
  const { csrf } = consentFor();
  const now = Math.floor(Date.now() / 1000);
  const expired = signToken(
    "consent",
    {
      client_id: "c",
      redirect_uri: CLAUDE,
      code_challenge: CHALLENGE,
      client_state: "s",
      resource: "",
      client_name: "x",
      csrf_hash: sha(csrf),
    },
    600,
    { now: now - 601 },
  );
  const r = approveAuthorize(expired, ORIGIN, csrf);
  assert.ok("error" in r);
});

test("approveAuthorize rejects state/access/client tokens with consent-shaped claims", () => {
  const { csrf } = consentFor();
  const claims = {
    client_id: "c",
    redirect_uri: CLAUDE,
    code_challenge: CHALLENGE,
    client_state: "s",
    resource: "",
    client_name: "x",
    csrf_hash: sha(csrf),
  };
  for (const t of [
    signToken("state", claims, 600),
    signToken("access", claims, 600),
    signToken("client", claims, null),
  ]) {
    const r = approveAuthorize(t, ORIGIN, csrf);
    assert.ok("error" in r);
  }
});

test("approveAuthorize rejects a missing or mismatched CSRF cookie (cross-site POST)", () => {
  const { consent } = consentFor();
  const other = consentFor().csrf;
  for (const cookie of [undefined, "", other, "x".repeat(43)]) {
    const r = approveAuthorize(consent, ORIGIN, cookie);
    assert.ok("error" in r);
    assert.equal(r.status, 400);
  }
});

test("approveAuthorize throws (caller turns it into 500) when AUTH_GITHUB_ID is unset", () => {
  const { consent, csrf } = consentFor();
  const saved = process.env.AUTH_GITHUB_ID;
  delete process.env.AUTH_GITHUB_ID;
  try {
    assert.throws(() => approveAuthorize(consent, ORIGIN, csrf));
  } finally {
    process.env.AUTH_GITHUB_ID = saved;
  }
});

// ---------- metadata ----------

test("authorization server metadata", () => {
  const m = authorizationServerMetadata(ORIGIN);
  assert.equal(m.issuer, ORIGIN);
  assert.equal(m.authorization_endpoint, `${ORIGIN}/oauth/authorize`);
  assert.equal(m.token_endpoint, `${ORIGIN}/oauth/token`);
  assert.equal(m.registration_endpoint, `${ORIGIN}/oauth/register`);
  assert.deepEqual(m.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(m.grant_types_supported, ["authorization_code", "refresh_token"]);
  assert.deepEqual(m.token_endpoint_auth_methods_supported, ["none"]);
  assert.deepEqual(m.response_types_supported, ["code"]);
  assert.deepEqual(m.scopes_supported, ["planner"]);
});

test("protected resource metadata", () => {
  const m = protectedResourceMetadata(ORIGIN);
  assert.equal(m.resource, `${ORIGIN}/api/mcp`);
  assert.deepEqual(m.authorization_servers, [ORIGIN]);
  assert.deepEqual(m.scopes_supported, ["planner"]);
});

// ---------- origin + cookies ----------

test("requestOrigin uses the request URL by default", () => {
  assert.equal(requestOrigin(new Request("http://localhost:3000/oauth/authorize?x=1")), "http://localhost:3000");
});

test("requestOrigin honors x-forwarded-host/proto", () => {
  const req = new Request("http://internal:3000/x", {
    headers: { "x-forwarded-host": "masa.example, proxy", "x-forwarded-proto": "https,http" },
  });
  assert.equal(requestOrigin(req), "https://masa.example");
});

test("requestOrigin ignores a malformed forwarded host or proto", () => {
  const req = new Request("http://localhost:3000/x", {
    headers: { "x-forwarded-host": "evil.test/path?x", "x-forwarded-proto": "javascript" },
  });
  assert.equal(requestOrigin(req), "http://localhost:3000");
});

test("nonce cookie: httpOnly, Lax, 10 min, scoped to the callback, Secure only on https", () => {
  const https = nonceCookie("abc", "https://masa.example");
  assert.match(https, /^mcp_oauth_nonce=abc;/);
  assert.match(https, /HttpOnly/);
  assert.match(https, /SameSite=Lax/);
  assert.match(https, /Max-Age=600/);
  assert.match(https, /Path=\/api\/auth\/callback\/github\/mcp/);
  assert.match(https, /Secure/);
  assert.doesNotMatch(nonceCookie("abc", "http://localhost:3000"), /Secure/);
  const cleared = clearNonceCookie("https://masa.example");
  assert.match(cleared, /^mcp_oauth_nonce=;/);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /Path=\/api\/auth\/callback\/github\/mcp/);
});

test("validateAuthorize: code_challenge must be exactly 43 chars (S256 output)", () => {
  for (const bad of [CHALLENGE.slice(0, 42), CHALLENGE + "A", "A".repeat(128)]) {
    assertRedirectError(validateAuthorize(params({ code_challenge: bad })), "invalid_request");
  }
  assert.equal(validateAuthorize(params({ code_challenge: CHALLENGE })).ok, true);
});

// ---------- Task 6: GitHub callback (completeAuthorize) ----------

const OWNER = "152247398";
const RESOURCE = `${ORIGIN}/api/mcp`;
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const NONCE = "n".repeat(43);

test("test fixture: VERIFIER hashes to CHALLENGE and OWNER matches the auth stub", () => {
  assert.equal(pkceS256(VERIFIER), CHALLENGE);
  assert.equal(OWNER, OWNER_GITHUB_ID);
});

function stateToken(over: Record<string, unknown> = {}, ttl = 600, opts?: { now?: number }) {
  return signToken(
    "state",
    {
      client_id: clientId(),
      redirect_uri: CLAUDE,
      code_challenge: CHALLENGE,
      client_state: "cs-1",
      resource: RESOURCE,
      nonce: NONCE,
      ...over,
    },
    ttl,
    opts,
  );
}

type GhCall = { code: string; redirectUri: string };
function fakeGh(result: { id: string } | null | Error) {
  const calls: GhCall[] = [];
  const gh: GithubFetch = async (code, redirectUri) => {
    calls.push({ code, redirectUri });
    if (result instanceof Error) throw result;
    return result;
  };
  return { gh, calls };
}

function callbackArgs(over: Partial<Parameters<typeof completeAuthorize>[0]> = {}) {
  return { state: stateToken(), githubCode: "gh-code", nonceCookie: NONCE, origin: ORIGIN, ...over };
}

test("completeAuthorize: owner → redirect to the client with a verifiable 60 s code and state", async () => {
  const { gh, calls } = fakeGh({ id: OWNER });
  const cid = clientId();
  const r = await completeAuthorize(callbackArgs({ state: stateToken({ client_id: cid }) }), gh);
  assert.ok("redirectTo" in r);
  assert.deepEqual(calls, [{ code: "gh-code", redirectUri: `${ORIGIN}/api/auth/callback/github/mcp` }]);
  const url = new URL(r.redirectTo);
  assert.equal(`${url.origin}${url.pathname}`, CLAUDE);
  assert.equal(url.searchParams.get("state"), "cs-1");
  assert.equal(url.searchParams.get("error"), null);
  const code = verifyToken("code", url.searchParams.get("code") ?? "");
  assert.ok(code);
  assert.equal(code.sub, OWNER);
  assert.equal(code.client_id, cid);
  assert.equal(code.redirect_uri, CLAUDE);
  assert.equal(code.code_challenge, CHALLENGE);
  assert.equal(code.resource, RESOURCE);
  assert.equal(code.scope, "planner");
  const ttl = (code.exp as number) - Math.floor(Date.now() / 1000);
  assert.ok(ttl <= 60 && ttl >= 55, `ttl ${ttl}`);
});

test("completeAuthorize: null client_state omits state; null resource becomes the canonical one", async () => {
  const { gh } = fakeGh({ id: OWNER });
  const r = await completeAuthorize(
    callbackArgs({ state: stateToken({ client_state: null, resource: null }) }),
    gh,
  );
  assert.ok("redirectTo" in r);
  const url = new URL(r.redirectTo);
  assert.equal(url.searchParams.has("state"), false);
  assert.equal(verifyToken("code", url.searchParams.get("code") ?? "")?.resource, RESOURCE);
});

test("completeAuthorize keeps an existing query string on a loopback redirect", async () => {
  const uri = "http://127.0.0.1:33418/callback?x=1";
  const { gh } = fakeGh({ id: OWNER });
  const r = await completeAuthorize(
    callbackArgs({ state: stateToken({ client_id: clientId("c", [uri]), redirect_uri: uri }) }),
    gh,
  );
  assert.ok("redirectTo" in r);
  const url = new URL(r.redirectTo);
  assert.equal(url.searchParams.get("x"), "1");
  assert.ok(url.searchParams.get("code"));
});

test("completeAuthorize: another GitHub id → access_denied redirect and no code anywhere", async () => {
  const { gh } = fakeGh({ id: "999" });
  const r = await completeAuthorize(callbackArgs(), gh);
  assert.ok("redirectTo" in r);
  assert.doesNotMatch(r.redirectTo, /code=/);
  const url = new URL(r.redirectTo);
  assert.equal(url.searchParams.get("error"), "access_denied");
  assert.equal(url.searchParams.get("state"), "cs-1");
});

test("completeAuthorize: an id that merely contains the owner id is refused", async () => {
  for (const id of [` ${OWNER}`, `${OWNER}0`, `0${OWNER}`]) {
    const r = await completeAuthorize(callbackArgs(), fakeGh({ id }).gh);
    assert.ok("redirectTo" in r);
    assert.doesNotMatch(r.redirectTo, /code=/);
  }
});

test("completeAuthorize: GitHub says no (null) → access_denied, no code", async () => {
  const r = await completeAuthorize(callbackArgs(), fakeGh(null).gh);
  assert.ok("redirectTo" in r);
  assert.doesNotMatch(r.redirectTo, /code=/);
  assert.equal(new URL(r.redirectTo).searchParams.get("error"), "access_denied");
});

test("completeAuthorize: GitHub unreachable (throws) → server_error, no code", async () => {
  const r = await completeAuthorize(callbackArgs(), fakeGh(new Error("timeout")).gh);
  assert.ok("redirectTo" in r);
  assert.doesNotMatch(r.redirectTo, /code=/);
  assert.equal(new URL(r.redirectTo).searchParams.get("error"), "server_error");
});

test("completeAuthorize: GitHub returned an error / no code → access_denied without calling GitHub", async () => {
  for (const over of [{ githubCode: null, githubError: "access_denied" }, { githubCode: null }, { githubCode: "" }]) {
    const { gh, calls } = fakeGh({ id: OWNER });
    const r = await completeAuthorize(callbackArgs(over), gh);
    assert.ok("redirectTo" in r, JSON.stringify(over));
    assert.equal(new URL(r.redirectTo).searchParams.get("error"), "access_denied");
    assert.doesNotMatch(r.redirectTo, /code=/);
    assert.equal(calls.length, 0);
  }
});

test("completeAuthorize: missing or different nonce cookie → 400, no redirect, GitHub not called", async () => {
  for (const nonceCookie of [undefined, "", "m".repeat(43), NONCE + "x", NONCE.slice(1)]) {
    const { gh, calls } = fakeGh({ id: OWNER });
    const r = await completeAuthorize(callbackArgs({ nonceCookie }), gh);
    assert.ok("error" in r, String(nonceCookie));
    assert.equal(r.status, 400);
    assert.equal("redirectTo" in r, false);
    assert.equal(calls.length, 0);
  }
});

test("completeAuthorize: expired, tampered, wrong-type or missing state → 400, GitHub not called", async () => {
  const past = Math.floor(Date.now() / 1000) - 601;
  const good = stateToken();
  const [body, sig] = good.split(".");
  const tamperedBody = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), redirect_uri: "http://localhost:1/x" }),
  ).toString("base64url");
  const bad = [
    stateToken({}, 600, { now: past }),
    `${tamperedBody}.${sig}`,
    good.slice(0, -2),
    signToken("consent", { client_id: "x", redirect_uri: CLAUDE, code_challenge: CHALLENGE, nonce: NONCE }, 600),
    signToken("code", { client_id: "x", redirect_uri: CLAUDE, code_challenge: CHALLENGE, nonce: NONCE }, 600),
    "",
    "garbage",
  ];
  for (const state of bad) {
    const { gh, calls } = fakeGh({ id: OWNER });
    const r = await completeAuthorize(callbackArgs({ state }), gh);
    assert.ok("error" in r, state);
    assert.equal(r.status, 400);
    assert.equal(calls.length, 0);
  }
});

test("completeAuthorize: a signed state whose redirect_uri is off the allowlist → 400", async () => {
  const r = await completeAuthorize(
    callbackArgs({ state: stateToken({ redirect_uri: "https://evil.test/cb" }) }),
    fakeGh({ id: OWNER }).gh,
  );
  assert.ok("error" in r);
  assert.equal(r.status, 400);
});

test("completeAuthorize: a resource other than this server's MCP endpoint → invalid_target, no code", async () => {
  const { gh, calls } = fakeGh({ id: OWNER });
  const r = await completeAuthorize(
    callbackArgs({ state: stateToken({ resource: "https://other.example/api/mcp" }) }),
    gh,
  );
  assert.ok("redirectTo" in r);
  assert.equal(new URL(r.redirectTo).searchParams.get("error"), "invalid_target");
  assert.doesNotMatch(r.redirectTo, /code=/);
  assert.equal(calls.length, 0);
});

// ---------- Task 6: default GitHub identity fetch ----------

type FetchCall = { url: string; init: RequestInit };
function fakeFetch(responses: Array<Response | Error>) {
  const calls: FetchCall[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { impl, calls };
}
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("makeGithubFetch: exchanges the code, reads /user and returns the numeric id as a string", async () => {
  process.env.AUTH_GITHUB_SECRET = "gh-secret";
  const { impl, calls } = fakeFetch([jsonRes({ access_token: "gho_TOKEN", token_type: "bearer" }), jsonRes({ id: 152247398, login: "MasaCTC" })]);
  const gh = makeGithubFetch(impl);
  const r = await gh("the-code", `${ORIGIN}/api/auth/callback/github/mcp`);
  assert.deepEqual(r, { id: "152247398" });

  assert.equal(calls[0].url, "https://github.com/login/oauth/access_token");
  assert.equal(calls[0].init.method, "POST");
  const h0 = new Headers(calls[0].init.headers);
  assert.equal(h0.get("accept"), "application/json");
  const body = new URLSearchParams(String(calls[0].init.body));
  assert.equal(body.get("client_id"), "gh-client-id");
  assert.equal(body.get("client_secret"), "gh-secret");
  assert.equal(body.get("code"), "the-code");
  assert.equal(body.get("redirect_uri"), `${ORIGIN}/api/auth/callback/github/mcp`);
  assert.ok(calls[0].init.signal, "token call has a timeout signal");

  assert.equal(calls[1].url, "https://api.github.com/user");
  const h1 = new Headers(calls[1].init.headers);
  assert.equal(h1.get("authorization"), "Bearer gho_TOKEN");
  assert.ok(h1.get("user-agent"));
  assert.equal(h1.get("accept"), "application/vnd.github+json");
  assert.ok(calls[1].init.signal, "user call has a timeout signal");
});

test("makeGithubFetch: a bad code (200 with error body) → null, /user not called", async () => {
  const { impl, calls } = fakeFetch([jsonRes({ error: "bad_verification_code" })]);
  assert.equal(await makeGithubFetch(impl)("c", "r"), null);
  assert.equal(calls.length, 1);
});

test("makeGithubFetch: /user 401 → null; non-integer id → null", async () => {
  for (const user of [jsonRes({ message: "Bad credentials" }, 401), jsonRes({ id: "152247398" }), jsonRes({ id: 1.5 }), jsonRes({})]) {
    const { impl } = fakeFetch([jsonRes({ access_token: "t" }), user]);
    assert.equal(await makeGithubFetch(impl)("c", "r"), null);
  }
});

test("makeGithubFetch: network failure or GitHub 5xx throws without leaking the token", async () => {
  const cases: Array<Array<Response | Error>> = [
    [new Error("network down")],
    [jsonRes({}, 502)],
    [jsonRes({ access_token: "gho_SECRET" }), jsonRes({}, 500)],
    [jsonRes({ access_token: "gho_SECRET" }), new Error("timeout")],
  ];
  for (const responses of cases) {
    const { impl } = fakeFetch(responses);
    await assert.rejects(makeGithubFetch(impl)("c", "r"), (err: Error) => {
      assert.doesNotMatch(err.message, /gho_SECRET/);
      return true;
    });
  }
});

test("makeGithubFetch: missing GitHub client secret throws before any request", async () => {
  const saved = process.env.AUTH_GITHUB_SECRET;
  delete process.env.AUTH_GITHUB_SECRET;
  try {
    const { impl, calls } = fakeFetch([]);
    await assert.rejects(makeGithubFetch(impl)("c", "r"));
    assert.equal(calls.length, 0);
  } finally {
    process.env.AUTH_GITHUB_SECRET = saved;
  }
});

// ---------- Task 6: token endpoint (exchangeToken) ----------

async function freshCode(cid = clientId(), redirect = CLAUDE) {
  const r = await completeAuthorize(
    callbackArgs({ state: stateToken({ client_id: cid, redirect_uri: redirect }) }),
    fakeGh({ id: OWNER }).gh,
  );
  assert.ok("redirectTo" in r);
  return new URL(r.redirectTo).searchParams.get("code") as string;
}

function codeForm(code: string, cid: string, over: Record<string, string | null> = {}) {
  const base: Record<string, string | null> = {
    grant_type: "authorization_code",
    code,
    client_id: cid,
    redirect_uri: CLAUDE,
    code_verifier: VERIFIER,
    ...over,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v !== null) p.set(k, v);
  return p;
}

function assertTokenError(r: ReturnType<typeof exchangeToken>, error: string) {
  assert.equal(r.status, 400, JSON.stringify(r.json));
  assert.deepEqual(r.json, { error });
}

function okTokens(r: ReturnType<typeof exchangeToken>) {
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json as { access_token: string; refresh_token: string; token_type: string; expires_in: number; scope: string };
}

test("exchangeToken: authorization_code happy path issues a Bearer access + refresh pair", async () => {
  const cid = clientId();
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid, { resource: RESOURCE }), ORIGIN));
  assert.equal(t.token_type, "Bearer");
  assert.equal(t.expires_in, 3600);
  assert.equal(t.scope, "planner");
  const a = verifyToken("access", t.access_token);
  const rf = verifyToken("refresh", t.refresh_token);
  assert.ok(a && rf);
  for (const c of [a, rf]) {
    assert.equal(c.sub, OWNER);
    assert.equal(c.client_id, cid);
    assert.equal(c.scope, "planner");
    assert.equal(c.resource, RESOURCE);
  }
  const now = Math.floor(Date.now() / 1000);
  assert.ok((a.exp as number) - now <= 3600 && (a.exp as number) - now >= 3595);
  assert.ok((rf.exp as number) - now <= 30 * 86400 && (rf.exp as number) - now >= 30 * 86400 - 5);
});

test("exchangeToken: resource is optional at the token endpoint", async () => {
  const cid = clientId();
  okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
});

test("exchangeToken: wrong PKCE verifier → invalid_grant", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  assertTokenError(exchangeToken(codeForm(code, cid, { code_verifier: "x".repeat(43) }), ORIGIN), "invalid_grant");
});

test("exchangeToken: missing or malformed verifier → invalid_request (PKCE always required)", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  assertTokenError(exchangeToken(codeForm(code, cid, { code_verifier: null }), ORIGIN), "invalid_request");
  assertTokenError(exchangeToken(codeForm(code, cid, { code_verifier: "short" }), ORIGIN), "invalid_request");
});

test("exchangeToken: code redeemed with a different redirect_uri → invalid_grant", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  assertTokenError(exchangeToken(codeForm(code, cid, { redirect_uri: LOOPBACK }), ORIGIN), "invalid_grant");
  assertTokenError(exchangeToken(codeForm(code, cid, { redirect_uri: CLAUDE + "/" }), ORIGIN), "invalid_grant");
});

test("exchangeToken: missing redirect_uri → invalid_request", async () => {
  const cid = clientId();
  assertTokenError(exchangeToken(codeForm(await freshCode(cid), cid, { redirect_uri: null }), ORIGIN), "invalid_request");
});

test("exchangeToken: code redeemed by another (valid) client → invalid_grant", async () => {
  const code = await freshCode(clientId("A"));
  assertTokenError(exchangeToken(codeForm(code, clientId("B")), ORIGIN), "invalid_grant");
});

test("exchangeToken: missing or forged client_id → invalid_request / invalid_client", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  assertTokenError(exchangeToken(codeForm(code, cid, { client_id: null }), ORIGIN), "invalid_request");
  assertTokenError(exchangeToken(codeForm(code, cid, { client_id: cid.slice(0, -2) }), ORIGIN), "invalid_client");
});

test("exchangeToken: a code presented after 60 s → invalid_grant", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  const later = Math.floor(Date.now() / 1000) + 61;
  assertTokenError(exchangeToken(codeForm(code, cid), ORIGIN, { now: later }), "invalid_grant");
});

test("exchangeToken: a code signed for another subject (sub 999) → invalid_grant", () => {
  const cid = clientId();
  const forged = signToken(
    "code",
    { sub: "999", client_id: cid, redirect_uri: CLAUDE, code_challenge: CHALLENGE, resource: RESOURCE, scope: "planner" },
    60,
  );
  assertTokenError(exchangeToken(codeForm(forged, cid), ORIGIN), "invalid_grant");
});

test("exchangeToken: access or refresh token presented as a code → invalid_grant", async () => {
  const cid = clientId();
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  assertTokenError(exchangeToken(codeForm(t.access_token, cid), ORIGIN), "invalid_grant");
  assertTokenError(exchangeToken(codeForm(t.refresh_token, cid), ORIGIN), "invalid_grant");
});

test("exchangeToken: a resource that is not this server's MCP endpoint → invalid_target", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  assertTokenError(
    exchangeToken(codeForm(code, cid, { resource: "https://other.example/api/mcp" }), ORIGIN),
    "invalid_target",
  );
});

test("exchangeToken: a code minted on another origin cannot be redeemed here", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  assertTokenError(exchangeToken(codeForm(code, cid), "https://preview.example"), "invalid_grant");
});

test("exchangeToken: unknown or missing grant_type", () => {
  const cid = clientId();
  assertTokenError(
    exchangeToken(new URLSearchParams({ grant_type: "password", client_id: cid }), ORIGIN),
    "unsupported_grant_type",
  );
  assertTokenError(exchangeToken(new URLSearchParams({ client_id: cid }), ORIGIN), "invalid_request");
});

test("exchangeToken: repeated parameters → invalid_request", async () => {
  const cid = clientId();
  const f = codeForm(await freshCode(cid), cid);
  f.append("code_verifier", VERIFIER);
  assertTokenError(exchangeToken(f, ORIGIN), "invalid_request");
});

function refreshForm(token: string, cid: string, over: Record<string, string> = {}) {
  return new URLSearchParams({ grant_type: "refresh_token", refresh_token: token, client_id: cid, ...over });
}

test("exchangeToken: refresh_token rotates to a new access + refresh pair", async () => {
  const cid = clientId();
  const first = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  const second = okTokens(exchangeToken(refreshForm(first.refresh_token, cid), ORIGIN));
  assert.notEqual(second.access_token, first.access_token);
  assert.notEqual(second.refresh_token, first.refresh_token);
  assert.equal(second.token_type, "Bearer");
  assert.equal(second.expires_in, 3600);
  assert.equal(second.scope, "planner");
  const a = verifyToken("access", second.access_token);
  assert.equal(a?.sub, OWNER);
  assert.equal(a?.client_id, cid);
  const rf = verifyToken("refresh", second.refresh_token);
  assert.ok(rf);
  assert.equal(rf.sub, OWNER);
  assert.equal(rf.client_id, cid);
  assert.equal(rf.resource, RESOURCE);
  assert.equal(rf.scope, "planner");
  assert.equal(a?.resource, RESOURCE);
  assert.equal(a?.scope, "planner");
  // the new refresh token works too
  okTokens(exchangeToken(refreshForm(second.refresh_token, cid, { scope: "planner" }), ORIGIN));
});

test("exchangeToken: access token or code presented as refresh_token → invalid_grant", async () => {
  const cid = clientId();
  const code = await freshCode(cid);
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  assertTokenError(exchangeToken(refreshForm(t.access_token, cid), ORIGIN), "invalid_grant");
  assertTokenError(exchangeToken(refreshForm(code, cid), ORIGIN), "invalid_grant");
});

test("exchangeToken: refresh by another client → invalid_grant; for another subject → invalid_grant", async () => {
  const cid = clientId();
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  assertTokenError(exchangeToken(refreshForm(t.refresh_token, clientId("Other")), ORIGIN), "invalid_grant");
  const forged = signToken("refresh", { sub: "999", client_id: cid, scope: "planner", resource: RESOURCE }, 3600);
  assertTokenError(exchangeToken(refreshForm(forged, cid), ORIGIN), "invalid_grant");
});

test("exchangeToken: expired refresh token → invalid_grant; unsupported scope → invalid_scope", async () => {
  const cid = clientId();
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  const later = Math.floor(Date.now() / 1000) + 30 * 86400 + 1;
  assertTokenError(exchangeToken(refreshForm(t.refresh_token, cid), ORIGIN, { now: later }), "invalid_grant");
  assertTokenError(exchangeToken(refreshForm(t.refresh_token, cid, { scope: "admin" }), ORIGIN), "invalid_scope");
});

test("exchangeToken throws (→ 500) when MCP_OAUTH_SECRET is missing, never issues tokens", () => {
  const saved = process.env.MCP_OAUTH_SECRET;
  delete process.env.MCP_OAUTH_SECRET;
  try {
    assert.throws(() =>
      exchangeToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: "x", client_id: "y" }), ORIGIN),
    );
  } finally {
    process.env.MCP_OAUTH_SECRET = saved;
  }
});

// ---------- Task 6: verifyAccessToken ----------

test("verifyAccessToken accepts an issued access token", async () => {
  const cid = clientId();
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  const v = verifyAccessToken(t.access_token, { resource: RESOURCE });
  assert.ok(v);
  assert.equal(v.githubId, OWNER);
  assert.equal(v.clientId, cid);
  assert.equal(v.scope, "planner");
  assert.equal(v.resource, RESOURCE);
  assert.equal(v.expiresAt, verifyToken("access", t.access_token)?.exp);
  assert.equal(verifyAccessToken(t.access_token, { resource: "https://preview.example/api/mcp" }), null);
});

test("verifyAccessToken rejects wrong type, wrong sub, wrong scope, expired and garbage", async () => {
  const cid = clientId();
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  const claims = { sub: OWNER, client_id: cid, scope: "planner", resource: RESOURCE };
  assert.equal(verifyAccessToken(t.refresh_token, { resource: RESOURCE }), null);
  assert.equal(verifyAccessToken(signToken("code", claims, 60), { resource: RESOURCE }), null);
  assert.equal(verifyAccessToken(signToken("access", { ...claims, sub: "999" }, 3600), { resource: RESOURCE }), null);
  assert.equal(verifyAccessToken(signToken("access", { ...claims, sub: 152247398 }, 3600), { resource: RESOURCE }), null);
  assert.equal(verifyAccessToken(signToken("access", { ...claims, scope: "admin" }, 3600), { resource: RESOURCE }), null);
  assert.equal(verifyAccessToken(signToken("access", { ...claims, client_id: undefined }, 3600), { resource: RESOURCE }), null);
  assert.equal(verifyAccessToken(t.access_token, { resource: RESOURCE, now: Math.floor(Date.now() / 1000) + 3601 }), null);
  assert.equal(verifyAccessToken("garbage", { resource: RESOURCE }), null);
  assert.equal(verifyAccessToken("", { resource: RESOURCE }), null);
});

test("verifyAccessToken: resource is required; a missing/other audience is rejected", async () => {
  const cid = clientId();
  const t = okTokens(exchangeToken(codeForm(await freshCode(cid), cid), ORIGIN));
  // @ts-expect-error resource is a required option
  assert.throws(() => verifyAccessToken(t.access_token));
  // @ts-expect-error resource is a required option
  assert.equal(verifyAccessToken(t.access_token, {}), null);
  assert.equal(verifyAccessToken(t.access_token, { resource: "" }), null);
  assert.equal(verifyAccessToken(t.access_token, { resource: `${RESOURCE}/` }), null);
  assert.ok(verifyAccessToken(t.access_token, { resource: RESOURCE }));
});

test("makeGithubFetch: both GitHub requests refuse redirects (redirect: \"error\")", async () => {
  process.env.AUTH_GITHUB_SECRET = "gh-secret";
  const { impl, calls } = fakeFetch([jsonRes({ access_token: "gho_TOKEN" }), jsonRes({ id: 152247398 })]);
  assert.deepEqual(await makeGithubFetch(impl)("c", "r"), { id: "152247398" });
  assert.equal(calls.length, 2);
  for (const c of calls) assert.equal(c.init.redirect, "error", c.url);
});

test("completeAuthorize: a redirect refused by fetch (TypeError) still yields server_error, no code", async () => {
  process.env.AUTH_GITHUB_SECRET = "gh-secret";
  for (const responses of [
    [new TypeError("fetch failed: unexpected redirect")],
    [jsonRes({ access_token: "gho_SECRET" }), new TypeError("fetch failed: unexpected redirect")],
  ] as Array<Array<Response | Error>>) {
    const { impl } = fakeFetch(responses);
    const r = await completeAuthorize(callbackArgs(), makeGithubFetch(impl));
    assert.ok("redirectTo" in r);
    assert.equal(new URL(r.redirectTo).searchParams.get("error"), "server_error");
    assert.doesNotMatch(r.redirectTo, /code=|gho_SECRET/);
  }
});
