import { test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { placeMoved, rebalanceSql } from "./ranks-plan.ts";

const render = (q: ReturnType<typeof rebalanceSql>) => new PgDialect().sqlToQuery(q);

test("rebalance SQL without a moved task never touches hand_edited", () => {
  const { sql, params } = render(rebalanceSql(["a", "b"], ["F", "V"], null));
  assert.doesNotMatch(sql, /hand_edited/);
  assert.doesNotMatch(sql, /NULL/i);
  assert.deepEqual(params, ["a", "F", "b", "V"]);
});

test("rebalance SQL with a moved task marks only that canvas row", () => {
  const { sql, params } = render(rebalanceSql(["a", "b"], ["F", "V"], "b"));
  assert.match(sql, /hand_edited = tasks\.hand_edited OR \(tasks\.id = \$1::uuid AND tasks\.source = 'canvas'\)/);
  assert.deepEqual(params, ["b", "a", "F", "b", "V"]);
});

test("placeMoved puts the task after beforeId or before afterId", () => {
  const ids = ["a", "b", "c", "m"];
  assert.deepEqual(placeMoved(ids, { id: "m", beforeId: "a", afterId: "b" }), ["a", "m", "b", "c"]);
  assert.deepEqual(placeMoved(ids, { id: "m", beforeId: null, afterId: "a" }), ["m", "a", "b", "c"]);
  assert.deepEqual(placeMoved(ids, { id: "a", beforeId: "m", afterId: null }), ["b", "c", "m", "a"]);
});

test("placeMoved returns null when the anchor or moved task is gone (stale)", () => {
  const ids = ["a", "b", "c"];
  assert.equal(placeMoved(ids, { id: "a", beforeId: "zz", afterId: null }), null);
  assert.equal(placeMoved(ids, { id: "a", beforeId: null, afterId: "zz" }), null);
  assert.equal(placeMoved(ids, { id: "zz", beforeId: "a", afterId: null }), null);
});
