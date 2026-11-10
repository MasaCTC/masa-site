import "server-only";

// Minimal Instagram Graph API client. The access token travels only in the
// Authorization header, and every thrown error is scrubbed of it.

const BASE = "https://graph.facebook.com/v25.0";
const TIMEOUT_MS = 8000;

export type FetchLike = typeof fetch;

export class InstagramApiError extends Error {
  readonly status: number;
  readonly code?: number;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "InstagramApiError";
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

/** Remove the exact token, any `Bearer <chars>` run and `access_token=` values. */
export function scrubSecrets(text: string, token?: string): string {
  let out = text;
  if (token) out = out.split(token).join("[REDACTED]");
  return out
    .replace(/Bearer\s+[^\s"'&,;]+/gi, "Bearer [REDACTED]")
    .replace(/access_token=[^\s"'&,;]*/gi, "access_token=[REDACTED]");
}

export function instagramConfig(
  env: Record<string, string | undefined> = process.env,
): { token: string; userId: string } | null {
  const token = env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const userId = env.INSTAGRAM_USER_ID?.trim();
  if (!token || !userId) return null;
  return { token, userId };
}

export async function graphGet(
  path: string,
  params: Record<string, string>,
  cfg: { token: string },
  fetchImpl: FetchLike = fetch,
): Promise<unknown> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${cfg.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // Never keep the raw error (no `cause`): it may echo the token.
    const detail = e instanceof Error ? e.message : "request failed";
    throw new InstagramApiError(
      scrubSecrets(`Instagram API 0: ${detail || "request failed"}`, cfg.token),
      0,
    );
  }

  let text = "";
  try {
    text = await res.text();
  } catch {
    /* treated as empty body below */
  }
  let body: unknown;
  let parsed = false;
  try {
    body = JSON.parse(text);
    parsed = true;
  } catch {
    /* handled below */
  }

  if (!res.ok) {
    const error = (body as { error?: { message?: unknown; code?: unknown } } | null)
      ?.error;
    const msg = typeof error?.message === "string" ? error.message : "";
    const code = typeof error?.code === "number" ? error.code : undefined;
    throw new InstagramApiError(
      scrubSecrets(
        `Instagram API ${res.status}: ${msg || "request failed"}`,
        cfg.token,
      ),
      res.status,
      code,
    );
  }
  if (!parsed) {
    throw new InstagramApiError(
      `Instagram API ${res.status}: invalid JSON response`,
      res.status,
    );
  }
  return body;
}
