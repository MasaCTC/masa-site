// HTTP wrappers for the MCP OAuth endpoints. The route files under src/app
// only call these. Plain Request/Response (no next/headers), so node:test can
// load this module directly. Any throw (e.g. missing MCP_OAUTH_SECRET or
// AUTH_GITHUB_ID) becomes a bare 500 with no detail.
import {
  approveAuthorize,
  authorizationServerMetadata,
  clearNonceCookie,
  completeAuthorize,
  CSRF_COOKIE,
  csrfCookie,
  exchangeToken,
  type GithubFetch,
  NONCE_COOKIE,
  nonceCookie,
  protectedResourceMetadata,
  readCookie,
  registerClient,
  requestOrigin,
  validateAuthorize,
} from "./oauth.ts";

const MAX_BODY_BYTES = 16 * 1024;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

// Headers for every HTML page we render (consent, errors, cancelled).
const PAGE_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  // No scripts at all; inline styles only; the form may post here and its
  // response may redirect to GitHub (Chrome applies form-action to redirects).
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://github.com; frame-ancestors 'none'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function serverError(err: unknown): Response {
  console.error("mcp oauth: internal error:", err instanceof Error ? err.message : "unknown");
  return new Response("Server error", {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function guarded(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return serverError(err);
  }
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

/** Reads a request body as text, or null if it is larger than the limit. */
async function boundedText(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await req.text();
  return Buffer.byteLength(text) > MAX_BODY_BYTES ? null : text;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
body{font:16px/1.5 system-ui,-apple-system,sans-serif;margin:0;padding:24px 16px;background:#fafafa;color:#111}
main{max-width:480px;margin:0 auto;background:#fff;border:1px solid #ddd;border-radius:8px;padding:24px}
h1{font-size:20px;margin:0 0 16px}
code{display:block;word-break:break-all;background:#f2f2f2;padding:8px;border-radius:4px;font-size:14px}
.note{color:#555;font-size:14px}
.actions{display:flex;gap:16px;align-items:center;margin-top:24px}
button{font:inherit;padding:8px 20px;border:0;border-radius:6px;background:#111;color:#fff;cursor:pointer}
a{color:#555}
@media (prefers-color-scheme:dark){body{background:#111;color:#eee}main{background:#1b1b1b;border-color:#333}code{background:#262626}.note,a{color:#aaa}button{background:#eee;color:#111}}
`;

function page(title: string, body: string, status: number, extra: Headers | null = null): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body><main>
${body}
</main></body>
</html>`;
  const headers = new Headers(PAGE_HEADERS);
  extra?.forEach((v, k) => headers.append(k, v));
  return new Response(html, { status, headers });
}

function errorPage(message: string, status: number): Response {
  return page(
    "Authorization error",
    `<h1>Can't connect</h1>\n<p>${escapeHtml(message)}</p>`,
    status,
  );
}

function consentPage(clientName: string, redirectUri: string, consent: string): string {
  return `<h1>Connect to your planner?</h1>
<p><strong>${escapeHtml(clientName)}</strong> wants to read and update your planner tasks.</p>
<p class="note">The name above is chosen by the app itself and is not verified. After you approve and sign in with GitHub, you will be sent to:</p>
<code>${escapeHtml(redirectUri)}</code>
<div class="actions">
<form method="post" action="/oauth/authorize"><input type="hidden" name="consent" value="${escapeHtml(consent)}"><button type="submit">Approve</button></form>
<a href="/oauth/authorize?cancelled=1">Cancel</a>
</div>`;
}

// ---------- metadata ----------

export function handleAuthorizationServerMetadata(req: Request): Promise<Response> {
  return guarded(() => json(authorizationServerMetadata(requestOrigin(req)), 200, CORS));
}

export function handleProtectedResourceMetadata(req: Request): Promise<Response> {
  return guarded(() => json(protectedResourceMetadata(requestOrigin(req)), 200, CORS));
}

export function handleCorsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

// ---------- POST /oauth/register ----------

export function handleRegister(req: Request): Promise<Response> {
  return guarded(async () => {
    const text = await boundedText(req);
    if (text === null) return json({ error: "invalid_client_metadata" }, 400, CORS);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "invalid_client_metadata" }, 400, CORS);
    }
    const result = registerClient(body);
    return json(result.json, result.status, CORS);
  });
}

// ---------- GET /oauth/authorize: consent page ----------

export function handleAuthorizeGet(req: Request): Promise<Response> {
  return guarded(() => {
    const url = new URL(req.url);
    if (url.searchParams.has("cancelled")) {
      return page("Cancelled", "<h1>Cancelled</h1>\n<p>Nothing was shared. You can close this tab.</p>", 200);
    }
    const r = validateAuthorize(url.searchParams);
    if (!r.ok) {
      if (r.redirectTo) {
        return new Response(null, {
          status: 302,
          headers: { Location: r.redirectTo, "Cache-Control": "no-store" },
        });
      }
      return errorPage(r.description, r.status);
    }
    const extra = new Headers();
    extra.append("Set-Cookie", csrfCookie(r.csrf, requestOrigin(req)));
    return page("Authorize access", consentPage(r.clientName, r.redirectUri, r.consent), 200, extra);
  });
}

// ---------- POST /oauth/authorize: Approve ----------

export function handleAuthorizePost(req: Request): Promise<Response> {
  return guarded(async () => {
    const origin = requestOrigin(req);
    // Belt and braces next to the SameSite=Strict CSRF cookie: browsers send
    // these on form posts; when present they must say "this site".
    const sentOrigin = req.headers.get("origin");
    if (sentOrigin !== null && sentOrigin !== origin) return errorPage("Cross-site request refused.", 403);
    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite !== null && fetchSite !== "same-origin") {
      return errorPage("Cross-site request refused.", 403);
    }

    const text = await boundedText(req);
    if (text === null) return errorPage("Request too large.", 400);
    const consent = new URLSearchParams(text).get("consent");
    if (!consent) return errorPage("Missing authorization request. Start again from the app.", 400);

    const result = approveAuthorize(consent, origin, readCookie(req, CSRF_COOKIE));
    if ("error" in result) return errorPage(result.error, result.status);

    const headers = new Headers({ Location: result.redirectTo, "Cache-Control": "no-store" });
    headers.append("Set-Cookie", nonceCookie(result.nonce, origin));
    return new Response(null, { status: 302, headers });
  });
}

// ---------- GET /api/auth/callback/github/mcp ----------

const CALLBACK_SINGLE_VALUED = ["state", "code", "error"] as const;

/**
 * GitHub sends the owner back here after Approve. Every response, including
 * the 500, deletes the nonce cookie. `gh` is injectable for tests only.
 */
export async function handleGithubCallback(req: Request, gh?: GithubFetch): Promise<Response> {
  let origin: string;
  try {
    origin = requestOrigin(req);
  } catch (err) {
    return serverError(err);
  }
  const clear = clearNonceCookie(origin);
  try {
    const params = new URL(req.url).searchParams;
    let res: Response;
    if (CALLBACK_SINGLE_VALUED.some((k) => params.getAll(k).length > 1)) {
      res = errorPage("Invalid sign-in response. Start again from the app.", 400);
    } else {
      const result = await completeAuthorize(
        {
          state: params.get("state") ?? "",
          githubCode: params.get("code"),
          githubError: params.get("error"),
          nonceCookie: readCookie(req, NONCE_COOKIE),
          origin,
        },
        gh,
      );
      res =
        "redirectTo" in result
          ? new Response(null, {
              status: 302,
              headers: { Location: result.redirectTo, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
            })
          : errorPage(result.error, result.status);
    }
    res.headers.append("Set-Cookie", clear);
    return res;
  } catch (err) {
    const res = serverError(err);
    res.headers.append("Set-Cookie", clear);
    return res;
  }
}

// ---------- POST /oauth/token ----------

const TOKEN_HEADERS: Record<string, string> = { ...CORS, Pragma: "no-cache" };

export function handleToken(req: Request): Promise<Response> {
  return guarded(async () => {
    const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (type !== "application/x-www-form-urlencoded") {
      return json({ error: "invalid_request" }, 400, TOKEN_HEADERS);
    }
    const text = await boundedText(req);
    if (text === null) return json({ error: "invalid_request" }, 400, TOKEN_HEADERS);
    const result = exchangeToken(new URLSearchParams(text), requestOrigin(req));
    return json(result.json, result.status, TOKEN_HEADERS);
  });
}

export function handleTokenPreflight(): Response {
  return handleCorsPreflight();
}
