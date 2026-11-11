const FALLBACK = "https://masa-site-nine.vercel.app";

type Env = Record<string, string | undefined>;

/** Absolute origin of this deployment: previews point at themselves, production at the prod domain. */
export function siteUrl(env: Env = process.env): string {
  if (env.VERCEL_ENV === "preview") {
    const host = env.VERCEL_BRANCH_URL ?? env.VERCEL_URL;
    if (host) return `https://${host}`;
    return FALLBACK;
  }
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return FALLBACK;
}
