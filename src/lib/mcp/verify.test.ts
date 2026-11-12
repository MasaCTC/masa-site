// Bearer-token check for the /api/mcp route (owner-only, audience-bound).
import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken } from "./tokens.ts";
import { verifyAccess } from "./verify.ts";
import { OWNER_GITHUB_ID } from "../../test/stubs/auth.ts";

const SECRET = "v".repeat(48);
process.env.MCP_OAUTH_SECRET = SECRET;

const BASE = "https://masa.example";
const RESOURCE = `${BASE}/api/mcp`;
const req = (headers: Record<string, string> = {}) =>
  new Request(RESOURCE, { method: "POST", headers });
const claims = (over: Record<string, unknown> = {}) => ({
  sub: OWNER_GITHUB_ID,
  client_id: "client-abc",
  scope: "planner",
  resource: RESOURCE,
  jti: "j1",
  ...over,
});
const access = (over: Record<string, unknown> = {}, ttl = 3600, now?: number) =>
  signToken("access", claims(over), ttl, now === undefined ? undefined : { now });

test("valid owner access token -> AuthInfo carrying githubId", async () => {
  const token = access();
  const info = await verifyAccess(req(), token);
  assert.ok(info);
  assert.equal(info.token, token);
  assert.equal(info.clientId, "client-abc");
  assert.deepEqual(info.scopes, ["planner"]);
  assert.equal(typeof info.expiresAt, "number");
  assert.ok(info.expiresAt! > Date.now() / 1000);
  assert.deepEqual(info.extra, { githubId: OWNER_GITHUB_ID });
});

test("no bearer / empty / garbage -> undefined", async () => {
  assert.equal(await verifyAccess(req(), undefined), undefined);
  assert.equal(await verifyAccess(req(), ""), undefined);
  assert.equal(await verifyAccess(req(), "garbage"), undefined);
  assert.equal(await verifyAccess(req(), "a.b"), undefined);
});

test("validly signed token for another GitHub id -> undefined", async () => {
  assert.equal(await verifyAccess(req(), access({ sub: "999" })), undefined);
  assert.equal(await verifyAccess(req(), access({ sub: Number(OWNER_GITHUB_ID) })), undefined);
});

test("refresh/code/state/client/consent tokens presented as bearer -> undefined", async () => {
  for (const type of ["refresh", "code", "state", "consent"] as const) {
    const t = signToken(type, claims(), 3600);
    assert.equal(await verifyAccess(req(), t), undefined, type);
  }
  const client = signToken("client", claims(), null);
  assert.equal(await verifyAccess(req(), client), undefined, "client");
});

test("expired token -> undefined", async () => {
  const past = Math.floor(Date.now() / 1000) - 7200;
  assert.equal(await verifyAccess(req(), access({}, 3600, past)), undefined);
});

test("token for another resource (audience) -> undefined", async () => {
  assert.equal(await verifyAccess(req(), access({ resource: "https://other.example/api/mcp" })), undefined);
  assert.equal(await verifyAccess(req(), access({ resource: `${RESOURCE}/` })), undefined);
  // A token for this host, presented to a different origin, is rejected too.
  const other = new Request("https://preview.example/api/mcp", { method: "POST" });
  assert.equal(await verifyAccess(other, access()), undefined);
});

test("audience follows the validated forwarded origin", async () => {
  const proxied = new Request("http://internal:3000/api/mcp", {
    method: "POST",
    headers: { "x-forwarded-host": "masa.example", "x-forwarded-proto": "https" },
  });
  assert.ok(await verifyAccess(proxied, access()));
  const bad = new Request("http://internal:3000/api/mcp", {
    method: "POST",
    headers: { "x-forwarded-host": "masa.example/evil", "x-forwarded-proto": "https" },
  });
  assert.equal(await verifyAccess(bad, access()), undefined);
});

test("wrong scope or missing client_id -> undefined", async () => {
  assert.equal(await verifyAccess(req(), access({ scope: "admin" })), undefined);
  assert.equal(await verifyAccess(req(), access({ client_id: "" })), undefined);
});

test("token signed with a different secret -> undefined", async () => {
  const t = signToken("access", claims(), 3600, { secret: "x".repeat(48) });
  assert.equal(await verifyAccess(req(), t), undefined);
});

test("unusable MCP_OAUTH_SECRET -> throws (fails closed, never a pass)", async () => {
  const token = access();
  const saved = process.env.MCP_OAUTH_SECRET;
  try {
    delete process.env.MCP_OAUTH_SECRET;
    await assert.rejects(async () => verifyAccess(req(), token), /MCP_OAUTH_SECRET/);
    process.env.MCP_OAUTH_SECRET = "short";
    await assert.rejects(async () => verifyAccess(req(), token), /MCP_OAUTH_SECRET/);
  } finally {
    process.env.MCP_OAUTH_SECRET = saved;
  }
});
