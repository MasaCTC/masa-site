import { NextResponse } from "next/server";
import { auth, OWNER_GITHUB_ID } from "@/auth";

// Streaming pages start with a 200 status, so a notFound() inside a page
// can't produce a real 404 under Cache Components. This runs before render:
// anyone but the owner gets a rewrite to a path that doesn't exist, which
// serves the normal 404 page (identical to any unknown URL). The page and
// every server action still check the owner themselves (defense in depth).
export const proxy = auth((req) => {
  if (req.auth?.user?.githubId === OWNER_GITHUB_ID) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__not-found", req.url), { status: 404 });
});

export const config = {
  matcher: ["/planner", "/planner/:path*"],
};
