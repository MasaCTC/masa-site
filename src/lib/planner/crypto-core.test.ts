import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptString, encryptString, loadKey } from "./crypto-core.ts";

const keyB64 = randomBytes(32).toString("base64");
const key = loadKey(keyB64);
const URL_ = "https://canvas.example.edu/feeds/calendars/user_abc123.ics";

test("round trip", () => {
  const enc = encryptString(URL_, key);
  assert.ok(enc.startsWith("v1:"));
  assert.ok(!enc.includes("canvas.example.edu"));
  assert.equal(decryptString(enc, key), URL_);
});

test("fresh IV per encryption", () => {
  assert.notEqual(encryptString(URL_, key), encryptString(URL_, key));
});

test("tamper detection", () => {
  const enc = encryptString(URL_, key);
  const raw = Buffer.from(enc.slice(3), "base64");
  for (const i of [0, 12, 28, raw.length - 1]) {
    const t = Buffer.from(raw);
    t[i] ^= 0x01;
    assert.throws(() => decryptString("v1:" + t.toString("base64"), key));
  }
  assert.throws(() => decryptString("v2:" + enc.slice(3), key));
  assert.throws(() => decryptString("v1:AAAA", key));
  assert.throws(() => decryptString("garbage", key));
});

test("wrong key fails", () => {
  const enc = encryptString(URL_, key);
  const other = loadKey(randomBytes(32).toString("base64"));
  assert.throws(() => decryptString(enc, other));
});

test("missing or malformed key fails closed", () => {
  assert.throws(() => loadKey(undefined));
  assert.throws(() => loadKey(""));
  assert.throws(() => loadKey(randomBytes(16).toString("base64")));
  assert.throws(() => loadKey(randomBytes(33).toString("base64")));
  assert.throws(() => loadKey("not base64 at all!!"));
});

test("errors never contain the key or plaintext", () => {
  try {
    loadKey(randomBytes(16).toString("base64") + "x");
  } catch (e) {
    assert.ok(!String((e as Error).message).match(/[A-Za-z0-9+/]{20,}/));
  }
  const enc = encryptString(URL_, key);
  const other = loadKey(randomBytes(32).toString("base64"));
  try {
    decryptString(enc, other);
  } catch (e) {
    assert.ok(!String((e as Error).message).includes("canvas"));
  }
});
