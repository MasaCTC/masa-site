import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import { allPublic, checkFeedUrl } from "./net-guard";
import type { SyncFailReason } from "./canvas-sync-types";

// Server-side fetch of the owner's Canvas feed, with SSRF limits:
// - https on 443 to a DNS hostname only (checkFeedUrl), re-checked on every
//   redirect, at most MAX_REDIRECTS hops;
// - every DNS answer must be public, checked in the socket's own lookup, so
//   the address that is validated is the address that is connected to (no
//   rebinding window between a check and a second resolution);
// - one deadline for the whole fetch, a streamed size cap, and the body must
//   start with BEGIN:VCALENDAR.
// Never log or rethrow the URL, the response body or a system error message
// (DNS errors contain the hostname): failures are reduced to a reason code.

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export class FeedFetchError extends Error {
  // Plain fields, not parameter properties: node:test's type stripping
  // can't load those (the actions tests import this module).
  readonly reason: SyncFailReason;
  readonly httpStatus?: number;
  constructor(reason: SyncFailReason, httpStatus?: number) {
    super(`Canvas feed fetch failed: ${reason}`);
    this.name = "FeedFetchError";
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}

const BLOCKED = "EPLANNERBLOCKED";

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, family: options.family, hints: options.hints }, (err, addrs: LookupAddress[]) => {
    if (err) return callback(err, "", 0);
    if (!allPublic(addrs.map((a) => a.address))) {
      const e = Object.assign(new Error("blocked address"), { code: BLOCKED }) as NodeJS.ErrnoException;
      return callback(e, "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addrs);
    callback(null, addrs[0].address, addrs[0].family);
  });
};

type Hop = { status: number; location?: string; body?: Buffer };

function getOnce(url: URL, signal: AbortSignal): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        agent: false,
        signal,
        // No Accept-Encoding: Node does not decompress, and identity keeps the size cap honest.
        headers: { accept: "text/calendar, text/plain;q=0.5, */*;q=0.1", "user-agent": "masa-site-planner/1" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          // destroy, not resume: nothing is read past the headers, so a hostile
          // server cannot keep streaming a body after the deadline timer is cleared.
          res.destroy();
          return resolve({ status, location: res.headers.location });
        }
        if (status < 200 || status >= 300) {
          res.destroy();
          return resolve({ status });
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > MAX_BYTES) {
          res.destroy();
          return reject(new FeedFetchError("too_large"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new FeedFetchError("too_large"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function reasonOf(err: unknown, signal: AbortSignal): FeedFetchError {
  if (err instanceof FeedFetchError) return err;
  if (signal.aborted) return new FeedFetchError("timeout");
  const code = (err as NodeJS.ErrnoException | null)?.code;
  if (code === BLOCKED) return new FeedFetchError("blocked");
  return new FeedFetchError("network");
}

/** Fetches the feed text. Throws FeedFetchError (reason code only) on any failure. */
export async function fetchFeedText(feedUrl: string): Promise<string> {
  const first = checkFeedUrl(feedUrl);
  if (!first.ok) throw new FeedFetchError("blocked");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    let url = first.url;
    for (let hop = 0; ; hop++) {
      let res: Hop;
      try {
        res = await getOnce(url, ac.signal);
      } catch (err) {
        throw reasonOf(err, ac.signal);
      }
      if (res.status >= 300 && res.status < 400) {
        if (hop >= MAX_REDIRECTS || !res.location) throw new FeedFetchError("redirects");
        const next = checkFeedUrl(res.location, url.href);
        if (!next.ok) throw new FeedFetchError("blocked");
        url = next.url;
        continue;
      }
      if (!res.body) throw new FeedFetchError("http", res.status);
      const text = new TextDecoder("utf-8").decode(res.body);
      if (!/^﻿?\s*BEGIN:VCALENDAR/i.test(text)) throw new FeedFetchError("not_ics");
      return text;
    }
  } finally {
    clearTimeout(timer);
  }
}
