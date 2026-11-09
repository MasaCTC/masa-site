// The /api/mcp handler, driven in-process through its Request -> Response
// function: bearer auth (401 + RFC 9728 challenge), the five tools over real
// JSON-RPC, and error mapping. "@/db" is the recording fake (no network).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { McpServer } from "@modelcontextprotocol/server";
import { signToken } from "./tokens.ts";
import { handleMcp, registerPlannerTools } from "./server.ts";
import { OWNER_GITHUB_ID } from "../../test/stubs/auth.ts";
import { dbLog, resetDb, type Sent } from "../../test/stubs/db.ts";
import { cacheCalls } from "../../test/stubs/next-cache.ts";

const SECRET = "s".repeat(48);
process.env.MCP_OAUTH_SECRET = SECRET;

const BASE = "https://masa.example";
const RESOURCE = `${BASE}/api/mcp`;
const METADATA = `resource_metadata="${BASE}/.well-known/oauth-protected-resource/api/mcp"`;
const ID = "00000000-0000-4000-8000-000000000001";
const CS_ID = "00000000-0000-4000-8000-0000000000c1";
const PROTOCOL = "2025-06-18";

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

type Rpc = { jsonrpc: "2.0"; id?: number; method: string; params?: unknown };
type RpcReply = { id?: number; result?: Record<string, unknown>; error?: { code: number; message: string } };

function post(body: unknown, token?: string, extra: Record<string, string> = {}, url = RESOURCE): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...extra,
    },
    body: JSON.stringify(body),
  });
}

/** Reads a JSON-RPC reply whether it came back as JSON or as an SSE stream. */
async function reply(res: Response): Promise<RpcReply> {
  const text = await res.text();
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    assert.equal(data.length, 1, text);
    return JSON.parse(data[0]);
  }
  return JSON.parse(text);
}

let nextId = 1;
async function rpc(method: string, params?: unknown, token = access()): Promise<RpcReply> {
  const msg: Rpc = { jsonrpc: "2.0", id: nextId++, method, ...(params === undefined ? {} : { params }) };
  const res = await handleMcp(post(msg, token, { "mcp-protocol-version": PROTOCOL }));
  assert.equal(res.status, 200);
  return reply(res);
}
type CallResult = { content: { type: string; text: string }[]; isError?: boolean };
async function call(name: string, args: Record<string, unknown> = {}, token?: string): Promise<CallResult> {
  const r = await rpc("tools/call", { name, arguments: args }, token);
  assert.equal(r.error, undefined, JSON.stringify(r.error));
  return r.result as unknown as CallResult;
}

// Column order of the tasks / classes tables (as in tools.test.ts).
const row = (o: { title?: string; done?: boolean } = {}) => [
  ID, o.title ?? "T", CS_ID, "2026-02-01", 30, o.done ?? false, o.done ? "2026-01-02T00:00:00Z" : null,
  "a0", "manual", null, null, false, true, "2026-01-01T00:00:00Z",
];
const classRows = [[CS_ID, "CS 101", "class", "sea", null, "2026-01-01T00:00:00Z"]];
type Q = Sent & { arrayMode: boolean };
const writes = (): Sent[] =>
  dbLog.flatMap((e) => (e.kind === "batch" ? e.queries : e.sql.startsWith("select") ? [] : [e]));
const plannerDb = ({ sql }: Q) =>
  sql.startsWith("select") && sql.includes('from "classes"')
    ? classRows
    : sql.startsWith('select "rank"')
      ? [["a5"]]
      : sql.includes('"tasks"')
        ? [row()]
        : [];

beforeEach(() => {
  resetDb();
  cacheCalls.length = 0;
  process.env.MCP_OAUTH_SECRET = SECRET;
});

// ---------- (a) no token ----------

test("no token -> 401 with WWW-Authenticate pointing at the protected resource metadata", async () => {
  for (const req of [
    post({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    post({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    new Request(RESOURCE, { method: "GET", headers: { accept: "text/event-stream" } }),
    new Request(RESOURCE, { method: "DELETE" }),
  ]) {
    const res = await handleMcp(req);
    assert.equal(res.status, 401, req.method);
    const www = res.headers.get("www-authenticate") ?? "";
    assert.match(www, /^Bearer /);
    assert.ok(www.includes(METADATA), www);
    assert.ok(www.includes('error="invalid_token"'), www);
  }
  assert.deepEqual(dbLog, []);
});

test("challenge origin uses the validated forwarded origin, not a raw header", async () => {
  const msg = { jsonrpc: "2.0", id: 1, method: "tools/list" };
  let res = await handleMcp(
    post(msg, undefined, { "x-forwarded-host": "masa.example", "x-forwarded-proto": "https" }, "http://internal:3000/api/mcp"),
  );
  assert.ok((res.headers.get("www-authenticate") ?? "").includes(METADATA));
  res = await handleMcp(
    post(msg, undefined, { "x-forwarded-host": "evil.test/x?", "x-forwarded-proto": "https" }, "http://internal:3000/api/mcp"),
  );
  // requestOrigin drops the malformed host (keeps the well-formed proto),
  // exactly as the OAuth routes do.
  const www = res.headers.get("www-authenticate") ?? "";
  assert.ok(www.includes('resource_metadata="https://internal:3000/.well-known/oauth-protected-resource/api/mcp"'), www);
  assert.ok(!www.includes("evil.test"), www);
});

// ---------- (b) bad tokens ----------

test("garbage, expired, wrong-resource, non-owner, wrong-type and foreign-secret tokens -> 401", async () => {
  const past = Math.floor(Date.now() / 1000) - 7200;
  const bad: Record<string, string> = {
    garbage: "not-a-token",
    expired: access({}, 3600, past),
    wrongResource: access({ resource: "https://other.example/api/mcp" }),
    trailingSlashResource: access({ resource: `${RESOURCE}/` }),
    nonOwner: access({ sub: "999" }),
    refresh: signToken("refresh", claims(), 3600),
    code: signToken("code", claims(), 60),
    client: signToken("client", claims(), null),
    foreignSecret: signToken("access", claims(), 3600, { secret: "x".repeat(48) }),
  };
  for (const [name, token] of Object.entries(bad)) {
    for (const method of ["tools/list", "initialize"]) {
      const res = await handleMcp(post({ jsonrpc: "2.0", id: 1, method, params: {} }, token));
      assert.equal(res.status, 401, `${name} ${method}`);
      assert.ok((res.headers.get("www-authenticate") ?? "").includes(METADATA), name);
    }
  }
  const basic = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, undefined, { authorization: `Basic ${access()}` }));
  assert.equal(basic.status, 401);
  assert.deepEqual(dbLog, []);
});

test("missing or short MCP_OAUTH_SECRET -> 401, no tool access, nothing leaked", async () => {
  const token = access();
  const errors: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void errors.push(a);
  try {
    for (const secret of [undefined, "short"]) {
      if (secret === undefined) delete process.env.MCP_OAUTH_SECRET;
      else process.env.MCP_OAUTH_SECRET = secret;
      for (const method of ["tools/list", "tools/call"]) {
        const res = await handleMcp(
          post({ jsonrpc: "2.0", id: 1, method, params: { name: "list_tasks", arguments: {} } }, token),
        );
        assert.equal(res.status, 401);
        const body = await res.text();
        assert.ok(!body.includes("MCP_OAUTH_SECRET") && !/\bat .+:\d+:\d+/.test(body), body);
        assert.ok(!body.includes("tools"), body);
      }
    }
  } finally {
    console.error = orig;
  }
  assert.deepEqual(dbLog, []);
});

// ---------- (c) valid owner token, end to end ----------

test("owner token: initialize, tools/list (five tools, annotations) over JSON-RPC", async () => {
  const init = await rpc("initialize", {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(init.error, undefined);
  assert.equal((init.result?.serverInfo as { name: string }).name, "masa-planner");
  assert.ok((init.result?.capabilities as { tools?: unknown }).tools);

  const list = await rpc("tools/list");
  type Tool = {
    name: string;
    description: string;
    inputSchema: { properties?: Record<string, unknown>; required?: string[] };
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  };
  const tools = (list.result?.tools as Tool[]) ?? [];
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    "add_task",
    "complete_task",
    "get_todays_plan",
    "list_tasks",
    "update_task",
  ]);
  const by = Object.fromEntries(tools.map((t) => [t.name, t]));
  for (const n of ["list_tasks", "get_todays_plan"]) {
    assert.equal(by[n].annotations?.readOnlyHint, true, n);
  }
  for (const n of ["add_task", "update_task", "complete_task"]) {
    assert.equal(by[n].annotations?.readOnlyHint, false, n);
    assert.equal(by[n].annotations?.destructiveHint, false, n);
    assert.match(by[n].description, /changes planner data/, n);
  }
  assert.deepEqual(Object.keys(by.list_tasks.inputSchema.properties ?? {}).sort(), ["class", "day", "status"]);
  assert.deepEqual(Object.keys(by.add_task.inputSchema.properties ?? {}).sort(), [
    "class",
    "dueDate",
    "estMinutes",
    "onToday",
    "title",
  ]);
  assert.deepEqual(by.add_task.inputSchema.required, ["title"]);
  assert.deepEqual(by.update_task.inputSchema.required, ["id"]);
  assert.deepEqual(by.complete_task.inputSchema.required, ["id"]);
  for (const t of tools) assert.ok(!JSON.stringify(t.inputSchema).includes("githubId"), t.name);
  assert.deepEqual(dbLog, []);
});

test("owner token: tools/call reaches each planner function as the owner", async () => {
  resetDb(plannerDb);
  const text = (r: CallResult) => JSON.parse(r.content[0].text);

  let r = await call("list_tasks", { class: "CS 101" });
  assert.notEqual(r.isError, true, r.content[0].text);
  assert.equal(text(r).count, 1);
  assert.equal(text(r).tasks[0].class, "CS 101");

  r = await call("get_todays_plan");
  assert.notEqual(r.isError, true, r.content[0].text);
  assert.equal(text(r).total, 1);

  resetDb(plannerDb);
  r = await call("add_task", { title: "Read ch. 3", class: "cs 101", dueDate: "2026-02-01", estMinutes: 30 });
  assert.notEqual(r.isError, true, r.content[0].text);
  const ins = writes().find((w) => w.sql.startsWith('insert into "tasks"'));
  assert.ok(ins && ins.params.includes("Read ch. 3") && ins.params.includes(CS_ID), JSON.stringify(ins));

  resetDb(plannerDb);
  r = await call("update_task", { id: ID, title: "Renamed" });
  assert.notEqual(r.isError, true, r.content[0].text);
  const upd = writes().find((w) => w.sql.startsWith('update "tasks"'));
  assert.ok(upd && upd.params.includes("Renamed"), JSON.stringify(dbLog));
  // Omitted fields stay omitted end to end (not cleared).
  assert.ok(!/"due_date"|"class_id"|"est_minutes"/.test(upd.sql.split(" where ")[0]), upd.sql);

  resetDb(plannerDb);
  r = await call("complete_task", { id: ID });
  assert.notEqual(r.isError, true, r.content[0].text);
  const done = writes().find((w) => w.sql.startsWith('update "tasks"'));
  assert.ok(done && done.params.includes(true), JSON.stringify(dbLog));
  assert.ok(cacheCalls.length > 0);
});

test("invalid tool arguments are rejected before any write", async () => {
  resetDb(plannerDb);
  for (const [name, args] of [
    ["add_task", { title: "" }],
    ["add_task", { title: "x", dueDate: "tomorrow" }],
    ["update_task", { id: "nope", title: "x" }],
    ["complete_task", {}],
    ["list_tasks", { status: "weird" }],
  ] as const) {
    const res = await rpc("tools/call", { name, arguments: args });
    const isErr = res.error !== undefined || (res.result as { isError?: boolean } | undefined)?.isError === true;
    assert.ok(isErr, `${name} ${JSON.stringify(args)}`);
  }
  assert.deepEqual(writes(), []);
});

// ---------- githubId only from the verified token ----------

type Registered = { name: string; cb: (...a: unknown[]) => Promise<CallResult> };
function captureTools(): Registered[] {
  const out: Registered[] = [];
  const fake = {
    registerTool: (name: string, _cfg: unknown, cb: Registered["cb"]) => void out.push({ name, cb }),
  } as unknown as McpServer;
  registerPlannerTools(fake);
  return out;
}

test("tool callbacks take githubId from authInfo only; input cannot supply it", async () => {
  resetDb(plannerDb);
  const tools = captureTools();
  assert.equal(tools.length, 5);
  const argsFor: Record<string, unknown> = {
    list_tasks: { githubId: OWNER_GITHUB_ID },
    add_task: { title: "x", githubId: OWNER_GITHUB_ID },
    update_task: { id: ID, title: "x", githubId: OWNER_GITHUB_ID },
    complete_task: { id: ID, githubId: OWNER_GITHUB_ID },
  };
  const invoke = (t: Registered, ctx: unknown) =>
    t.name === "get_todays_plan" ? t.cb(ctx) : t.cb(argsFor[t.name], ctx);
  for (const t of tools) {
    for (const ctx of [{}, { http: {} }, { http: { authInfo: { extra: {} } } }, { http: { authInfo: { extra: { githubId: "999" } } } }]) {
      const r = await invoke(t, ctx);
      assert.equal(r.isError, true, `${t.name} ${JSON.stringify(ctx)}`);
      assert.equal(r.content[0].text, "Forbidden");
    }
  }
  assert.deepEqual(dbLog, []);
  for (const t of tools) {
    const r = await invoke(t, { http: { authInfo: { extra: { githubId: OWNER_GITHUB_ID } } } });
    assert.notEqual(r.isError, true, `${t.name}: ${r.content[0].text}`);
  }
});

// ---------- (d) thrown errors ----------

test("a database failure becomes a generic isError result: no message, stack or secret", async () => {
  const errors: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void errors.push(a);
  try {
    resetDb(() => {
      throw new Error(`connection to postgres://user:hunter2@db.internal failed ${SECRET}`);
    });
    for (const [name, args] of [
      ["list_tasks", {}],
      ["get_todays_plan", {}],
      ["add_task", { title: "x" }],
      ["update_task", { id: ID, title: "x" }],
      ["complete_task", { id: ID }],
    ] as const) {
      const res = await handleMcp(
        post({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args } }, access(), {
          "mcp-protocol-version": PROTOCOL,
        }),
      );
      assert.equal(res.status, 200, name);
      const raw = await res.clone().text();
      for (const leak of ["hunter2", "postgres://", "db.internal", SECRET, "Error:", "    at "]) {
        assert.ok(!raw.includes(leak), `${name} leaked ${leak}: ${raw}`);
      }
      const r = (await reply(res)).result as unknown as CallResult;
      assert.equal(r.isError, true, name);
      assert.match(r.content[0].text, /could not complete/);
    }
  } finally {
    console.error = orig;
  }
  // Logged server-side without the message text.
  assert.ok(errors.length >= 5);
  assert.ok(!JSON.stringify(errors).includes("hunter2"));
});
