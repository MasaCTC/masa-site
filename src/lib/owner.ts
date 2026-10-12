import "server-only";
import { notFound } from "next/navigation";
import { auth, OWNER_GITHUB_ID } from "@/auth";

/** Returns the signed-in owner's session user, or null for anyone else. */
export async function getOwner() {
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
