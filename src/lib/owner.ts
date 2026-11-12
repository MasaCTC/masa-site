import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth, OWNER_GITHUB_ID } from "@/auth";

/** Returns the signed-in owner's session user, or null for anyone else. */
export async function getOwner() {
  // Auth.js reads the clock (new Date()) before it touches any request API.
  // Under Cache Components that makes Next try to prerender the route and then
  // abort it mid-flight, taking in-flight DB fetches with it. Owner-gated work
  // is request-time only, so say so before auth() runs.
  await connection();
  const session = await auth();
  const user = session?.user;
  return user?.githubId === OWNER_GITHUB_ID ? user : null;
}

/** For pages/layouts: renders a normal 404 for anyone but the owner. */
export async function requireOwner() {
  const owner = await getOwner();
  if (!owner) notFound();
  return owner;
}

export type Unauthorized = { ok: false; error: "unauthorized" };

/**
 * For server actions: call first, before any DB access. Returns the owner or
 * a typed failure to return to the client:
 *   const o = await assertOwner(); if (!o.ok) return o;
 */
export async function assertOwner(): Promise<
  { ok: true; user: NonNullable<Awaited<ReturnType<typeof getOwner>>> } | Unauthorized
> {
  const user = await getOwner();
  return user ? { ok: true, user } : { ok: false, error: "unauthorized" };
}
