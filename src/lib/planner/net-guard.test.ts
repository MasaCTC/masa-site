import { test } from "node:test";
import assert from "node:assert/strict";
import { allPublic, checkFeedUrl, isPublicIp } from "./net-guard.ts";

test("public addresses pass", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "151.101.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isPublicIp(ip), true, ip);
  }
});

test("private, loopback, link-local, metadata and special ranges are blocked", () => {
  for (const ip of [
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254", // cloud metadata
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.10",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "::127.0.0.1", // IPv4-compatible
    "64:ff9b::a9fe:a9fe", // NAT64 of 169.254.169.254
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fec0::1",
    "ff02::1",
    "2001:db8::1",
    "2002:7f00:1::1", // 6to4
    "2001:0:4136:e378::1", // Teredo
    "100::1",
    "fd00:ec2::254", // AWS IPv6 metadata
    "not an ip",
    "",
    "1.2.3",
    "1.2.3.256",
  ]) {
    assert.equal(isPublicIp(ip), false, ip);
  }
});

test("NAT64 and mapped forms of public IPv4 are allowed", () => {
  assert.equal(isPublicIp("::ffff:8.8.8.8"), true);
  assert.equal(isPublicIp("64:ff9b::808:808"), true);
});

test("allPublic needs at least one address and every one public", () => {
  assert.equal(allPublic([]), false);
  assert.equal(allPublic(["8.8.8.8"]), true);
  assert.equal(allPublic(["8.8.8.8", "10.0.0.1"]), false);
});

test("feed URLs: https on 443 with a hostname only", () => {
  assert.equal(checkFeedUrl("https://canvas.eee.uci.edu/feeds/calendars/user_abc.ics").ok, true);
  assert.equal(checkFeedUrl("https://canvas.eee.uci.edu:443/feeds/x.ics").ok, true);
  for (const bad of [
    "http://canvas.eee.uci.edu/feeds/x.ics",
    "ftp://canvas.eee.uci.edu/x",
    "file:///etc/passwd",
    "https://user:pass@canvas.eee.uci.edu/x",
    "https://user@canvas.eee.uci.edu/x",
    "https://canvas.eee.uci.edu:8443/x",
    "https://127.0.0.1/x",
    "https://8.8.8.8/x", // IP literals skip DNS, so all are refused
    "https://[::1]/x",
    "https://[2606:4700::1111]/x",
    "https://0x7f000001/x", // WHATWG URL normalises this to 127.0.0.1
    "https://localhost/x",
    "https://foo.localhost/x",
    "https://metadata.google.internal/x",
    "https://printer.local/x",
    "https://singlelabel/x",
    "not a url",
    "",
  ]) {
    assert.equal(checkFeedUrl(bad).ok, false, bad);
  }
});

test("relative redirect targets resolve against the current URL", () => {
  const r = checkFeedUrl("/feeds/y.ics", "https://canvas.eee.uci.edu/feeds/x.ics");
  assert.equal(r.ok && r.url.href, "https://canvas.eee.uci.edu/feeds/y.ics");
  assert.equal(checkFeedUrl("http://canvas.eee.uci.edu/y", "https://canvas.eee.uci.edu/x").ok, false);
});
