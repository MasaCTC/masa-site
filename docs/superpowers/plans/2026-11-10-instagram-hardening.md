# Instagram hardening + security upgrade — Plan

Repo: /Users/masakichien/Projects/masa-site. Base branch: `build-site` (never touch `main`; `design/` is read-only).
Next.js here is 16.4.x with breaking changes: read `node_modules/next/dist/docs/` before touching cache APIs (AGENTS.md).
Spec: the user's brief (4 tasks) as restated below. Prior work: docs/superpowers/plans/2026-11-10-instagram-live-data.md (live source, in `src/lib/instagram/`).

## Global Constraints
- Secret rules unchanged: the Instagram token is never printed, logged, put in a URL, or committed; errors scrubbed; modules stay `import "server-only"`. Never read or print `.env.local`.
- Tests use fixtures, never live calls; `npm test` passes with no env vars.
- Do not restyle; `design/` is read-only. If no designed state fits a real value, STOP and report NEEDS_CONTEXT instead of inventing UI.
- Never run `npm audit fix --force`. No `main` changes.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- `npm run build` may abort once on a Next.js security-advisory notice (network check); retry once.
- Follower growth stays hidden in live mode (`followerGain30d` placeholder, `followerHistory` null). Daily snapshots are a later feature.

## Task 1: Security upgrade (in a worktree on a new branch off build-site)
Advisories (GitHub): next `>=16.0.0 <=16.4.0` — GHSA-673q-mjm6-r5xr (critical, RCE via `use cache` typed arrays), GHSA-2464-fhr4-w9xw (critical, RCE in Image Optimization w/ SVG), GHSA-p3m5-59mp-jv5r / CVE-2026-94482 (high, Server Actions DoS); all fixed in 16.4.1; `npm audit` suggests 16.4.6 (non-major). zod `<4.6.6` — GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404 (high, memory exhaustion), fixed in 4.6.6; currently pinned 4.6.5 in package.json (direct) and also deduped under @modelcontextprotocol/server.
- Create worktree `../masa-site-sec` on branch `chore/security-upgrade` off `build-site`; `npm ci` there.
- Upgrade `next` to 16.4.6 (and `eslint-config-next` only if it must match; it is 16.4.0 — keep it matching next's minor/patch if a 16.4.6 exists) and `zod` to >=4.6.6 (latest 4.x patch). Only these; no majors, no `--force`.
- Run lint, `npx tsc --noEmit`, `npm test`, `npm run build` in the worktree. Re-run `npm audit` and record what remains (expect only dev-tooling moderates needing majors).
- Commit. Report exact before/after versions of every package whose version changed in package-lock (`git diff` of lockfile top-level), and audit before/after counts.
- The controller merges the branch into build-site afterwards (do NOT merge yourself).

## Task 2: Outage handling (`src/lib/instagram/live.ts`, `index.ts`, view/UI only if a designed state is needed)
(a) A failing per-reel insights call must not make `fetchLiveStats` throw. Account totals stay live; only that reel's stats fall back to an existing designed empty/unavailable state (see `ReelCard` `state`/`isError`, "—" views, BarList error/empty state, `engagementEmptyText`, `view.ts` `reelViews`). Caption/permalink/thumbnail from the media list stay. Only failure of the account-level calls (profile, media list, account insights chunks) throws → full Manual fallback. Use `Promise.allSettled` (or per-call catch) for reel insights. Log at most one scrubbed line (e.g. count of reels whose insights failed), never the token. If no existing designed state fits a reel with failed stats, STOP and report NEEDS_CONTEXT with what you found.
(b) Failed results (full fallback) are cached 30 minutes: in `index.ts` change the fallback `cacheLife` to a 30-minute lifetime that still satisfies the docs' prerender thresholds (stale >= 30s, expire >= 5 min, expire > revalidate), e.g. `{ stale: 60, revalidate: 1800, expire: 3600 }` — verify against `node_modules/next/dist/docs/.../cacheLife.md` and the build's route table. A reel-level partial failure should also not be cached for hours: if any reel insights failed, use the same 30-minute lifetime instead of "hours" (the live account totals are fine to refetch at that rate). `resolveStats` currently returns `{stats, ok}`; extend it (e.g. `degraded` flag) as needed so tests can assert which lifetime applies.
Tests (fixtures): one reel insights call fails → stats still live (status "live", source "instagram-api"), that reel's metrics are the placeholders/unavailable, other reels intact; account call fails → throws → MANUAL_STATS; lifetime selection for ok / partial / full failure; no token in logs.

## Task 3: Fixed start date
Add `ACCOUNT_START_DATE = "2026-09-07"` as a fixed setting (own constant, e.g. in `src/lib/instagram/config.ts` or alongside live.ts; must not import from `manual-data.ts`). `mapLiveStats` uses it for `startDate`; stop deriving it from media timestamps. Update the `live.test.ts` assertions/fixtures accordingly and remove the now-dead derivation. (`manual-data.ts` must not be edited.)

## Task 4: Live-mode chart empty copy
In live mode (source `instagram-api`) the growth chart's empty text is `"Follower history isn't tracked yet"`; manual mode keeps `STATS_COPY.chartEmpty` unchanged. Implement via the per-source copy (`src/content/site.ts` source copy map) and pass the right text from `stats/page.tsx` into `GrowthSection` (a new optional `emptyText` prop; `GrowthSection` is a client component — pass a string). Add a test for the selection. No other copy changes.
