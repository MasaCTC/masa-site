// Stateless OAuth 2.1 authorization server for the MCP connector: metadata,
// dynamic client registration (RFC 7591) and the /authorize consent step.
// Every client id, consent, state, code and token is an HMAC-signed blob from
// ./tokens.ts, so there is no table. GitHub is only used to prove the
// signed-in user is the owner; its token is discarded at once.
//
// Pure functions over plain values; the HTTP wrapping lives in ./oauth-http.ts.
// signToken/verifyToken THROW when MCP_OAUTH_SECRET is missing or short, and
// approveAuthorize throws when AUTH_GITHUB_ID is unset: callers must turn a
// throw into a bare 500, never a pass.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { OWNER_GITHUB_ID } from "@/auth";
import { signToken, verifyPkce, verifyToken } from "./tokens.ts";

export const SCOPE = "planner";
export const MCP_RESOURCE_PATH = "/api/mcp";
export const GITHUB_CALLBACK_PATH = "/api/auth/callback/github/mcp";
export const NONCE_COOKIE = "mcp_oauth_nonce";
export const CSRF_COOKIE = "mcp_oauth_csrf";
export const AUTHORIZE_PATH = "/oauth/authorize";
/** Lifetime of the consent and state tokens and their cookies (10 min). */
export const PENDING_TTL_SECONDS = 600;
export const CODE_TTL_SECONDS = 60;
export const ACCESS_TTL_SECONDS = 3600;
export const REFRESH_TTL_SECONDS = 30 * 24 * 3600;
const GITHUB_TIMEOUT_MS = 10_000;

const CLAUDE_REDIRECTS: ReadonlySet<string> = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);
const MAX_REDIRECT_URI_LENGTH = 512;
const MAX_REDIRECT_URIS = 10;
const MAX_CLIENT_NAME_LENGTH = 100;
const MAX_STATE_LENGTH = 1024;
const MAX_RESOURCE_LENGTH = 512;
const DEFAULT_CLIENT_NAME = "Unnamed MCP client";
const GRANT_TYPES: ReadonlySet<string> = new Set(["authorization_code", "refresh_token"]);
// Only S256 is accepted, and base64url(SHA-256) is exactly 43 chars.
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
// RFC 7636 section 4.1: 43-128 unreserved characters.
const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const WHITESPACE_OR_CONTROL = /[\s\u0000-\u001f\u007f]/;

/**
 * Redirect URI allowlist: the two Claude callbacks (exact string match) and
 * plain-http loopback (localhost / 127.0.0.1, any port, any path). No
 * fragments, no credentials, nothing else.
 */
export function isAllowedRedirect(uri: string): boolean {
  if (typeof uri !== "string" || uri.length === 0 || uri.length > MAX_REDIRECT_URI_LENGTH) {
    return false;
  }
  if (uri.includes("#") || WHITESPACE_OR_CONTROL.test(uri)) return false;
  if (CLAUDE_REDIRECTS.has(uri)) return true;
  if (!/^http:\/\//i.test(uri)) return false;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  return (
    url.protocol === "http:" &&
    LOOPBACK_HOSTS.has(url.hostname) &&
    url.username === "" &&
    url.password === "" &&
    url.hash === ""
  );
}

// ---------- dynamic client registration ----------

type ClientClaims = { name: string; redirect_uris: string[] };

export type RegisterResult =
  | {
      status: 201;
      json: {
        client_id: string;
        client_id_issued_at: number;
        client_name: string;
        redirect_uris: string[];
        grant_types: string[];
        response_types: string[];
        token_endpoint_auth_method: "none";
        scope: string;
      };
    }
  | { status: 400; json: { error: "invalid_redirect_uri" | "invalid_client_metadata" } };

const invalidMetadata = { status: 400, json: { error: "invalid_client_metadata" } } as const;
const invalidRedirect = { status: 400, json: { error: "invalid_redirect_uri" } } as const;

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function scopeIsSupported(scope: string): boolean {
  const parts = scope.split(" ").filter(Boolean);
  return parts.every((s) => s === SCOPE);
}

/** RFC 7591 registration for public clients (PKCE, no secret). */
export function registerClient(body: unknown): RegisterResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return invalidMetadata;
  const b = body as Record<string, unknown>;

  let name = DEFAULT_CLIENT_NAME;
  if (b.client_name !== undefined) {
    if (typeof b.client_name !== "string") return invalidMetadata;
    if (b.client_name.length > MAX_CLIENT_NAME_LENGTH) return invalidMetadata;
    if (CONTROL_CHARS.test(b.client_name)) return invalidMetadata;
    if (b.client_name.trim() !== "") name = b.client_name.trim();
  }

  let grantTypes = ["authorization_code", "refresh_token"];
  if (b.grant_types !== undefined) {
    if (!isStringArray(b.grant_types) || b.grant_types.length === 0) return invalidMetadata;
    if (!b.grant_types.every((g) => GRANT_TYPES.has(g))) return invalidMetadata;
    if (!b.grant_types.includes("authorization_code")) return invalidMetadata;
    grantTypes = [...new Set(b.grant_types)];
  }

  if (b.response_types !== undefined) {
    if (!isStringArray(b.response_types) || b.response_types.length === 0) return invalidMetadata;
    if (!b.response_types.every((r) => r === "code")) return invalidMetadata;
  }

  if (b.scope !== undefined) {
    if (typeof b.scope !== "string" || !scopeIsSupported(b.scope)) return invalidMetadata;
  }

  // token_endpoint_auth_method: we only issue public clients and always answer
  // "none" (RFC 7591 lets the server replace requested values).

  const uris = b.redirect_uris;
  if (!isStringArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) {
    return invalidRedirect;
  }
  if (!uris.every(isAllowedRedirect)) return invalidRedirect;

  const claims: ClientClaims = { name, redirect_uris: [...uris] };
  const clientId = signToken("client", claims, null);
  return {
    status: 201,
    json: {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: [...uris],
      grant_types: grantTypes,
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    },
  };
}

/** Verifies a client id and returns its registered name and redirect URIs. */
export function readClient(clientId: string): ClientClaims | null {
  const claims = verifyToken("client", clientId);
  if (!claims) return null;
  if (typeof claims.name !== "string" || !isStringArray(claims.redirect_uris)) return null;
  return { name: claims.name, redirect_uris: claims.redirect_uris };
}

// ---------- /authorize ----------

export type AuthorizeResult =
  | { ok: true; clientName: string; redirectUri: string; consent: string; csrf: string }
  // redirectTo is set only once client_id and redirect_uri are both verified;
  // before that, errors are shown to the user and never redirected.
  | { ok: false; status: 400; error: string; description: string; redirectTo?: string };

const SINGLE_VALUED = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
  "resource",
] as const;

function sha256b64url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function errorRedirect(redirectUri: string, error: string, description: string, state: string | null) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state !== null) url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Validates an /authorize request. On success returns what the consent page
 * shows, a signed 10-minute `consent` token for its form, and a random `csrf`
 * value the page must set as a SameSite=Strict cookie: the consent token only
 * carries its hash, so a token harvested by a third party is useless in a
 * browser that lacks the cookie.
 */
export function validateAuthorize(params: URLSearchParams): AuthorizeResult {
  const fail = (error: string, description: string): AuthorizeResult => ({
    ok: false,
    status: 400,
    error,
    description,
  });

  for (const key of SINGLE_VALUED) {
    if (params.getAll(key).length > 1) return fail("invalid_request", `Repeated parameter: ${key}`);
  }

  const clientId = params.get("client_id");
  if (!clientId) return fail("invalid_request", "Missing client_id");
  const client = readClient(clientId);
  if (!client) return fail("invalid_client", "Unknown or invalid client_id");

  const redirectUri = params.get("redirect_uri");
  if (!redirectUri) return fail("invalid_request", "Missing redirect_uri");
  if (!client.redirect_uris.includes(redirectUri) || !isAllowedRedirect(redirectUri)) {
    return fail("invalid_request", "redirect_uri is not registered for this client");
  }

  const clientState = params.get("state");
  if (clientState !== null && clientState.length > MAX_STATE_LENGTH) {
    return fail("invalid_request", "state is too long");
  }

  // redirect_uri is trusted from here on: report errors to the client.
  const redirectFail = (error: string, description: string): AuthorizeResult => ({
    ok: false,
    status: 400,
    error,
    description,
    redirectTo: errorRedirect(redirectUri, error, description, clientState),
  });

  const responseType = params.get("response_type");
  if (responseType === null) return redirectFail("invalid_request", "Missing response_type");
  if (responseType !== "code") {
    return redirectFail("unsupported_response_type", "Only response_type=code is supported");
  }

  const challenge = params.get("code_challenge");
  if (!challenge) return redirectFail("invalid_request", "PKCE code_challenge is required");
  if (params.get("code_challenge_method") !== "S256") {
    return redirectFail("invalid_request", "code_challenge_method must be S256");
  }
  if (!CODE_CHALLENGE.test(challenge)) {
    return redirectFail("invalid_request", "Malformed code_challenge");
  }

  const scope = params.get("scope");
  if (scope !== null && !scopeIsSupported(scope)) {
    return redirectFail("invalid_scope", `Only the "${SCOPE}" scope is supported`);
  }

  const resource = params.get("resource");
  if (resource !== null) {
    let okResource = resource.length <= MAX_RESOURCE_LENGTH && !resource.includes("#");
    try {
      new URL(resource);
    } catch {
      okResource = false;
    }
    if (!okResource) return redirectFail("invalid_target", "Malformed resource");
  }

  const csrf = randomBytes(32).toString("base64url");
  const consent = signToken(
    "consent",
    {
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      client_state: clientState,
      resource,
      client_name: client.name,
      csrf_hash: sha256b64url(csrf),
    },
    PENDING_TTL_SECONDS,
  );
  return { ok: true, clientName: client.name, redirectUri, consent, csrf };
}

function safeEqualStrings(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * The Approve click. Verifies the consent token and that this browser holds
 * the matching CSRF cookie, then returns the GitHub sign-in URL whose signed
 * `state` carries the pending authorization plus a fresh nonce. The caller
 * sets the nonce as the `mcp_oauth_nonce` cookie (see nonceCookie) so the
 * callback (Task 6) can check that the same browser comes back.
 */
export function approveAuthorize(
  consent: string,
  origin: string,
  csrfCookie: string | undefined,
): { redirectTo: string; nonce: string } | { error: string; status: 400 } {
  const bad = { error: "Invalid or expired authorization request. Start again from the app.", status: 400 } as const;
  if (typeof consent !== "string" || consent === "") return bad;
  const c = verifyToken("consent", consent);
  if (!c) return bad;
  if (typeof csrfCookie !== "string" || csrfCookie === "") return bad;
  if (typeof c.csrf_hash !== "string" || !safeEqualStrings(sha256b64url(csrfCookie), c.csrf_hash)) {
    return bad;
  }
  if (
    typeof c.client_id !== "string" ||
    typeof c.redirect_uri !== "string" ||
    typeof c.code_challenge !== "string" ||
    !isAllowedRedirect(c.redirect_uri)
  ) {
    return bad;
  }

  const githubClientId = process.env.AUTH_GITHUB_ID;
  if (!githubClientId) throw new Error("AUTH_GITHUB_ID is not set");

  const nonce = randomBytes(32).toString("base64url");
  const state = signToken(
    "state",
    {
      client_id: c.client_id,
      redirect_uri: c.redirect_uri,
      code_challenge: c.code_challenge,
      client_state: typeof c.client_state === "string" ? c.client_state : null,
      resource: typeof c.resource === "string" ? c.resource : null,
      nonce,
    },
    PENDING_TTL_SECONDS,
  );
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId);
  url.searchParams.set("redirect_uri", `${origin}${GITHUB_CALLBACK_PATH}`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return { redirectTo: url.toString(), nonce };
}

// ---------- GitHub callback ----------

/**
 * Proves who signed in at GitHub. Resolves to the numeric GitHub user id (as a
 * string), or null when GitHub did not confirm an identity (bad or expired
 * code, revoked token). Rejects on network/timeout/5xx. The GitHub access
 * token never leaves this function and is never logged.
 */
export type GithubFetch = (code: string, redirectUri: string) => Promise<{ id: string } | null>;

export function makeGithubFetch(fetchImpl: typeof fetch = (...a) => fetch(...a)): GithubFetch {
  return async (code, redirectUri) => {
    const clientId = process.env.AUTH_GITHUB_ID;
    const clientSecret = process.env.AUTH_GITHUB_SECRET;
    if (!clientId || !clientSecret) throw new Error("AUTH_GITHUB_ID/AUTH_GITHUB_SECRET are not set");

    const tokenRes = await fetchImpl("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!tokenRes.ok) throw new Error(`GitHub token exchange failed: HTTP ${tokenRes.status}`);
    let tokenBody: unknown;
    try {
      tokenBody = await tokenRes.json();
    } catch {
      throw new Error("GitHub token exchange returned a non-JSON body");
    }
    // A bad or reused code comes back as 200 with { error }.
    const accessToken = (tokenBody as { access_token?: unknown } | null)?.access_token;
    if (typeof accessToken !== "string" || accessToken === "") return null;

    const userRes = await fetchImpl("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "masa-site-mcp-oauth",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      cache: "no-store",
    });
    if (userRes.status === 401 || userRes.status === 403) return null;
    if (!userRes.ok) throw new Error(`GitHub user lookup failed: HTTP ${userRes.status}`);
    let user: unknown;
    try {
      user = await userRes.json();
    } catch {
      throw new Error("GitHub user lookup returned a non-JSON body");
    }
    const id = (user as { id?: unknown } | null)?.id;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
    return { id: String(id) };
  };
}

const defaultGithubFetch: GithubFetch = makeGithubFetch();

type TimeOpts = { now?: number };

/** The only resource tokens are issued for: this deployment's MCP endpoint. */
export function mcpResource(origin: string): string {
  return `${origin}${MCP_RESOURCE_PATH}`;
}

function withParams(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== null) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * The GitHub callback. The signed `state` must verify and the browser must
 * hold the matching nonce cookie; otherwise the result is a 400 with no
 * redirect (we cannot trust where to send the user). After that, every
 * failure is reported to the client's redirect_uri (RFC 6749 4.1.2.1), and a
 * code is minted only when GitHub confirms the owner's numeric id.
 */
export async function completeAuthorize(
  args: {
    state: string;
    githubCode: string | null;
    githubError?: string | null;
    nonceCookie: string | undefined;
    origin: string;
  },
  gh: GithubFetch = defaultGithubFetch,
  opts?: TimeOpts,
): Promise<{ redirectTo: string } | { error: string; status: 400 }> {
  const bad = { error: "Invalid or expired sign-in. Start again from the app.", status: 400 } as const;
  if (typeof args.state !== "string" || args.state === "") return bad;
  const s = verifyToken("state", args.state, opts);
  if (!s) return bad;
  if (
    typeof s.client_id !== "string" ||
    typeof s.redirect_uri !== "string" ||
    typeof s.code_challenge !== "string" ||
    typeof s.nonce !== "string" ||
    s.nonce === "" ||
    !isAllowedRedirect(s.redirect_uri)
  ) {
    return bad;
  }
  if (typeof args.nonceCookie !== "string" || args.nonceCookie === "") return bad;
  if (!safeEqualStrings(args.nonceCookie, s.nonce)) return bad;

  const redirectUri = s.redirect_uri;
  const clientState = typeof s.client_state === "string" ? s.client_state : null;
  const fail = (error: string, description: string) => ({
    redirectTo: withParams(redirectUri, { error, error_description: description, state: clientState }),
  });

  const resource = mcpResource(args.origin);
  if (s.resource !== null && s.resource !== undefined && s.resource !== resource) {
    return fail("invalid_target", "resource must be this server's MCP endpoint");
  }
  if (args.githubError || !args.githubCode) {
    return fail("access_denied", "GitHub sign-in was not completed");
  }

  let identity: { id: string } | null;
  try {
    identity = await gh(args.githubCode, `${args.origin}${GITHUB_CALLBACK_PATH}`);
  } catch (err) {
    console.error("mcp oauth: GitHub identity check failed:", err instanceof Error ? err.message : "unknown");
    return fail("server_error", "Could not reach GitHub");
  }
  if (!identity || identity.id !== OWNER_GITHUB_ID) {
    return fail("access_denied", "This GitHub account is not allowed");
  }

  const code = signToken(
    "code",
    {
      sub: identity.id,
      client_id: s.client_id,
      redirect_uri: redirectUri,
      code_challenge: s.code_challenge,
      resource,
      scope: SCOPE,
    },
    CODE_TTL_SECONDS,
    opts,
  );
  return { redirectTo: withParams(redirectUri, { code, state: clientState }) };
}

// ---------- POST /oauth/token ----------

export type TokenErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "invalid_target";

export type TokenResult =
  | {
      status: 200;
      json: {
        access_token: string;
        token_type: "Bearer";
        expires_in: number;
        refresh_token: string;
        scope: string;
      };
    }
  | { status: 400; json: { error: TokenErrorCode } };

const TOKEN_SINGLE_VALUED = [
  "grant_type",
  "code",
  "redirect_uri",
  "code_verifier",
  "client_id",
  "refresh_token",
  "resource",
  "scope",
] as const;

function tokenError(error: TokenErrorCode): TokenResult {
  return { status: 400, json: { error } };
}

function issuePair(clientId: string, resource: string, opts?: TimeOpts): TokenResult {
  const claims = { sub: OWNER_GITHUB_ID, client_id: clientId, scope: SCOPE, resource };
  // jti keeps rotated tokens distinct even within the same second.
  const access = signToken("access", { ...claims, jti: randomBytes(16).toString("base64url") }, ACCESS_TTL_SECONDS, opts);
  const refresh = signToken("refresh", { ...claims, jti: randomBytes(16).toString("base64url") }, REFRESH_TTL_SECONDS, opts);
  return {
    status: 200,
    json: {
      access_token: access,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refresh,
      scope: SCOPE,
    },
  };
}

/**
 * RFC 6749 token endpoint for public clients (PKCE, no secret). Throws when
 * MCP_OAUTH_SECRET is unusable; the caller turns that into a bare 500.
 *
 * Stateless by design: a code can be replayed within its 60 s life (PKCE
 * binds it to the client's verifier) and a rotated refresh token stays valid
 * until it expires.
 */
export function exchangeToken(form: URLSearchParams, origin: string, opts?: TimeOpts): TokenResult {
  for (const key of TOKEN_SINGLE_VALUED) {
    if (form.getAll(key).length > 1) return tokenError("invalid_request");
  }
  const grantType = form.get("grant_type");
  if (!grantType) return tokenError("invalid_request");
  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return tokenError("unsupported_grant_type");
  }

  const clientId = form.get("client_id");
  if (!clientId) return tokenError("invalid_request");
  if (!readClient(clientId)) return tokenError("invalid_client");

  const resource = mcpResource(origin);
  const requested = form.get("resource");
  if (requested !== null && requested !== resource) return tokenError("invalid_target");

  if (grantType === "authorization_code") {
    const code = form.get("code");
    const redirectUri = form.get("redirect_uri");
    const verifier = form.get("code_verifier");
    if (!code || !redirectUri || !verifier) return tokenError("invalid_request");
    if (!CODE_VERIFIER.test(verifier)) return tokenError("invalid_request");

    const c = verifyToken("code", code, opts);
    if (!c) return tokenError("invalid_grant");
    if (
      c.client_id !== clientId ||
      c.redirect_uri !== redirectUri ||
      typeof c.code_challenge !== "string" ||
      !verifyPkce(verifier, c.code_challenge) ||
      c.sub !== OWNER_GITHUB_ID ||
      c.resource !== resource ||
      c.scope !== SCOPE
    ) {
      return tokenError("invalid_grant");
    }
    return issuePair(clientId, resource, opts);
  }

  const refreshToken = form.get("refresh_token");
  if (!refreshToken) return tokenError("invalid_request");
  const scope = form.get("scope");
  if (scope !== null && !scopeIsSupported(scope)) return tokenError("invalid_scope");
  const r = verifyToken("refresh", refreshToken, opts);
  if (!r) return tokenError("invalid_grant");
  if (
    r.client_id !== clientId ||
    r.sub !== OWNER_GITHUB_ID ||
    r.resource !== resource ||
    r.scope !== SCOPE
  ) {
    return tokenError("invalid_grant");
  }
  return issuePair(clientId, resource, opts);
}

// ---------- access token check (used by the MCP route) ----------

export type AccessTokenInfo = {
  githubId: string;
  clientId: string;
  scope: string;
  resource: string;
  expiresAt: number;
};

/**
 * Verifies a bearer access token: signature, type `access`, not expired,
 * subject is the owner, scope is planner, and (when `opts.resource` is given)
 * the audience matches. Returns null for any invalid token. Like verifyToken,
 * it THROWS when MCP_OAUTH_SECRET is unusable; callers must fail closed.
 */
export function verifyAccessToken(
  token: string,
  opts?: TimeOpts & { resource?: string },
): AccessTokenInfo | null {
  const c = verifyToken("access", token, opts?.now === undefined ? undefined : { now: opts.now });
  if (!c) return null;
  if (c.sub !== OWNER_GITHUB_ID) return null;
  if (c.scope !== SCOPE) return null;
  if (typeof c.client_id !== "string" || c.client_id === "") return null;
  if (typeof c.resource !== "string") return null;
  if (opts?.resource !== undefined && c.resource !== opts.resource) return null;
  if (typeof c.exp !== "number") return null;
  return { githubId: c.sub, clientId: c.client_id, scope: c.scope, resource: c.resource, expiresAt: c.exp };
}

// ---------- metadata ----------

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${AUTHORIZE_PATH}`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
  };
}

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}${MCP_RESOURCE_PATH}`,
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
  };
}

// ---------- request origin and cookies ----------

const FORWARDED_HOST = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;

function firstHeaderValue(req: Request, name: string): string | null {
  const v = req.headers.get(name);
  if (!v) return null;
  const first = v.split(",")[0].trim();
  return first === "" ? null : first;
}

/**
 * The public origin of this request. Honors x-forwarded-host/proto (set by
 * Vercel) when well-formed, else falls back to the request URL.
 */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const fHost = firstHeaderValue(req, "x-forwarded-host");
  const fProto = firstHeaderValue(req, "x-forwarded-proto")?.toLowerCase() ?? null;
  const host = fHost && FORWARDED_HOST.test(fHost) ? fHost : url.host;
  const proto = fProto === "http" || fProto === "https" ? fProto : url.protocol.slice(0, -1);
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return url.origin;
  }
}

type CookieOpts = { path: string; maxAge: number; sameSite: "Lax" | "Strict"; origin: string };

export function serializeCookie(name: string, value: string, o: CookieOpts): string {
  const parts = [`${name}=${value}`, `Path=${o.path}`, `Max-Age=${o.maxAge}`, "HttpOnly", `SameSite=${o.sameSite}`];
  // Secure everywhere except plain-http local development.
  if (o.origin.startsWith("https:")) parts.push("Secure");
  return parts.join("; ");
}

/** Set-Cookie value for the nonce the GitHub callback (Task 6) checks. */
export function nonceCookie(nonce: string, origin: string): string {
  return serializeCookie(NONCE_COOKIE, nonce, {
    path: GITHUB_CALLBACK_PATH,
    maxAge: PENDING_TTL_SECONDS,
    sameSite: "Lax",
    origin,
  });
}

/** Set-Cookie value that deletes the nonce cookie (same attributes). */
export function clearNonceCookie(origin: string): string {
  return serializeCookie(NONCE_COOKIE, "", {
    path: GITHUB_CALLBACK_PATH,
    maxAge: 0,
    sameSite: "Lax",
    origin,
  });
}

/** Set-Cookie value binding the consent page to this browser. */
export function csrfCookie(value: string, origin: string): string {
  return serializeCookie(CSRF_COOKIE, value, {
    path: AUTHORIZE_PATH,
    maxAge: PENDING_TTL_SECONDS,
    sameSite: "Strict",
    origin,
  });
}

/** Reads one cookie from a Cookie header. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}
