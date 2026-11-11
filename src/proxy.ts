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
const PUBLIC = "/planner";
const INTERNAL = "/owner-planner";

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Decodes the session JWT without setting any cookies; false on missing or
 * garbage. Tries both cookie names (https uses the __Secure- one) rather than
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
  url.pathname = INTERNAL + url.pathname.slice(PUBLIC.length);
  return NextResponse.rewrite(url);
});

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const isOwner = await isOwnerToken(req);
  const { pathname } = req.nextUrl;
  if (pathname === INTERNAL || pathname.startsWith(INTERNAL + "/")) {
    // Next runs the proxy again on the owner's rewrite destination, so the
    // owner passes here. Anyone else hitting the internal path directly gets
    // the 404 page (this one does carry rewrite headers; it is not /planner).
    if (isOwner) return NextResponse.next();
    return NextResponse.rewrite(new URL("/__not-found", req.url), { status: 404 });
  }
  if (!isOwner) return NextResponse.next();
  // auth()'s wrapper is typed for route handlers; as proxy it receives the
  // fetch event, which it only passes through to the callback (unused here).
  return ownerRewrite(req, event as unknown as Parameters<typeof ownerRewrite>[1]);
}

export const config = {
  matcher: ["/planner", "/planner/:path*", "/owner-planner", "/owner-planner/:path*"],
};
