# Instagram Live Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Replace the hand-typed Instagram numbers with live data from the Instagram Graph API (graph.facebook.com), mapped into the existing `InstagramStats` types so the UI is unchanged, with `manual-data.ts` as the fallback.

**Spec:** The user's request in the session plus the smoke-test findings below (user-approved decisions).

## Global Constraints

- Branch `build-site` only. Never touch `main`. `design/` is read-only. AGENTS.md: this Next (16.4, cacheComponents) differs from training data; read `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` and the `cacheLife` doc before touching caching.
- **Secret rules.** `INSTAGRAM_ACCESS_TOKEN` is never printed, logged, echoed, committed, or placed in a URL. It travels only in an `Authorization: Bearer` header. Any error is scrubbed of the token before it is thrown or logged. Modules that read it start with `import "server-only"`. Never read `.env.local` into test output; tests use a fake token string.
- **Tests never make live calls.** Tests inject a fake `fetch`/fixtures. `npm test` must pass with no network and no env vars.
- Env: `INSTAGRAM_ACCESS_TOKEN` (secret), `INSTAGRAM_USER_ID` (= 17841425148460210, not secret). If either is missing, skip the network and use the manual fallback silently.
- API base `https://graph.facebook.com/v25.0`. Permissions on the token are only `instagram_basic` + `instagram_manage_insights`; do not require any other.
- **Verified API facts (smoke test):**
  - Profile `GET /{id}?fields=id,username,followers_count,media_count` works.
  - Media `GET /{id}/media?fields=id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count&limit=50`. `media_product_type` is `REELS` for reels. Only reels have `thumbnail_url`; some reels lack `media_url`; `caption` may be absent.
  - Reel insights `GET /{mediaId}/insights?metric=views,likes,comments,shares,saved` -> `{data:[{name, values:[{value}]}]}`. **Never request `follows` for reels** (400 "does not support the follows metric for this media product type" fails the whole call). `saved` is the saves metric.
  - Account insights `GET /{id}/insights?metric=views,total_interactions,likes,shares,saves&period=day&metric_type=total_value&since=<unix>&until=<unix>` -> `{data:[{name, total_value:{value}}]}`. **since..until must be <= 30 days** (error otherwise). 90 days = three contiguous 30-day calls summed. Use `since = until - 30*86400 + 60` for each chunk, chunk i ends at `now - i*30*86400`.
  - `paging.next` URLs: never follow or log them.
- **User decisions:** reel `follows` stays a placeholder (`[REEL N FOLLOWS]`) when live, never the manual numbers; `othersViews` stays the placeholder `[ALL OTHERS VIEWS]`; `topReels` = REELS only, top 3 by views, fewer than 3 -> shorter array (the page already renders the designed empty slot); thumbnails: cache window shorter than expiry, no proxy, no stored copies; fallback state never renders a CDN image (manual data has no image URL, keep it that way); 90-day totals = 3 chunks summed; `followerGain30d` and `followerHistory` stay as today (placeholder / null) because the daily `follower_count` series looks gross (30-day sum 3,317 vs ~2,467 observed net), so a "gain" would overstate. Reported to the user, not built.
- UI must not change: `ReelCard`/page layout and CSS are not restyled. The only UI addition is the design-documented `<img>` inside `.mn-reel__thumb` (design/system/components/ReelCard.md).
- Run `npm test`, `npm run lint`, `npx tsc --noEmit` before each commit. Commit message trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 1: Graph client with token scrubbing

**Files:**
- Create: `src/lib/instagram/graph.ts` (`import "server-only"`)
- Test: `src/lib/instagram/graph.test.ts`

**Interfaces (produces):**
```ts
export class InstagramApiError extends Error { readonly status: number; readonly code?: number }
export function scrubSecrets(text: string, token?: string): string
export type FetchLike = typeof fetch
export function instagramConfig(env?: Record<string, string | undefined>): { token: string; userId: string } | null  // null if either missing/blank
export function graphGet(path: string, params: Record<string,string>, cfg: {token:string}, fetchImpl?: FetchLike): Promise<unknown>
```
- `graphGet` builds `https://graph.facebook.com/v25.0/${path}` + query params (no token in the URL), sends `Authorization: Bearer <token>`, `cache: "no-store"`, `signal: AbortSignal.timeout(8000)`.
- Non-2xx, network error, timeout, or invalid JSON -> throw `InstagramApiError` whose `message` is `Instagram API <status>: <graph error message if any>` (or a generic message) **after** `scrubSecrets`. `scrubSecrets` removes the exact token (all occurrences), any `Bearer <chars>` run, and `access_token=<chars>` query values. The thrown error must not carry the token in `message`, `stack`-visible `cause`, or any field (do not set `cause` to the raw error).

- [ ] Tests (fake token like `EAAFAKE_TOKEN_123`, fake fetch): token sent only in the Authorization header and absent from the requested URL; a 400 whose body echoes the token -> thrown message does not contain it; a network error whose message contains the token -> scrubbed; `JSON.stringify(err)` and `err.stack`/`message` contain no token; `instagramConfig` null when either var missing or whitespace.
- [ ] Implement, run `npm test`, lint, tsc. Commit `feat(instagram): Graph API client with token scrubbing`.

---

### Task 2: Live fetch and mapping into InstagramStats

**Files:**
- Modify: `src/lib/instagram/types.ts` (add ONE optional field `thumbnailUrl?: string` to `Reel`, documented as "live CDN thumbnail; absent in manual data")
- Create: `src/lib/instagram/live.ts` (`import "server-only"`), `src/lib/instagram/live.test.ts`, `src/lib/instagram/fixtures/*.json` (or `.ts`)

**Interfaces:**
- Consumes Task 1: `graphGet`, `InstagramApiError`, `instagramConfig`, `FetchLike`.
- Produces: `fetchLiveStats(opts?: { fetchImpl?: FetchLike; now?: Date; cfg?: {token:string;userId:string} }): Promise<InstagramStats>` which throws (scrubbed `InstagramApiError`) if any required call fails; and pure exported `mapLiveStats(raw: {profile; media; reelInsights: Record<string, unknown>; account90d: unknown[]}, now: Date): InstagramStats`.

**Mapping rules** (all into existing types; reuse the `known`/placeholder helper style from `manual-data.ts`, do not edit manual-data.ts):
- `source: "instagram-api"`, `status: "live"`, `pulledAt`: UTC `YYYY-MM-DD` of `now`.
- `followers` = known(`followers_count`).
- `startDate` = UTC date of the earliest media `timestamp` (fallback: manual `START_DATE` import is NOT allowed; if no media use `pulledAt`).
- `totals.views/interactions/likes/shares/saves` = sum across the three 30-day chunks of `views`, `total_interactions`, `likes`, `shares`, `saves`. If a metric is missing from a chunk, that whole total is a placeholder (`[TOTAL VIEWS]`, `[TOTAL INTERACTIONS]`, `[TOTAL LIKES]`, `[TOTAL SHARES]`, `[TOTAL SAVES]`), never a partial sum.
- `topReels`: media with `media_product_type === "REELS"`, sorted by lifetime `views` desc, first 3, `rank` 1..n. Per reel: `postedOn` UTC date, `url` = `permalink`, `views`/`likes`/`comments`/`shares`/`saves` known from reel insights (`saved` -> saves), `follows` = placeholder `[REEL N FOLLOWS]`, `caption` = `{kind:"text"}` of the caption trimmed if non-empty else placeholder `[REEL N CAPTION]`, `thumbnail` = placeholder `[REEL N THUMBNAIL]` (kept as is), and `thumbnailUrl` set only if `thumbnail_url` is an `https:` URL whose host ends in `.cdninstagram.com` or `.fbcdn.net` (otherwise omit).
- `othersViews` = placeholder `[ALL OTHERS VIEWS]`. `followerGain30d` = placeholder `[30-DAY GAIN]`. `followerHistory` = null.
- `engagementRate` = `Math.round(interactions/views*1000)/10` when both known and views > 0, else placeholder `[ENGAGEMENT RATE]`.
- `topReelShare` = `Math.round(topReel.views / totals.views * 100)` (same cross-source approximation as manual-data.ts) only when both known, totals.views > 0, and the top reel's `timestamp` is within the 90-day window (>= now - 90d); otherwise placeholder `[TOP REEL SHARE]`.
- Fetch order: profile + media + 3 account chunks in parallel, then reel insights in parallel (one call per reel in the media list). Any failure rejects (no partial results).

- [ ] Fixtures: sanitized JSON shaped exactly like the real responses (profile; media with 3 reels + 1 feed image incl. one reel without `media_url`, one without caption, one with a non-Instagram thumbnail host; per-reel insights; 3 account chunks). Invented values, no real tokens.
- [ ] Tests (fake fetch routing by URL path; no network): ranking by views and top-3 cut with a 4th reel; feed image excluded; totals sum of 3 chunks; missing metric -> placeholder not partial; follows/othersViews/followerGain30d/history as specified; `thumbnailUrl` host allow-list; empty caption -> placeholder; fewer than 3 reels -> shorter array; the reel-insights requests never include `follows`; every request carries the Bearer header and no URL contains the token; a failing request rejects with a message lacking the token.
- [ ] Run `npm test`, lint, tsc. Commit `feat(instagram): live Graph API source mapped to InstagramStats`.

---

### Task 3: Wire live source with cache and manual fallback

**Files:**
- Modify: `src/lib/instagram/index.ts`
- Test: `src/lib/instagram/index.test.ts` (extract the fallback decision into a small exported, non-cached helper such as `resolveStats(fetchLive)` so it is testable; `"use cache"` functions are not unit-testable under `node:test`)
- Modify: `.env.example` (add `INSTAGRAM_ACCESS_TOKEN=` with a comment "Instagram Graph API, system-user token: instagram_basic + instagram_manage_insights. Server-only, never expose." and `INSTAGRAM_USER_ID=`)

**Behavior:**
- `getInstagramStats()` keeps `"use cache"`. It calls `fetchLiveStats()`; on success -> `cacheLife("hours")` (revalidate ~1 h, expire 1 day; Instagram CDN thumbnail URLs live ~5 days, so a cached entry can never outlive them) and returns it. On failure OR missing config -> `console.error` a scrubbed one-line message (failure only, not for missing config), `cacheLife` short (use a custom `{ stale: 30, revalidate: 300, expire: 3600 }` or the doc-correct equivalent) and return `MANUAL_STATS` unchanged (source `manual` -> existing "Manual" state; the manual status stays `"live"`).
- Because `cacheLife` is called after the awaited work, verify against the Next docs that this conditional pattern is valid (it exists in the current file); keep it.
- `INSTAGRAM_SOURCE_KIND` (used by loading fallbacks for copy) = `"instagram-api"` when `instagramConfig()` is non-null at module load, else `"manual"`.
- Keep `manualSource` and the exported types.

- [ ] Tests with injected fetchers: success returns the live stats (source `instagram-api`); a throwing fetcher returns exactly `MANUAL_STATS` (deep-equal, no `thumbnailUrl` on any reel); missing config returns `MANUAL_STATS` without calling the fetcher; the logged message (capture `console.error`) never contains the fake token even when the thrown error echoes it.
- [ ] Run `npm test`, lint, tsc, `npm run build`. Commit `feat(instagram): use live source with 1h cache and manual fallback`.

---

### Task 4: Real reel thumbnails in the designed slot

**Files:**
- Modify: `src/lib/instagram/view.ts` (`ReelView` gets `thumbUrl?: string` from `Reel.thumbnailUrl`), `src/components/ReelCard.tsx` (+ `ReelCard.module.css` for the img rule only), `src/app/(site)/stats/page.tsx` (pass `thumbUrl`)
- Test: `src/lib/instagram/view.test.ts` (view-model mapping), existing tests unchanged

**Behavior:**
- `ReelCard` prop `thumbUrl?: string`. When set, render inside `.mn-reel__thumb`, after the placeholder span and before the rank badge and views label: `<img src={thumbUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer">` absolutely filling the thumb (`position:absolute; inset:0; width:100%; height:100%; object-fit:cover`) via a CSS-module class. The existing `.mn-reel__rank` and `.mn-reel__views` must stay visible above it (check their stacking; add `position:relative`/z-index only if needed, nothing else restyled).
- When `thumbUrl` is set the underlying placeholder text is the design's `"Preview unavailable"` (visible only if the image fails to load, so a broken/expired image degrades to the designed state with no client JS). When not set: unchanged (`[REEL N THUMBNAIL]`).
- Plain `<img>` (not `next/image`: no optimizer, no proxy, no stored copy); add a one-line eslint-disable for `@next/next/no-img-element` with the reason.
- The manual fallback never sets `thumbUrl` (manual reels have no `thumbnailUrl`).

- [ ] Tests: `reelViews` carries `thumbUrl` for a reel with `thumbnailUrl`, omits it for manual data (`MANUAL_STATS` -> every `thumbUrl` undefined). No component rendering test infra exists; keep component change minimal and verify via build + manual browser check by the controller.
- [ ] Run `npm test`, lint, tsc, `npm run build`. Commit `feat(stats): show real reel thumbnails in the designed slot`.
