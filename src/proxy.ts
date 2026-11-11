import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth, OWNER_GITHUB_ID } from "@/auth";

// A signed-out request to /planner must be indistinguishable from any other
// missing URL: same status, headers and body. Two things would give it away:
//   - any proxy rewrite adds x-middleware-rewrite (and x-nextjs-rewritten-path
//     for RSC requests), so non-owners must not be rewritten;
//   - the Auth.js auth() wrapper sets csrf / callback-url cookies (and clears a
//     bad session cookie), so non-owners must not go through it.
// So nothing is routed at /planner. The planner route lives at /owner-planner
// and only the owner is rewritten there; everyone else falls through to the
// normal unmatched-URL 404. scripts/404-parity.test.mjs checks this.
const PUBLIC = "planner";
const INTERNAL = "owner-planner";

/**
 * Splits a raw pathname into its first segment, decoded the way Next decodes
 * it when routing (so /owner%2Dplanner and /%6Fwner-planner count as
 * owner-planner), and the raw rest. A segment that decodes to something with
 * a "/" (e.g. owner-planner%2F) is not that route in Next either.
 */
function splitPath(pathname: string): { first: string | null; rest: string } {
  const slash = pathname.indexOf("/", 1);
  const raw = slash === -1 ? pathname.slice(1) : pathname.slice(1, slash);
  const rest = slash === -1 ? "" : pathname.slice(slash);
  try {
    return { first: decodeURIComponent(raw), rest };
  } catch {
    return { first: null, rest };
  }
}

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Decodes the session JWT without setting any cookies; false on missing or
 * garbage. (getToken also falls back to an `Authorization: Bearer <jwt>`
 * header; that token needs the same AUTH_SECRET and owner id, so it is fine.) Tries both cookie names (https uses the __Secure- one) rather than
 * guessing the protocol behind a proxy; each needs AUTH_SECRET to forge.
 */
async function isOwnerToken(req: NextRequest) {
  for (const cookieName of SESSION_COOKIES) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      cookieName,
      salt: cookieName,
      // A bad token is just "not the owner"; don't log it.
      logger: { error() {}, warn() {}, debug() {} },
    });
    if (token) return token.githubId === OWNER_GITHUB_ID;
  }
  return false;
}

// The owner still goes through auth() so their session cookie is refreshed as
// before. It re-checks the owner itself.
const ownerRewrite = auth((req) => {
  if (req.auth?.user?.githubId !== OWNER_GITHUB_ID) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${INTERNAL}${splitPath(url.pathname).rest}`;
  return NextResponse.rewrite(url);
});

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const { first } = splitPath(req.nextUrl.pathname);
  if (first !== PUBLIC && first !== INTERNAL) return NextResponse.next();
  const isOwner = await isOwnerToken(req);
  if (first === INTERNAL) {
    // Next runs the proxy again on the owner's rewrite destination, so the
    // owner passes here. Anyone else reaching the internal route directly, in
    // any spelling, gets the 404 page. Unlike /planner this response does
    // carry x-middleware-rewrite (any rewrite does); it is not /planner.
    if (isOwner) return NextResponse.next();
    return NextResponse.rewrite(new URL("/__not-found", req.url), { status: 404 });
  }
  if (!isOwner) return NextResponse.next();
  // auth()'s wrapper is typed for route handlers; as proxy it receives the
  // fetch event, which it only passes through to the callback (unused here).
  return ownerRewrite(req, event as unknown as Parameters<typeof ownerRewrite>[1]);
}

export const config = {
  // The literal paths, plus any path with a percent-escape: Next decodes
  // escapes when routing, so /owner%2Dplanner reaches the owner-planner route
  // and must pass through the gate too. proxy() returns next() for anything
  // that is not planner/owner-planner after decoding.
  matcher: [
    "/planner",
    "/planner/:path*",
    "/owner-planner",
    "/owner-planner/:path*",
    "/:path(.*%.*)",
  ],
};
