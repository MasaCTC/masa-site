// OAuth authorization-server logic for the MCP connector (pure functions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { signToken, verifyToken } from "./tokens.ts";
import {
  approveAuthorize,
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
