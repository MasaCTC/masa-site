import { test } from "node:test";
import assert from "node:assert/strict";
import { CanvasFeedError, parseCanvasFeed, splitSummary } from "./canvas-parse.ts";

// A realistic Canvas calendar feed: CRLF line endings, a folded SUMMARY,
// all-day and UTC datetime DTSTARTs, a generic calendar event, a duplicate UID.
const CRLF = "\r\n";
const feed = (events: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Instructure//Canvas//EN",
    "X-WR-CALNAME:Masa Chien Calendar (Canvas)",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
    "",
  ].join(CRLF);

const ev = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join(CRLF);

const FIXTURE = feed([
  // All-day assignment (date only).
  ev([
    "DTSTAMP:20261012T170000Z",
    "UID:event-assignment-1001",
    "DTSTART;VALUE=DATE:20261013",
    "DTEND;VALUE=DATE:20261013",
    "CLASS:PUBLIC",
    "DESCRIPTION:Implement AVL insert.\\nSubmit on Gradescope.",
    "LOCATION:",
    "SEQUENCE:0",
    "SUMMARY:Project 2: AVL tree insert + tests [ICS 46 FALL 2026]",
    "URL;VALUE=URI:https://canvas.eee.uci.edu/courses/123/assignments/1001",
    "X-ALT-DESC;FMTTYPE=text/html:<p>Implement AVL insert.</p>",
  ]),
  // Due 11:59 pm Pacific, given in UTC: 2026-10-15 06:59Z is still Oct 14 in LA.
  ev([
    "UID:event-assignment-1002",
    "DTSTART:20261015T065900Z",
    "DTEND:20261015T065900Z",
    // Folded line (RFC 5545: CRLF + one space continues the previous line).
    "SUMMARY:Lab 3 prelab (MIPS loops) [ICS 51 LEC A: INTRO COMPUTER ORGANIZ",
    " ATION]",
    "URL;VALUE=URI:https://canvas.eee.uci.edu/courses/456/assignments/1002",
  ]),
  // No URL, brackets inside the title.
  ev([
    "UID:event-assignment-1003",
    "DTSTART:20261016T190000Z",
    "SUMMARY:Read [ch. 6] + annotate [WRITING 39C]",
  ]),
  // A generic calendar event: skipped.
  ev([
    "UID:event-calendar-event-77",
    "DTSTART:20261016T200000Z",
    "SUMMARY:Office hours [ICS 46 FALL 2026]",
  ]),
  // Duplicate UID: the first occurrence wins.
  ev([
    "UID:event-assignment-1001",
    "DTSTART;VALUE=DATE:20261020",
    "SUMMARY:Duplicate [ICS 46 FALL 2026]",
  ]),
  // No course in brackets, javascript: URL, no date.
  ev([
    "UID:event-assignment-1004",
    "SUMMARY:  Personal   checklist  ",
    "URL:javascript:alert(1)",
  ]),
]);

test("parses Canvas assignments, skipping calendar events and duplicate UIDs", () => {
  const out = parseCanvasFeed(FIXTURE);
  assert.deepEqual(
    out.map((a) => a.uid),
    ["event-assignment-1001", "event-assignment-1002", "event-assignment-1003", "event-assignment-1004"],
  );
});

test("an all-day DTSTART is the due date as written", () => {
  const [a] = parseCanvasFeed(FIXTURE);
  assert.equal(a.dueDate, "2026-10-13");
  assert.equal(a.title, "Project 2: AVL tree insert + tests");
  assert.equal(a.courseCode, "ICS 46 FALL 2026");
  assert.equal(a.url, "https://canvas.eee.uci.edu/courses/123/assignments/1001");
});

test("a UTC datetime becomes the planner-timezone date; folded lines are joined", () => {
  const a = parseCanvasFeed(FIXTURE)[1];
  assert.equal(a.dueDate, "2026-10-14");
  assert.equal(a.title, "Lab 3 prelab (MIPS loops)");
  assert.equal(a.courseCode, "ICS 51 LEC A: INTRO COMPUTER ORGANIZATION");
});

test("missing URL is null; only the trailing bracket is the course", () => {
  const a = parseCanvasFeed(FIXTURE)[2];
  assert.equal(a.url, null);
  assert.equal(a.title, "Read [ch. 6] + annotate");
  assert.equal(a.courseCode, "WRITING 39C");
  assert.equal(a.dueDate, "2026-10-16");
});

test("no brackets: no course; whitespace collapsed; non-http URLs dropped; no date is null", () => {
  const a = parseCanvasFeed(FIXTURE)[3];
  assert.equal(a.title, "Personal checklist");
  assert.equal(a.courseCode, null);
  assert.equal(a.url, null);
  assert.equal(a.dueDate, null);
});

test("floating and TZID datetimes", () => {
  const out = parseCanvasFeed(
    feed([
      // Floating: wall time, read as planner-local.
      ev(["UID:event-assignment-1", "DTSTART:20261014T235900", "SUMMARY:A [X 1]"]),
      // TZID without a VTIMEZONE: 01:00 New York = Oct 13 22:00 in LA.
      ev(["UID:event-assignment-2", "DTSTART;TZID=America/New_York:20261014T010000", "SUMMARY:B [X 1]"]),
      // Unknown TZID: fall back to the wall date.
      ev(["UID:event-assignment-3", "DTSTART;TZID=Mars/Olympus:20261014T010000", "SUMMARY:C [X 1]"]),
    ]),
  );
  assert.deepEqual(
    out.map((a) => a.dueDate),
    ["2026-10-14", "2026-10-13", "2026-10-14"],
  );
});

test("LF-only line endings parse too", () => {
  const out = parseCanvasFeed(FIXTURE.replaceAll("\r\n", "\n"));
  assert.equal(out.length, 4);
});

test("titles that are only a bracket, and long values, are bounded", () => {
  const long = "x".repeat(400);
  const out = parseCanvasFeed(
    feed([
      ev(["UID:event-assignment-1", "DTSTART;VALUE=DATE:20261013", "SUMMARY:[ICS 46]"]),
      ev(["UID:event-assignment-2", "DTSTART;VALUE=DATE:20261013", `SUMMARY:${long} [${"C".repeat(300)}]`]),
    ]),
  );
  assert.equal(out[0].title, "Untitled assignment");
  assert.equal(out[0].courseCode, "ICS 46");
  assert.equal(out[1].title.length, 300);
  assert.equal(out[1].courseCode!.length, 200);
});

test("an empty calendar is zero assignments, not an error", () => {
  assert.deepEqual(parseCanvasFeed(feed([])), []);
});

test("non-calendar text throws not_ics without echoing the input", () => {
  for (const bad of ["<html>Sign in</html>", "", "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n:::bad"]) {
    assert.throws(
      () => parseCanvasFeed(bad),
      (e: unknown) => e instanceof CanvasFeedError && e.reason === "not_ics" && !e.message.includes("bad"),
    );
  }
});

test("splitSummary", () => {
  assert.deepEqual(splitSummary("HW 3 [ICS 31 FALL 2026]"), { title: "HW 3", courseCode: "ICS 31 FALL 2026" });
  assert.deepEqual(splitSummary("HW [3]   [  ICS  31 ]  "), { title: "HW [3]", courseCode: "ICS 31" });
  assert.deepEqual(splitSummary("HW 3 [ICS 31"), { title: "HW 3 [ICS 31", courseCode: null });
  assert.deepEqual(splitSummary("HW 3 []"), { title: "HW 3 []", courseCode: null });
});
