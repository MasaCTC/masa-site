# Planner MCP Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A remote MCP server in masa-site that lets Claude (claude.ai custom connector) read and update the planner, signed in through GitHub and open to MasaCTC only.

**Architecture:** One Streamable-HTTP MCP route via Vercel's `mcp-handler`, whose tools call the planner's existing Drizzle/Neon code (shared "core" functions extracted from the server actions; no new store, no schema change). The app is its own *stateless* OAuth server (DCR, authorize, token); every client id, auth code, state and token is an HMAC-signed blob using a new `MCP_OAUTH_SECRET`. GitHub is used only to prove the user is id `152247398`.

**Tech Stack:** Next 16.4 (cacheComponents), `mcp-handler@2.3.1`, `@modelcontextprotocol/server@^2`, zod 4, drizzle + Neon, `node:test` with the recording fake db (`src/test/`).

**Spec:** The user's request in the session plus these decisions (user-approved: stateless OAuth). Decisions below marked *(my call)* are defaults for the user to check.

## Global Constraints

- Read `node_modules/next/dist/docs/` for any Next API you use (AGENTS.md: this Next differs from training data). Read `node_modules/mcp-handler` README/docs for the exact adapter API before writing the route.
- Only GitHub numeric id `152247398` (`OWNER_GITHUB_ID` in `src/auth.ts`) may ever obtain or use a token. Compare ids, never logins.
- No new database table, no migration, no second data store. Tests never reach Neon (`@/db` is the fake in tests).
- No secret in the URL. The MCP endpoint is `/api/mcp`; no query secrets.
- Never write to the real planner data during development. Local Inspector runs use read-only tools against `.env.local` unless the user explicitly approves a write.
- `src/lib/planner/actions.ts` must keep passing `actions-owner.test.ts` (each exported action starts with `const owner = await assertOwner();` / `if (!owner.ok) return owner;`; only async-function exports).
- Run tests with `npm test`; also `npm run lint` and `npm run build` must pass at the end.
- New env var: `MCP_OAUTH_SECRET` (>= 32 chars). GitHub app creds reuse `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
- Redirect URI allowlist *(my call)*: `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback`, and loopback `http://localhost:<port>/...` / `http://127.0.0.1:<port>/...` (Claude Code, MCP Inspector).
- Token lifetimes *(my call)*: auth code 60 s, access 1 h, refresh 30 d (rotated on use), pending-authorization state 10 min. Scope string: `planner`.

## Review Focus

1. A validly signed token for another GitHub id, an expired token, or the wrong token type (refresh/code/client/state used as an access token) must get 401 at the MCP route.
2. A redirect URI off the allowlist must be rejected at `/register` and at `/authorize`; a different `redirect_uri` at `/token` than at `/authorize` must fail.
3. Missing `code_challenge`, plain method, or a wrong `code_verifier` must fail (`invalid_grant` / `invalid_request`).
4. Unknown task id, unknown or ambiguous class name, blank title, malformed date: tool returns an `isError` result with a clear message and writes nothing; it never throws.
5. A malicious client name (`<script>`, quotes) must render escaped on the consent page; the consent page must not be frameable; no GitHub redirect happens before Approve.
6. Callback with a GitHub id that is not the owner (or a GitHub error, or missing/mismatched nonce cookie) issues no code.

---

### Task 1: Extract planner core from server actions

**Files:**
- Create: `src/lib/planner/core.ts`
- Modify: `src/lib/planner/actions.ts` (`addTask`, `addToToday`, `removeFromToday`, `toggleDone`, `editTask` delegate to core)
- Test: existing `actions-*.test.ts` must pass unchanged; add `src/lib/planner/core.test.ts`

**Interfaces:**
- Produces (all in `core.ts`, `import "server-only"`, NOT `"use server"`, NO owner check, NO cache invalidation; callers do both):
  - `invalid(error: z.ZodError | string, field?: string): Invalid` (moved from actions.ts, exported)
  - `addTaskCore(input: AddTaskInput): Promise<TaskResult>`
  - `addToTodayCore(input: IdInput): Promise<TaskResult>`
  - `removeFromTodayCore(input: IdInput): Promise<TaskResult>`
  - `toggleDoneCore(input: ToggleDoneInput): Promise<TaskResult>`
  - `editTaskCore(input: EditTaskInput): Promise<TaskResult>`
  Each has the exact current body of the action between the owner check and `invalidateFromAction`, returning the same results.

- [ ] **Step 1:** Run `npm test` and record the passing count as the baseline.
- [ ] **Step 2:** Create `core.ts` by moving `invalid`, `markHandEdited`, `updateStatusFor`, `classExists` helpers (still non-exported except `invalid`; `deleteTask` and others that remain in actions.ts keep using them, so import `invalid`/helpers from core and export what actions.ts still needs; a "use server" file may not export non-functions, so only import, never re-export) and the five core functions.
- [ ] **Step 3:** Rewrite the five actions as: `assertOwner` two-liner, `const r = await xCore(input); if (r.ok) invalidateFromAction({ now: true }); return r;`.
- [ ] **Step 4:** Write `core.test.ts`: `addTaskCore` with a fake-db insert returns `{ok:true}` and `cacheCalls` stays empty (core never invalidates); `addTaskCore({title:"  "})` returns `error:"invalid"` and `dbLog` is empty; `toggleDoneCore` on missing id returns `{ok:false,error:"not_found"}`.
- [ ] **Step 5:** Run `npm test`. Expected: baseline count + new tests, all pass, no existing test edited.
- [ ] **Step 6:** Commit `refactor: extract planner task core from server actions`.

### Task 2: Task filtering and serialization (pure)

**Files:**
- Create: `src/lib/mcp/tasks-view.ts` (no `server-only`, relative imports only so node:test loads it)
- Test: `src/lib/mcp/tasks-view.test.ts`

**Interfaces:**
- Consumes: `Task`, `Class` types from `src/db/schema.ts`.
- Produces:
  - `type TaskFilter = { day?: string /* YYYY-MM-DD, matches dueDate */; class?: string /* class OR category: id or case-insensitive exact name */; status?: "open" | "done" | "all" /* default "open" */ }`
  - `type ClassRef = { ok: true; cls: Class } | { ok: false; message: string }`
  - `resolveClass(classes: Class[], ref: string): ClassRef` — id match, else case-insensitive name match; unknown or ambiguous returns a `message` listing available names.
  - `filterTasks(tasks: Task[], classes: Class[], f: TaskFilter): { ok: true; tasks: Task[] } | { ok: false; message: string }` — preserves input (rank) order; unknown class is an error, not an empty list.
  - `type TaskView = { id; title; class: string | null; classKind: "class" | "category" | null; dueDate: string | null; estMinutes: number | null; done: boolean; doneAt: string | null; onToday: boolean; source: "manual" | "canvas"; canvasUrl: string | null }`
  - `toTaskView(t: Task, classes: Class[]): TaskView` (class shown by name; `doneAt` ISO string).

- [ ] **Step 1:** Write failing tests: day filter keeps only matching `dueDate`; `status` default hides done; class filter by name (any case) and by id; a `kind:"category"` class filters the same way; unknown class → `ok:false` with names listed; two classes with the same name → ambiguous error; order preserved; `toTaskView` maps class id→name and omits rank/handEdited/canvasUid.
- [ ] **Step 2:** Run `npm test -- ` filter on the file; expect FAIL (module missing).
- [ ] **Step 3:** Implement the four functions above.
- [ ] **Step 4:** Run `npm test`; expect PASS.
- [ ] **Step 5:** Commit `feat(mcp): task filter and view helpers`.

### Task 3: MCP tool functions

**Files:**
- Create: `src/lib/mcp/tools.ts` (`import "server-only"`)
- Modify: `src/test/stubs/next-cache.ts` only if `revalidateTag` is not recorded (record it in `cacheCalls` like the others)
- Test: `src/lib/mcp/tools.test.ts`

**Interfaces:**
- Consumes: Task 1 cores + `invalid`; Task 2 helpers; `listTasks`, `listChecklist`, `listClasses` from `src/lib/planner/queries.ts`; `invalidateFromHandler({now:true})` from `src/lib/planner/invalidate.ts`; `OWNER_GITHUB_ID` from `@/auth`; `plannerToday` from `time.ts`.
- Produces:
  - `type ToolCtx = { githubId?: string }`
  - `type ToolOutput = { content: [{ type: "text"; text: string }]; isError?: true }` (text = `JSON.stringify` of the data, or a plain message when `isError`)
  - Each returns `Promise<ToolOutput>`; first statement of each: if `ctx.githubId !== OWNER_GITHUB_ID` return `{isError:true, "Forbidden"}` and touch nothing.
  - `listTasksTool(ctx, input: { day?, class?, status? })` → `{ count, tasks: TaskView[] }`
  - `getTodaysPlanTool(ctx)` → `{ date: plannerToday(), done, total, tasks: TaskView[] }` from `listChecklist()`
  - `addTaskTool(ctx, input: { title; class?: string; dueDate?: string; estMinutes?: number; onToday?: boolean })` → `{ task: TaskView }`; class by name or id via `resolveClass`; `onToday` defaults to the core default (true). *(my call)*
  - `updateTaskTool(ctx, input: { id; title?; class?: string | null; dueDate?: string | null; estMinutes?: number | null; onToday?: boolean })` → `{ task: TaskView }`; calls `editTaskCore` then `addToTodayCore`/`removeFromTodayCore` when `onToday` given.
  - `completeTaskTool(ctx, input: { id; done?: boolean /* default true */ })` → `{ task: TaskView }` via `toggleDoneCore`.
  - Core failures map to `isError` with `fieldErrors`/`not_found` text. Success of any write calls `invalidateFromHandler({now:true})` once.

- [ ] **Step 1:** Write failing tests, one `test(...)` group per tool, using `resetDb` fake rows like `actions-today.test.ts`:
  - `listTasksTool`: returns rank-ordered open tasks; `{class:"nope"}` → isError; `{day}` filters; `{status:"all"}` includes done.
  - `getTodaysPlanTool`: returns checklist rows and counts; empty list → `total:0`.
  - `addTaskTool`: sends an INSERT, returns the view with class name; blank title → isError and `dbLog` has no INSERT; unknown class → isError no INSERT; invalidation recorded once.
  - `updateTaskTool`: title edit sends UPDATE; `class:null` clears; missing id → isError "not found"; `onToday:false` sends the on_today UPDATE.
  - `completeTaskTool`: default sets done; `done:false` reopens; missing id → isError.
  - `every tool rejects a non-owner`: for each of the 5 tools, `ctx={githubId:"999"}` and `ctx={}` → isError, `dbLog` empty, `cacheCalls` empty.
  - A source-guard test (like `actions-owner.test.ts`) that every exported `*Tool` function's first statement is the owner check.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `tools.ts` (small shared helpers `ok(data)`, `fail(msg)`, `guard(ctx)`).
- [ ] **Step 4:** Run `npm test`; expect PASS.
- [ ] **Step 5:** Commit `feat(mcp): planner tools (list, today, add, update, complete)`.

### Task 4: Signed-token primitives

**Files:**
- Create: `src/lib/mcp/tokens.ts` (`node:crypto` only; no new dependency)
- Test: `src/lib/mcp/tokens.test.ts`

**Interfaces:**
- Produces:
  - `type TokenType = "client" | "consent" | "state" | "code" | "access" | "refresh"`
  - `signToken(type: TokenType, claims: Record<string, unknown>, ttlSeconds: number | null, opts?: { secret?: string; now?: number }): string` — `base64url(payload).base64url(hmac)`, payload includes `typ`, `exp` (omitted when ttl null; `client` ids don't expire). Key = HMAC-SHA256(secret, `"mcp:" + type`) so a token of one type can never verify as another.
  - `verifyToken(type: TokenType, token: string, opts?: { secret?: string; now?: number }): Record<string, unknown> | null` — null on bad format, bad signature (`timingSafeEqual`), wrong type, or expired.
  - Secret read from `process.env.MCP_OAUTH_SECRET`; throws if unset or < 32 chars (at call time, not import time).
  - `pkceS256(verifier: string): string` (base64url SHA-256) and `verifyPkce(verifier: string, challenge: string): boolean` (timing-safe).

- [ ] **Step 1:** Failing tests: round trip; tampered payload and tampered signature → null; token of type A rejected as type B (access↔refresh↔code); expiry boundary with injected `now`; short/missing secret throws; PKCE vector from RFC 7636 appendix B (`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` → `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`).
- [ ] **Step 2:** Run; expect FAIL. **Step 3:** Implement. **Step 4:** Run `npm test`; PASS.
- [ ] **Step 5:** Commit `feat(mcp): signed stateless token primitives`.

### Task 5: OAuth metadata, registration, consent and authorize

**Files:**
- Create: `src/lib/mcp/oauth.ts` (pure logic over `Request`/plain values), `src/app/.well-known/oauth-authorization-server/route.ts`, `src/app/.well-known/oauth-protected-resource/route.ts` (and the path-suffixed `/.well-known/oauth-protected-resource/api/mcp` variant if the adapter docs require it), `src/app/oauth/register/route.ts`, `src/app/oauth/authorize/route.ts` (GET shows consent, POST approves)
- Test: `src/lib/mcp/oauth.test.ts`

**Interfaces:**
- Consumes: Task 4 `signToken`/`verifyToken`/`verifyPkce`.
- Produces in `oauth.ts`:
  - `isAllowedRedirect(uri: string): boolean` (allowlist in Global Constraints; exact match for claude hosts, any port for loopback, no fragments)
  - `registerClient(body: unknown): { status: 201; json: {...RFC 7591 response, client_id: signToken("client", {name, redirect_uris}, null), token_endpoint_auth_method: "none"} } | { status: 400; json: { error: "invalid_redirect_uri" | "invalid_client_metadata" } }`
  - `validateAuthorize(params: URLSearchParams): { ok: true; clientName: string; redirectUri: string; consent: string } | { ok: false; error: string; status: 400 }` — requires `response_type=code`, valid `client_id` (type client), `redirect_uri` ∈ the client's registered URIs and allowlist, `code_challenge` with `code_challenge_method=S256`; `consent = signToken("consent", {client_id, redirect_uri, code_challenge, client_state, resource, client_name}, 600)`.
  - `approveAuthorize(consent: string, origin: string): { redirectTo: string; nonce: string } | { error: string; status: 400 }` — verifies the `consent` token (type `consent`), then returns the GitHub authorize URL (`https://github.com/login/oauth/authorize`, `client_id=AUTH_GITHUB_ID`, `redirect_uri=${origin}/api/auth/callback/github/mcp`, `scope=read:user`, `state=signToken("state", {client_id, redirect_uri, code_challenge, client_state, resource, nonce}, 600)`).
  - Metadata documents: issuer = origin; `authorization_endpoint=/oauth/authorize`, `token_endpoint=/oauth/token`, `registration_endpoint=/oauth/register`, `code_challenge_methods_supported:["S256"]`, `grant_types_supported:["authorization_code","refresh_token"]`, `token_endpoint_auth_methods_supported:["none"]`; protected resource: `resource=${origin}/api/mcp`, `authorization_servers:[origin]`.
- **Consent screen** *(user-requested)*: `GET /oauth/authorize` runs `validateAuthorize`; on success renders a minimal HTML page showing the client name (HTML-escaped; it is attacker-supplied via DCR) and the exact redirect URI, with one **Approve** button (a `<form method="post">` carrying the signed `consent` token in a hidden field) and a **Cancel** link back to nothing destructive (plain text "Cancelled" page). Nothing is sent to GitHub until Approve. The page sets `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` (clickjacking), `Cache-Control: no-store`, and uses inline styles only. `POST /oauth/authorize` reads the `consent` field, calls `approveAuthorize`, sets the nonce cookie, and 302s to GitHub. Reject a POST with a missing or bad token (400).
- `approveAuthorize` is what sets up the cookie: it sets an httpOnly, Secure (not on localhost), SameSite=Lax, 10-min cookie `mcp_oauth_nonce` = `nonce`, then 302s to GitHub (on POST only). Origin comes from the request (honor `x-forwarded-*` like the adapter does).

- [ ] **Step 1:** Failing tests: `isAllowedRedirect` accepts the 2 claude URIs and `http://localhost:6274/oauth/callback`/`http://127.0.0.1:1/x`, rejects `https://evil.test/cb`, `http://claude.ai/...`, `https://claude.ai/other`, `javascript:` and URIs with fragments; `registerClient` happy path and rejection of a bad URI; `beginAuthorize` rejects missing/plain PKCE, unregistered `redirect_uri`, tampered `client_id`; happy path of `validateAuthorize` returns the client name, redirect URI and a verifiable consent token; `approveAuthorize` rejects a tampered, expired or wrong-type consent token (a `state`/`access` token must not work) and its happy-path URL carries a verifiable state and the nonce; the GET page HTML contains the escaped client name (test with `<script>` in the name) and the redirect URI, and the anti-framing headers; GET never redirects to GitHub.
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement logic then the thin route files (each route: `await connection()` if Next requires dynamic opt-in under cacheComponents — check docs). **Step 4:** `npm test` PASS; `npm run build` PASS.
- [ ] **Step 5:** Commit `feat(mcp): OAuth metadata, dynamic registration and authorize`.

### Task 6: GitHub callback and token endpoint

**Files:**
- Create: add to `src/lib/mcp/oauth.ts`; `src/app/api/auth/callback/github/mcp/route.ts` (more specific than the Auth.js catch-all; path is a subdirectory of the registered GitHub callback, which GitHub accepts), `src/app/oauth/token/route.ts`
- Test: extend `src/lib/mcp/oauth.test.ts`

**Interfaces:**
- Produces in `oauth.ts`:
  - `type GithubFetch = (code: string, redirectUri: string) => Promise<{ id: string } | null>` (default implementation: POST `https://github.com/login/oauth/access_token` with `AUTH_GITHUB_ID/SECRET`, then GET `https://api.github.com/user`, return `String(id)`; the GitHub access token is discarded immediately, never stored/logged; injectable for tests)
  - `completeAuthorize(args: { state: string; githubCode: string; nonceCookie: string | undefined; origin: string }, gh: GithubFetch = default): Promise<{ redirectTo: string } | { error: string; status: 400 | 403 }>` — verifies state (type `state`), `nonceCookie === state.nonce` (timing-safe), exchanges the GitHub code, requires `id === OWNER_GITHUB_ID` (else 403, **no code issued**), then returns `redirect_uri?code=<signToken("code",{sub:id,client_id,redirect_uri,code_challenge,resource},60)>&state=<client_state>`.
  - `exchangeToken(form: URLSearchParams): { status: 200; json: { access_token, token_type: "Bearer", expires_in: 3600, refresh_token, scope: "planner" } } | { status: 400; json: { error: "invalid_grant" | "invalid_request" | "unsupported_grant_type" | "invalid_client" } }` — `authorization_code`: verify code, `client_id` and `redirect_uri` equal the code's, `verifyPkce(code_verifier, code_challenge)`; `refresh_token`: verify refresh token and `client_id`, issue a new pair (rotation). Both set `sub` from the verified token and re-check `sub === OWNER_GITHUB_ID` before minting. Responses carry `Cache-Control: no-store`.
- The callback route clears the nonce cookie and redirects (302) to `redirectTo`; on error renders a plain text page, status from the result.

- [ ] **Step 1:** Failing tests (inject `gh`): owner id → redirect with code; id `"999"` → 403 and no `code=` anywhere; null from GitHub → 403; missing or different nonce cookie → 400; expired/tampered state → 400; token exchange happy path then PKCE wrong verifier → `invalid_grant`; code reused with different `redirect_uri` → `invalid_grant`; code presented after 60 s (inject `now`) → `invalid_grant`; refresh token happy path returns a new pair; access token presented as `refresh_token` → `invalid_grant`; a forged `code` signed for `sub:"999"` → `invalid_grant`.
- [ ] **Step 2:** Run; FAIL. **Step 3:** Implement. **Step 4:** `npm test` PASS.
- [ ] **Step 5:** Commit `feat(mcp): GitHub owner check and token endpoint`.

### Task 7: MCP route with auth

**Files:**
- Modify: `package.json` / lock (`npm i mcp-handler@2.3.1 @modelcontextprotocol/server` at the version `mcp-handler` peer-depends on, pinned exactly like other deps), `.env.example` (add `MCP_OAUTH_SECRET=`)
- Create: `src/app/api/[transport]/route.ts`, `src/lib/mcp/verify.ts`
- Test: `src/lib/mcp/verify.test.ts`

**Interfaces:**
- Consumes: Task 3 tools, Task 4 `verifyToken`.
- Produces:
  - `verifyAccess(req: Request, bearer?: string): Promise<AuthInfo | undefined>` in `verify.ts` — returns `{ token, clientId, scopes:["planner"], expiresAt, extra:{ githubId } }` only when `verifyToken("access", bearer)` succeeds, `sub === OWNER_GITHUB_ID`, else `undefined`.
  - Route: `createMcpHandler` registering the five tools with zod 4 input schemas matching Task 3 (descriptions written for Claude: when to use each, date format `YYYY-MM-DD`, class by name), `basePath: "/api"`, SSE disabled (Streamable HTTP only, no Redis), wrapped by `withMcpAuth(handler, verifyAccess, { required: true, requiredScopes: ["planner"], resourceMetadataPath: "/.well-known/oauth-protected-resource" })`; exports `GET` and `POST` (and `DELETE` if the adapter docs say so). Each tool callback passes `{ githubId: ctx.http?.authInfo?.extra?.githubId }` into the Task 3 function. Tool annotations: read tools `readOnlyHint:true`; no delete tool exists.

- [ ] **Step 1:** Failing tests for `verifyAccess`: valid owner access token → AuthInfo; another id's validly signed token → undefined; refresh/code/state/client token → undefined; expired → undefined; no bearer → undefined; garbage → undefined.
- [ ] **Step 2:** Run; FAIL. **Step 3:** Install deps, implement `verify.ts` and the route. **Step 4:** `npm test`, `npm run lint`, `npm run build` all pass.
- [ ] **Step 5:** Add a route-level test if the adapter handler is importable under the test hooks (POST without `Authorization` → 401 with `WWW-Authenticate` containing `resource_metadata`; with a non-owner signed token → 401). If not importable, note why in the commit body and rely on `verify.test.ts` plus Task 8.
- [ ] **Step 6:** Commit `feat(mcp): /api/mcp route behind owner-only OAuth`.

### Task 8: Local end-to-end with MCP Inspector (read-only on real data)

**Files:** none (verification); fix defects in the files above if found.

- [ ] **Step 1:** Ask the user to add `MCP_OAUTH_SECRET` (32+ random chars; suggest `openssl rand -base64 48`) to `.env.local`, and to confirm the GitHub OAuth app's callback allows `http://localhost:3000/api/auth/callback/github/mcp` (it does if the registered callback is `http://localhost:3000/api/auth/callback/github`; otherwise they add it). Do not read or print `.env.local` values.
- [ ] **Step 2:** `npm run dev`; `npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://localhost:3000/api/mcp` → run the OAuth flow in the Inspector, sign in as MasaCTC.
- [ ] **Step 3:** Call only `list_tasks`, `get_todays_plan` against the real database. **Stop and ask the user before calling `add_task`, `update_task` or `complete_task`.** If they approve, the exact call and arguments are shown first and undone (complete → reopen) afterwards.
- [ ] **Step 4:** Confirm an unauthenticated `curl -i -X POST http://localhost:3000/api/mcp` returns 401 with `WWW-Authenticate`.
- [ ] **Step 5:** Report what worked and anything unverified. Commit any fixes.

### Task 9: Deploy (needs the user)

- [ ] **Step 1:** Ask before: setting `MCP_OAUTH_SECRET` in Vercel (Production; a different value from local is fine), pushing the branch / deploying. The `vercel` CLI is not installed and there is no `.vercel` link; the user either connects via git push or runs `vercel login` and `vercel link` (suggest `! vercel ...` in the prompt).
- [ ] **Step 2:** Confirm the GitHub OAuth app callback covers `https://<production-domain>/api/auth/callback/github/mcp` (subdirectory of the existing callback).
- [ ] **Step 3:** After deploy: `curl -i -X POST https://<domain>/api/mcp` expects 401 with `WWW-Authenticate: ... resource_metadata=...`; `curl https://<domain>/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server` return JSON with the production origin.
- [ ] **Step 4:** Give the user the exact connector URL: `https://<production-domain>/api/mcp` for claude.ai → Settings → Connectors → Add custom connector (leave Advanced client id/secret empty; DCR handles it). Note: to revoke all access, rotate `MCP_OAUTH_SECRET`.
