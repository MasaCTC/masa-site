import { test } from "node:test";
import assert from "node:assert/strict";
import { chartEmptyText, STATS_COPY } from "./site.ts";

test("chartEmptyText: live source says follower history isn't tracked", () => {
  assert.equal(chartEmptyText("instagram-api"), "Follower history isn't tracked yet");
});

test("chartEmptyText: manual source keeps STATS_COPY.chartEmpty", () => {
  assert.equal(chartEmptyText("manual"), STATS_COPY.chartEmpty);
  assert.equal(STATS_COPY.chartEmpty, "Not enough history yet. Growth shows after 2 days of snapshots.");
});
