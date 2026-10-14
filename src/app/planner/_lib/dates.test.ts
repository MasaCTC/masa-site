import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, addMonths, dayDiff, dueLabel, fmtMinutes, monthGrid, weekStart } from "./dates.ts";

test("day math is date-only and crosses months/DST safely", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-11-01", 1), "2026-11-02"); // US DST ends Nov 1
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(dayDiff("2026-10-12", "2026-10-27"), 15);
  assert.equal(dayDiff("2026-10-12", "2026-10-11"), -1);
});

test("weeks start on Sunday", () => {
  assert.equal(weekStart("2026-10-11"), "2026-10-11"); // Sunday anchors to itself
  assert.equal(weekStart("2026-10-17"), "2026-10-11"); // Saturday is the last day of that week
  assert.equal(weekStart("2026-10-12"), "2026-10-11"); // Monday
  assert.equal(weekStart("2026-11-01"), "2026-11-01"); // Sunday, month boundary
  assert.equal(weekStart("2026-08-01"), "2026-07-26"); // Saturday, crosses into July
  assert.equal(addDays(weekStart("2026-10-17"), 6), "2026-10-17");
});

test("months step to the 1st and cross years", () => {
  assert.equal(addMonths("2026-10-12", 1), "2026-11-01");
  assert.equal(addMonths("2026-12-31", 1), "2027-01-01");
  assert.equal(addMonths("2026-01-31", -1), "2025-12-01");
});

test("month grid is Sunday-first, 5 or 6 weeks", () => {
  const oct = monthGrid("2026-10-12"); // Oct 1 2026 is a Thursday
  assert.equal(oct[0], "2026-09-27");
  assert.equal(oct.length, 35);
  const nov = monthGrid("2026-11-15"); // Nov 1 2026 is a Sunday: no leading days
  assert.equal(nov[0], "2026-11-01");
  assert.equal(nov.length, 35);
  assert.equal(nov[34], "2026-12-05");
  const aug = monthGrid("2026-08-01"); // Aug 1 2026 is a Saturday, 31 days
  assert.equal(aug[0], "2026-07-26");
  assert.equal(aug.length, 42);
  assert.equal(aug[41], "2026-09-05");
  for (const g of [oct, nov, aug]) assert.equal(new Date(g[0] + "T00:00:00Z").getUTCDay(), 0);
});

test("due labels match the prototype", () => {
  const t = "2026-10-12";
  assert.equal(dueLabel("2026-10-12", t), "due today");
  assert.equal(dueLabel("2026-10-13", t), "due tomorrow");
  assert.equal(dueLabel("2026-10-14", t), "due Wed");
  assert.equal(dueLabel("2026-10-27", t), "due Oct 27");
  assert.equal(dueLabel("2026-10-10", t), "due Oct 10");
});

test("minutes format like the prototype, blank when unset", () => {
  assert.equal(fmtMinutes(90), "1h 30m");
  assert.equal(fmtMinutes(60), "1h");
  assert.equal(fmtMinutes(15), "15m");
  assert.equal(fmtMinutes(0), "");
  assert.equal(fmtMinutes(null), "");
});
