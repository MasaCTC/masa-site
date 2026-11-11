import { test } from "node:test";
import assert from "node:assert/strict";
import { siteUrl } from "./site-url.ts";

const FALLBACK = "https://masa-site-nine.vercel.app";

test("preview uses the branch url", () => {
  assert.equal(
    siteUrl({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "b.vercel.app", VERCEL_URL: "d.vercel.app" }),
    "https://b.vercel.app",
  );
});

test("preview falls back to the deployment url", () => {
  assert.equal(siteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "d.vercel.app" }), "https://d.vercel.app");
});

test("preview with no urls falls back to the default", () => {
  assert.equal(siteUrl({ VERCEL_ENV: "preview" }), FALLBACK);
});

test("production uses the production url", () => {
  assert.equal(
    siteUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "masa.dev", VERCEL_URL: "d.vercel.app" }),
    "https://masa.dev",
  );
});

test("preview ignores the production url", () => {
  assert.equal(
    siteUrl({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "b.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "masa.dev" }),
    "https://b.vercel.app",
  );
});

test("local dev falls back to the default", () => {
  assert.equal(siteUrl({}), FALLBACK);
});
