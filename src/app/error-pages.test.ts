// The error pages must never show or log error details to visitors: no .message,
// .stack, console.* or digest in the three client files, and the section 4 copy is intact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FILES = ["(site)/error.tsx", "error.tsx", "global-error.tsx"];
const HEADING = "Something broke on my end.";
const BODY =
  "Not your fault. Try again, and if it keeps happening, the home page still works.";

for (const file of FILES) {
  test(`${file} exists with the verbatim copy`, () => {
    const src = readFileSync(join(here, file), "utf8");
    assert.ok(src.includes(HEADING), "heading");
    assert.ok(src.includes(BODY), "body");
    assert.ok(src.includes("Try again"), "Try again button");
    assert.ok(src.includes("Go home"), "Go home link");
  });

  test(`${file} never touches error details`, () => {
    const src = readFileSync(join(here, file), "utf8");
    for (const banned of [".message", ".stack", "console.", "digest"]) {
      assert.ok(!src.includes(banned), `${file} contains ${banned}`);
    }
  });
}
