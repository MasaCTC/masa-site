import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidRank, rankBetween, rankSequence } from "./rank.ts";

// Byte-order comparison, i.e. what Postgres does for COLLATE "C".
const cmp = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));

test("between two nulls gives a valid rank", () => {
  const r = rankBetween(null, null);
  assert.ok(isValidRank(r));
});

test("append: result sorts after a", () => {
  let prev = rankBetween(null, null);
  for (let i = 0; i < 500; i++) {
    const next = rankBetween(prev, null);
    assert.ok(isValidRank(next), next);
    assert.equal(cmp(prev, next), -1, `${prev} !< ${next}`);
    prev = next;
  }
  // Appending grows slowly (about one char per 61 appends).
  assert.ok(prev.length <= 12, `append rank too long: ${prev.length}`);
});

test("prepend: result sorts before b", () => {
  let prev = rankBetween(null, null);
  for (let i = 0; i < 500; i++) {
    const next = rankBetween(null, prev);
    assert.ok(isValidRank(next), next);
    assert.equal(cmp(next, prev), -1, `${next} !< ${prev}`);
    prev = next;
  }
  assert.ok(prev.length <= 12, `prepend rank too long: ${prev.length}`);
});

test("between a and b is strictly inside", () => {
  const a = rankBetween(null, null);
  const b = rankBetween(a, null);
  let lo = a;
  for (let i = 0; i < 50; i++) {
    const m = rankBetween(lo, b);
    assert.equal(cmp(lo, m), -1);
    assert.equal(cmp(m, b), -1);
    lo = m;
  }
});

test("1000 random inserts keep strict byte ordering and no equal ranks", () => {
  // Deterministic PRNG so failures are reproducible.
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const list: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const pos = Math.floor(rand() * (list.length + 1));
    const before = pos > 0 ? list[pos - 1] : null;
    const after = pos < list.length ? list[pos] : null;
    const r = rankBetween(before, after);
    assert.ok(isValidRank(r), r);
    list.splice(pos, 0, r);
  }
  for (let i = 1; i < list.length; i++) {
    assert.equal(cmp(list[i - 1], list[i]), -1, `${list[i - 1]} !< ${list[i]}`);
  }
  assert.equal(new Set(list).size, list.length);
  // Sorting by bytes reproduces insertion order.
  assert.deepEqual([...list].sort(cmp), list);
});

test("rejects invalid input instead of producing a bad rank", () => {
  const a = rankBetween(null, null);
  assert.throws(() => rankBetween(a, a));
  assert.throws(() => rankBetween(rankBetween(a, null), a));
  assert.throws(() => rankBetween("V0", null)); // trailing zero
  assert.throws(() => rankBetween("", null)); // empty
  assert.throws(() => rankBetween("a-b", null)); // not base-62
});

test("isValidRank", () => {
  assert.ok(isValidRank("V"));
  assert.ok(isValidRank("0V"));
  assert.ok(!isValidRank(""));
  assert.ok(!isValidRank("V0"));
  assert.ok(!isValidRank("é"));
});

test("rankSequence gives n evenly spread, strictly increasing, valid ranks", () => {
  for (const n of [0, 1, 2, 61, 62, 63, 1000, 5000]) {
    const seq = rankSequence(n);
    assert.equal(seq.length, n);
    for (const r of seq) assert.ok(isValidRank(r), r);
    for (let i = 1; i < seq.length; i++) assert.equal(cmp(seq[i - 1], seq[i]), -1);
    if (n > 0) assert.ok(seq[n - 1].length <= Math.ceil(Math.log(n + 1) / Math.log(62)) + 1);
  }
});
