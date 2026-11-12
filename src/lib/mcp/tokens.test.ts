// Signed stateless OAuth token primitives.
import { test } from "node:test";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import {
  pkceS256,
  signToken,
  verifyPkce,
  verifyToken,
  type TokenType,
} from "./tokens.ts";

const SECRET = "s".repeat(40);
const OTHER = "o".repeat(40);
const NOW = 1_800_000_000;
const TYPES: TokenType[] = ["client", "consent", "state", "code", "access", "refresh"];

for (const type of TYPES) {
  test(`round trip: ${type}`, () => {
    const t = signToken(type, { sub: "u1", n: 3 }, 60, { secret: SECRET, now: NOW });
    const claims = verifyToken(type, t, { secret: SECRET, now: NOW + 10 });
    assert.ok(claims);
    assert.equal(claims.sub, "u1");
    assert.equal(claims.n, 3);
    assert.equal(claims.typ, type);
    assert.equal(claims.exp, NOW + 60);
  });
}

test("null ttl omits exp and never expires", () => {
  const t = signToken("client", { redirect_uris: ["https://x/cb"] }, null, { secret: SECRET, now: NOW });
  const c = verifyToken("client", t, { secret: SECRET, now: NOW + 10 ** 9 });
  assert.ok(c);
  assert.equal("exp" in c, false);
});

test("a token of one type never verifies as another", () => {
  for (const a of TYPES) {
    const t = signToken(a, { sub: "u" }, 60, { secret: SECRET, now: NOW });
    for (const b of TYPES) {
      if (a === b) continue;
      assert.equal(verifyToken(b, t, { secret: SECRET, now: NOW }), null, `${a} as ${b}`);
    }
  }
});

test("caller claims cannot override typ or exp", () => {
  const t = signToken("access", { typ: "refresh", exp: NOW + 10 ** 9 }, 60, { secret: SECRET, now: NOW });
  const c = verifyToken("access", t, { secret: SECRET, now: NOW });
  assert.equal(c?.typ, "access");
  assert.equal(c?.exp, NOW + 60);
  assert.equal(verifyToken("access", t, { secret: SECRET, now: NOW + 61 }), null);
});

test("tampered payload is rejected", () => {
  const t = signToken("access", { sub: "u1" }, 60, { secret: SECRET, now: NOW });
  const [, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "admin", typ: "access", exp: NOW + 60 })).toString("base64url");
  assert.equal(verifyToken("access", `${forged}.${sig}`, { secret: SECRET, now: NOW }), null);
});

test("tampered signature is rejected", () => {
  const t = signToken("access", { sub: "u1" }, 60, { secret: SECRET, now: NOW });
  const [p, sig] = t.split(".");
  const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
  assert.equal(verifyToken("access", `${p}.${flipped}`, { secret: SECRET, now: NOW }), null);
  assert.equal(verifyToken("access", `${p}.${sig.slice(0, -2)}`, { secret: SECRET, now: NOW }), null);
  assert.equal(verifyToken("access", `${p}.${sig}AA`, { secret: SECRET, now: NOW }), null);
});

test("expiry boundary: valid before exp, rejected at exp", () => {
  const t = signToken("code", {}, 60, { secret: SECRET, now: NOW });
  assert.ok(verifyToken("code", t, { secret: SECRET, now: NOW + 59 }));
  assert.equal(verifyToken("code", t, { secret: SECRET, now: NOW + 60 }), null);
  assert.equal(verifyToken("code", t, { secret: SECRET, now: NOW + 61 }), null);
});

test("wrong secret is rejected", () => {
  const t = signToken("access", {}, 60, { secret: SECRET, now: NOW });
  assert.equal(verifyToken("access", t, { secret: OTHER, now: NOW }), null);
});

test("missing or short secret throws for sign and verify", () => {
  const saved = process.env.MCP_OAUTH_SECRET;
  try {
    delete process.env.MCP_OAUTH_SECRET;
    assert.throws(() => signToken("access", {}, 60));
    assert.throws(() => verifyToken("access", "a.b"));
    process.env.MCP_OAUTH_SECRET = "short";
    assert.throws(() => signToken("access", {}, 60));
    assert.throws(() => verifyToken("access", "a.b"));
    assert.throws(() => signToken("access", {}, 60, { secret: "x".repeat(31) }));
    // 32 chars is accepted, and the env secret is used when no opt is given.
    process.env.MCP_OAUTH_SECRET = "e".repeat(32);
    const t = signToken("access", { a: 1 }, 60);
    assert.ok(verifyToken("access", t));
  } finally {
    if (saved === undefined) delete process.env.MCP_OAUTH_SECRET;
    else process.env.MCP_OAUTH_SECRET = saved;
  }
});

test("garbage, empty, and oversized input returns null without throwing", () => {
  const o = { secret: SECRET, now: NOW };
  const garbage = ["", ".", "..", "a", "a.b", "a.b.c", "!!!.???", "💥.💥", " . ", "null.null", "__proto__.x"];
  for (const g of garbage) assert.equal(verifyToken("access", g, o), null, JSON.stringify(g));
  assert.equal(verifyToken("access", "x".repeat(100_000) + "." + "y".repeat(100_000), o), null);
  assert.equal(verifyToken("access", undefined as unknown as string, o), null);
  assert.equal(verifyToken("access", 42 as unknown as string, o), null);
  assert.equal(verifyToken("nope" as TokenType, "a.b", o), null);
});

test("signToken rejects invalid ttl", () => {
  for (const ttl of [0, -1, NaN, Infinity]) {
    assert.throws(() => signToken("access", {}, ttl, { secret: SECRET, now: NOW }));
  }
});

test("PKCE S256 matches RFC 7636 appendix B", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  assert.equal(pkceS256(verifier), challenge);
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce(verifier + "x", challenge), false);
  assert.equal(verifyPkce(verifier, challenge.slice(0, -1)), false);
  assert.equal(verifyPkce("", challenge), false);
  assert.equal(verifyPkce(verifier, ""), false);
  assert.equal(verifyPkce(undefined as unknown as string, challenge), false);
});

test("only client tokens may be non-expiring", () => {
  for (const type of TYPES) {
    if (type === "client") continue;
    assert.throws(() => signToken(type, {}, null, { secret: SECRET, now: NOW }), type);
  }
});

test("verify rejects non-client tokens without numeric exp", () => {
  for (const type of TYPES) {
    if (type === "client") continue;
    const key = createHmac("sha256", SECRET).update(`mcp:${type}`).digest();
    for (const payload of [{ typ: type }, { typ: type, exp: "9999999999" }]) {
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const sig = createHmac("sha256", key).update(body).digest("base64url");
      assert.equal(verifyToken(type, `${body}.${sig}`, { secret: SECRET, now: NOW }), null, type);
    }
  }
});

test("key separation holds independent of the typ check", () => {
  const accessKey = createHmac("sha256", SECRET).update("mcp:access").digest();
  const body = Buffer.from(JSON.stringify({ typ: "refresh", exp: NOW + 60 })).toString("base64url");
  const sig = createHmac("sha256", accessKey).update(body).digest("base64url");
  assert.equal(verifyToken("refresh", `${body}.${sig}`, { secret: SECRET, now: NOW }), null);
});

test("non-canonical signature encoding is rejected", () => {
  const t = signToken("access", {}, 60, { secret: SECRET, now: NOW });
  const [p, sig] = t.split(".");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const alt = alphabet[alphabet.indexOf(sig.at(-1)!) ^ 1];
  const forged = `${p}.${sig.slice(0, -1)}${alt}`;
  assert.ok(Buffer.from(sig, "base64url").equals(Buffer.from(forged.split(".")[1], "base64url")));
  assert.notEqual(forged, t);
  assert.equal(verifyToken("access", forged, { secret: SECRET, now: NOW }), null);
});

test("signToken rejects tokens over the verify size limit", () => {
  assert.throws(() => signToken("access", { big: "x".repeat(9000) }, 60, { secret: SECRET, now: NOW }));
});
