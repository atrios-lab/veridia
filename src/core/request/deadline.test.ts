import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayOfDeadline,
  deadlineDate,
  deadlineDaysSchema,
  effectiveDeadline,
} from "./deadline.ts";

test("the deadline lands the given number of days after the start", () => {
  assert.equal(deadlineDate("2026-08-28", 30), "2026-09-27");
  assert.equal(deadlineDate("2026-12-20", 15), "2027-01-04");
});

test("the start day is day 1 of the term", () => {
  assert.equal(dayOfDeadline("2026-08-28", "2026-08-28"), 1);
  assert.equal(dayOfDeadline("2026-08-28", "2026-08-29"), 2);
});

test("the count keeps going past the term", () => {
  assert.equal(dayOfDeadline("2026-08-01", "2026-09-10"), 41);
});

test("a day before the start still reads as day 1", () => {
  assert.equal(dayOfDeadline("2026-08-28", "2026-08-20"), 1);
});

test("a request the office never touched counts from filing with the default", () => {
  assert.deepEqual(effectiveDeadline("2026-08-28", undefined, 30), {
    startedOn: "2026-08-28",
    days: 30,
  });
});

test("a stored term wins over the office default", () => {
  const stored = { startedOn: "2026-09-01", days: 45 };
  assert.deepEqual(effectiveDeadline("2026-08-28", stored, 30), stored);
});

test("the term is bounded to a sane number of days", () => {
  assert.equal(deadlineDaysSchema.safeParse(1).success, true);
  assert.equal(deadlineDaysSchema.safeParse(365).success, true);
  assert.equal(deadlineDaysSchema.safeParse(0).success, false);
  assert.equal(deadlineDaysSchema.safeParse(366).success, false);
  assert.equal(deadlineDaysSchema.safeParse(15.5).success, false);
});
