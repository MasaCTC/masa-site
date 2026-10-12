// Lint-style guard: every exported server action must start with the owner
// check, before parsing input or touching the DB. Server actions are POST
// endpoints anyone can call, so this check (not the page) is the real gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

test('actions.ts is a "use server" module importing assertOwner', () => {
  assert.match(src, /^"use server";\n/);
  assert.match(src, /import \{ assertOwner \} from "@\/lib\/owner";/);
});

test("the only exports are async functions", () => {
  const exportsAll = src.match(/^export\b.*$/gm) ?? [];
  const fns = exportsAll.filter((l) => /^export async function \w+\(/.test(l));
  assert.ok(fns.length >= 11, `expected at least 11 actions, found ${fns.length}`);
  assert.deepEqual(
    exportsAll.filter((l) => !fns.includes(l)),
    [],
    "non-function export in a 'use server' file",
  );
});

test("every exported action begins with assertOwner and returns on failure", () => {
  const re = /^export async function (\w+)\(([^)]*)\)(?::\s*Promise<[^{]*>)?\s*\{\n([\s\S]*?)\n\}/gm;
  const names: string[] = [];
  for (const m of src.matchAll(re)) {
    const [, name, , body] = m;
    names.push(name);
    const lines = body.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"));
    assert.equal(lines[0], "const owner = await assertOwner();", `${name}: first statement`);
    assert.equal(lines[1], "if (!owner.ok) return owner;", `${name}: second statement`);
  }
  const exported = (src.match(/^export async function \w+/gm) ?? []).length;
  assert.equal(names.length, exported, "could not parse every exported action");
});
