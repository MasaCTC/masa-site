import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * The only GitHub account allowed to sign in: MasaCTC.
 *
 * We compare the numeric GitHub user id (from https://api.github.com/users/MasaCTC)
 * rather than the login, because a login can be renamed and then reclaimed by
 * someone else, while the numeric id never changes.
 */
export const OWNER_GITHUB_ID = "152247398";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // AUTH_GITHUB_ID, AUTH_GITHUB_SECRET and AUTH_SECRET are read from the env.
  providers: [GitHub],
  session: { strategy: "jwt" },
  // Needed for Vercel preview/production hosts behind a proxy.
  trustHost: true,
  callbacks: {
    // Reject everyone except the owner. `profile.id` is the GitHub numeric id.
    signIn({ profile }) {
      return String(profile?.id ?? "") === OWNER_GITHUB_ID;
    },
    jwt({ token, profile }) {
      if (profile?.id !== undefined) token.githubId = String(profile.id);
      return token;
    },
    session({ session, token }) {
      session.user.githubId =
        typeof token.githubId === "string" ? token.githubId : undefined;
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    githubId?: string;
  }
  interface Session {
    user: { githubId?: string } & import("next-auth").DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    githubId?: string;
  }
}
