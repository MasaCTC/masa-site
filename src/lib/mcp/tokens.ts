// Signed stateless OAuth tokens for the MCP connector: base64url(payload).base64url(hmac).
// Each token type has its own derived key, so a token of one type never verifies as another.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TokenType = "client" | "consent" | "state" | "code" | "access" | "refresh";

type Opts = { secret?: string; now?: number };

const TYPES: ReadonlySet<string> = new Set<TokenType>([
  "client",
  "consent",
  "state",
  "code",
  "access",
  "refresh",
]);
const MIN_SECRET_LENGTH = 32;
const MAX_TOKEN_LENGTH = 8192;
const B64URL = /^[A-Za-z0-9_-]+$/;

function getSecret(opts?: Opts): string {
  const secret = opts?.secret ?? process.env.MCP_OAUTH_SECRET;
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`MCP_OAUTH_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

function nowSeconds(opts?: Opts): number {
  return opts?.now ?? Math.floor(Date.now() / 1000);
}

function derivedKey(secret: string, type: TokenType): Buffer {
  return createHmac("sha256", secret).update(`mcp:${type}`).digest();
}

function sign(key: Buffer, payloadB64: string): Buffer {
  return createHmac("sha256", key).update(payloadB64).digest();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signToken(
  type: TokenType,
  claims: Record<string, unknown>,
  ttlSeconds: number | null,
  opts?: Opts,
): string {
  const secret = getSecret(opts);
  if (!TYPES.has(type)) throw new Error("unknown token type");
  const payload: Record<string, unknown> = { ...claims, typ: type };
  delete payload.exp;
  if (ttlSeconds === null) {
    if (type !== "client") throw new Error("only client tokens may be non-expiring");
  } else {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) throw new Error("ttlSeconds must be positive");
    payload.exp = nowSeconds(opts) + Math.floor(ttlSeconds);
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(derivedKey(secret, type), body).toString("base64url");
  const token = `${body}.${sig}`;
  if (token.length > MAX_TOKEN_LENGTH) throw new Error("token too large");
  return token;
}

export function verifyToken(
  type: TokenType,
  token: string,
  opts?: Opts,
): Record<string, unknown> | null {
  const secret = getSecret(opts);
  if (!TYPES.has(type)) return null;
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sigB64] = parts;
  if (!B64URL.test(body) || !B64URL.test(sigB64)) return null;

  const expected = sign(derivedKey(secret, type), body);
  if (!safeEqual(expected, Buffer.from(sigB64, "base64url"))) return null;
  // Reject non-canonical signature encodings (e.g. extra trailing bits).
  if (expected.toString("base64url") !== sigB64) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const claims = payload as Record<string, unknown>;
  if (claims.typ !== type) return null;
  if ("exp" in claims || type !== "client") {
    if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) return null;
    if (nowSeconds(opts) >= claims.exp) return null;
  }
  return claims;
}

export function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (typeof verifier !== "string" || typeof challenge !== "string") return false;
  if (verifier.length === 0 || challenge.length === 0) return false;
  return safeEqual(Buffer.from(pkceS256(verifier)), Buffer.from(challenge));
}
