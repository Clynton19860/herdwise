import { test } from "node:test";
import assert from "node:assert/strict";

const { formatDateTime, formatShortDateTime, formatWeekday, TZ } =
  await import("../lib/time.ts");

/**
 * The bug these guard against: a date formatted with no timezone takes whichever
 * clock is nearest, so the same instant reads differently on the server and in
 * the browser. Every assertion here fixes an instant and checks the rendering is
 * Harare's, whatever the machine running the test believes the time is.
 */

// 2026-08-31T12:39:00Z is 14:39 in Africa/Harare (UTC+2, no DST).
const INSTANT = "2026-08-31T12:39:00.000Z";

test("the platform timezone is Africa/Harare", () => {
  assert.equal(TZ, "Africa/Harare");
});

test("an instant renders in UTC+2, not UTC", () => {
  assert.match(formatShortDateTime(INSTANT), /14:39/);
  assert.doesNotMatch(formatShortDateTime(INSTANT), /12:39/);
});

test("the long form carries the weekday and the same time", () => {
  const out = formatDateTime(INSTANT);
  assert.match(out, /14:39/);
  assert.match(out, /Mon/);
});

test("a date near midnight UTC lands on the next day in Harare", () => {
  // 23:30Z on the 31st is 01:30 on the 1st locally. Getting this wrong shifts a
  // whole day's incidents into the previous day on any report.
  const out = formatShortDateTime("2026-08-31T23:30:00.000Z");
  assert.match(out, /01:30/);
  assert.match(out, /01 Sep/);
});

test("weekday is computed in Harare, not UTC", () => {
  // 22:00Z Sunday is already Monday in Harare.
  assert.equal(formatWeekday("2026-08-30T22:00:00.000Z"), "Mon");
});

test("a Date and an ISO string agree", () => {
  assert.equal(formatShortDateTime(new Date(INSTANT)), formatShortDateTime(INSTANT));
});
