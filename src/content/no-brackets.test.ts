import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as projects from "./projects.ts";
import * as site from "./site.ts";
import { COFURA, ONE_BASKET, PROJECTS, PULLPILOT, rightNow } from "./projects.ts";

/** A bracketed ALL-CAPS token such as [SCREEN 1] or [PLACEHOLDER]. At least two characters, so [A-Z] (a regex class) and x[i] never match. */
export const PLACEHOLDER = /\[[A-Z][A-Z0-9 _]+\]/;
/** A string that is nothing but a bracketed token, e.g. "[Screenshot coming soon]". */
export const WHOLLY_BRACKETED = /^\s*\[[A-Za-z0-9 ,.!?'’…]+\]\s*$/;

export function isPlaceholder(s: string): boolean {
  return PLACEHOLDER.test(s) || WHOLLY_BRACKETED.test(s);
}

/** Every string in every exported value, getters included (e.g. PROJECTS_PAGE.eyebrow). Functions are skipped. */
function walk(v: unknown, path: string, out: [string, string][], seen = new Set<unknown>()): void {
  if (typeof v === "string") out.push([path, v]);
  else if (v && typeof v === "object") {
    if (seen.has(v)) return;
    seen.add(v);
    for (const k of Reflect.ownKeys(v)) {
      if (typeof k === "symbol") continue;
      walk((v as Record<string, unknown>)[k], `${path}.${k}`, out, seen);
    }
  }
}

function exportedStrings(mod: Record<string, unknown>, name: string): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(mod)) walk(v, `${name}.${k}`, out);
  return out;
}

test("placeholder detector: flags bracketed tokens, ignores normal text", () => {
  for (const bad of ["[SCREEN 1]", "Shot [SCREEN 2] here", "[Screenshot coming soon]", "  [TODO] "]) {
    assert.equal(isPlaceholder(bad), true, bad);
  }
  for (const ok of ["1 building · 1 paused", "arr[i]", "[aria-current=\"page\"]", "a [b] c", "Mar 2028", ""]) {
    assert.equal(isPlaceholder(ok), false, ok);
  }
});

for (const [name, mod] of [
  ["projects.ts", projects],
  ["site.ts", site],
] as const) {
  test(`no bracket placeholder in any exported string of ${name}`, () => {
    const all = exportedStrings(mod as Record<string, unknown>, name);
    assert.ok(all.length > 20, "walked a real amount of content");
    assert.deepEqual(all.filter(([, s]) => isPlaceholder(s)), []);
  });
}

test("the walk reaches getters (PROJECTS_PAGE.eyebrow)", () => {
  const all = exportedStrings(projects, "projects.ts");
  assert.ok(all.some(([p]) => p === "projects.ts.PROJECTS_PAGE.eyebrow"));
});

// ---- source scan ----

function listFiles(dir: string, filter: (f: string) => boolean, recurse = true): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (recurse) out.push(...listFiles(p, filter));
    } else if (filter(p)) out.push(p);
  }
  return out;
}

const tsx = (f: string) => f.endsWith(".tsx");
const SOURCES = [
  ...listFiles("src/app/(site)", tsx),
  ...listFiles("src/components", tsx),
  ...listFiles("src/app", tsx, false), // not-found, error, global-error, layout
];

/**
 * Visitor-visible literals in a .tsx file: string literals and JSX text.
 * A small lexer skips comments and consumes strings, so arrays, indexing, regexes and
 * ${} expressions in template literals are never mistaken for text.
 */
export function visibleLiterals(src: string): string[] {
  const out: string[] = [];
  const jsxText: string[] = [];
  let code = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      let s = "";
      while (j < n && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") { s += src[j + 1] ?? ""; j += 2; } else s += src[j++];
      }
      out.push(s);
      code += '""';
      i = j + 1;
    } else if (c === "`") {
      let j = i + 1;
      let s = "";
      let depth = 0;
      while (j < n && !(src[j] === "`" && depth === 0)) {
        if (src[j] === "\\") { s += src[j + 1] ?? ""; j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") { depth++; s += " "; j += 2; continue; }
        if (depth > 0 && src[j] === "}") { depth--; j++; continue; }
        if (depth === 0) s += src[j];
        j++;
      }
      out.push(s);
      code += '""';
      i = j + 1;
    } else {
      code += c;
      i++;
    }
  }
  // JSX text: between a tag's ">" and the next "<" or "{", on code with strings blanked out.
  const re = />([^<>{}=;()]*)(?=[<{])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) jsxText.push(m[1]);
  return [...out, ...jsxText];
}

test("scan: source set is non-empty and the lexer reads literals and JSX text", () => {
  assert.ok(SOURCES.length > 20);
  assert.ok(SOURCES.some((f) => f.endsWith("not-found.tsx")));
  const lits = visibleLiterals(`const a = x[0]; const r = /[A-Z]+/; // [NOTE]\nconst b = ["a", 'b [Q]']; const t = \`c \${y[ID]} d\`;\nconst e = <p className={s.x}>Hello [SCREEN 1]</p>;`);
  assert.ok(lits.includes("b [Q]"));
  assert.ok(lits.some((l) => l.includes("[SCREEN 1]")));
  assert.equal(lits.some((l) => l.includes("[NOTE]") || l.includes("[ID]")), false);
});

test("scan: no bracket placeholder literal or JSX text in site, component or error-page source", () => {
  const bad: string[] = [];
  for (const f of SOURCES) {
    for (const lit of visibleLiterals(readFileSync(f, "utf8"))) {
      if (isPlaceholder(lit)) bad.push(`${f}: ${lit.trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});

// ---- paused never in Right now ----

const texts = (rows: ReturnType<typeof rightNow>) => rows.map((r) => r.text).join("\n");

test("Right now never lists a paused or dead project (real data)", () => {
  const out = texts(rightNow(PROJECTS));
  for (const p of PROJECTS.filter((p) => p.status === "paused" || p.status === "dead")) {
    assert.equal(out.includes(p.name), false, `${p.name} (${p.status}) must not appear`);
  }
  assert.equal(ONE_BASKET.status, "paused");
  assert.equal(out.includes("One Basket"), false);
});

test("Right now never lists a paused project (fixture, every status)", () => {
  // Give every fixture project a row naming it, so an accidental inclusion would be visible.
  const row = (name: string) => [{ text: `Working on ${name}`, kind: "status" as const, status: "building" as const, statusLabel: "Building" }];
  const make = (status: "building" | "paused" | "dead") =>
    [COFURA, ONE_BASKET, PULLPILOT].map((p) => ({ ...p, status, rightNow: row(p.name) }));
  for (const status of ["paused", "dead"] as const) {
    const out = texts(rightNow(make(status)));
    for (const p of make(status)) assert.equal(out.includes(p.name), false, `${p.name} (${status})`);
  }
  // Control: the same fixture, active, does list them (the test can fail).
  const active = texts(rightNow(make("building")));
  for (const p of make("building")) assert.equal(active.includes(p.name), true, `${p.name} (building)`);
  // Mixed: only the paused one is dropped.
  const mixed = [{ ...make("building")[0] }, { ...make("paused")[1] }];
  assert.deepEqual(texts(rightNow(mixed)).includes("One Basket"), false);
  assert.deepEqual(texts(rightNow(mixed)).includes("Cofura"), true);
});

test("Home builds Right now from rightNow(...), not hardcoded rows", () => {
  const src = readFileSync("src/app/(site)/page.tsx", "utf8");
  assert.match(src, /rightNow\(PROJECTS\)\.map\(/);
  assert.match(src, /import\s*\{[^}]*\brightNow\b[^}]*\}\s*from\s*"@\/content\/projects"/);
  const lits = visibleLiterals(src).join("\n");
  assert.equal(/Building Cofura|One Basket|on TestFlight/.test(lits), false, "no hardcoded project rows in Home");
});
