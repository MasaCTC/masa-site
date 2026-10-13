// Test stub for "@/auth" (see src/test/hooks.mjs). The real module boots
// next-auth; tests only need the session lookup. OWNER_GITHUB_ID must match
// src/auth.ts (checked by actions-auth.test.ts).
export const OWNER_GITHUB_ID = "152247398";

type Session = { user: { githubId?: string; name?: string | null } } | null;

let session: Session = null;

/** Sets what auth() returns for the following calls. */
export function setSession(s: Session) {
  session = s;
}

export async function auth(): Promise<Session> {
  return session;
}
