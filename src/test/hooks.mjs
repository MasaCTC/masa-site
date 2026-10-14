// Test-only module resolution (registered by ./register.mjs; never part of
// the app build). It does three things Next.js normally does for us:
//   - "@/x" resolves to src/x(.ts|.tsx|/index.ts);
//   - extensionless relative imports inside src/ get their .ts extension;
//   - modules that need the Next runtime, auth or the live database resolve
//     to the stubs in ./stubs/ instead. In particular "@/db" is ALWAYS the
//     recording fake, so no test can reach the real (Neon) database.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../", import.meta.url);
const STUBS = new URL("./stubs/", import.meta.url);

const STUBBED = {
  "server-only": "server-only.ts",
  "next/cache": "next-cache.ts",
  "next/navigation": "next-navigation.ts",
  "next/server": "next-server.ts",
  "@/auth": "auth.ts",
  "@/db": "db.ts",
  "@/db/index": "db.ts",
};

function withTsExtension(base) {
  for (const suffix of [".ts", ".tsx", "/index.ts"]) {
    const url = new URL(base + suffix);
    if (existsSync(fileURLToPath(url))) return url.href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(STUBBED, specifier)) {
    return { url: new URL(STUBBED[specifier], STUBS).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const url = withTsExtension(new URL(specifier.slice(2), SRC).href);
    if (url) return { url, shortCircuit: true };
  }
  const parent = context.parentURL;
  if (
    parent?.startsWith(SRC.href) &&
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[cm]?[jt]sx?$/.test(specifier)
  ) {
    const url = withTsExtension(new URL(specifier, parent).href);
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
