// Stateless OAuth 2.1 authorization server for the MCP connector: metadata,
// dynamic client registration (RFC 7591) and the /authorize consent step.
// Every client id, consent, state, code and token is an HMAC-signed blob from
// ./tokens.ts, so there is no table. GitHub is only used (Task 6) to prove the
// signed-in user is the owner.
//
// Pure functions over plain values; the HTTP wrapping lives in ./oauth-http.ts.
// signToken/verifyToken THROW when MCP_OAUTH_SECRET is missing or short, and
// approveAuthorize throws when AUTH_GITHUB_ID is unset: callers must turn a
// throw into a bare 500, never a pass.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { signToken, verifyToken } from "./tokens.ts";

export const SCOPE = "planner";
export const MCP_RESOURCE_PATH = "/api/mcp";
export const GITHUB_CALLBACK_PATH = "/api/auth/callback/github/mcp";
export const NONCE_COOKIE = "mcp_oauth_nonce";
export const CSRF_COOKIE = "mcp_oauth_csrf";
export const AUTHORIZE_PATH = "/oauth/authorize";
/** Lifetime of the consent and state tokens and their cookies (10 min). */
export const PENDING_TTL_SECONDS = 600;

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
// RFC 7636: base64url, 43-128 chars (an S256 challenge is exactly 43).
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/;
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
