import assert from "node:assert/strict";
import { test } from "node:test";
import {
  businessDaysBetween,
  dayOfDeadline,
  deadlineClock,
  deadlineDate,
  deadlineDaysSchema,
  effectiveDeadline,
  pauseReasons,
  readDeadline,
  resumeDeadline,
} from "./deadline.ts";

// 2026-08-28 is a Friday; 29 and 30 are the weekend.
test("the term skips the weekend", () => {
  assert.equal(deadlineDate("2026-08-28", 1), "2026-08-31");
  assert.equal(deadlineDate("2026-08-28", 3), "2026-09-02");
});

test("the day of filing is excluded, as the civil procedure counts", () => {
  assert.equal(dayOfDeadline("2026-08-28", "2026-08-28"), 0);
  assert.equal(dayOfDeadline("2026-08-28", "2026-08-31"), 1);
});

test("the weekend does not age a request", () => {
  // Friday to Sunday: nothing of the term has run.
  assert.equal(dayOfDeadline("2026-08-28", "2026-08-30"), 0);
});

test("a national holiday is not a business day", () => {
  // 2026-09-07 is Independência, a Monday; the term jumps to Tuesday.
  assert.equal(deadlineDate("2026-09-04", 1), "2026-09-08");
});

test("Easter derived holidays are skipped too", () => {
  // 2026-04-03 is Sexta-feira Santa (Easter is 2026-04-05).
  assert.equal(deadlineDate("2026-04-02", 1), "2026-04-06");
});

test("the count keeps going past the term", () => {
  assert.equal(businessDaysBetween("2026-08-03", "2026-08-28"), 19);
});

test("a day at or before the start counts nothing", () => {
  assert.equal(businessDaysBetween("2026-08-28", "2026-08-28"), 0);
  assert.equal(businessDaysBetween("2026-08-28", "2026-08-20"), 0);
});

test("a request nobody touched is born with the act's legal term", () => {
  assert.deepEqual(effectiveDeadline("2026-08-28", undefined, 10, 30), {
    startedOn: "2026-08-28",
    days: 10,
  });
});

test("an act the law fixes no term for falls back to the office default", () => {
  assert.deepEqual(effectiveDeadline("2026-08-28", undefined, undefined, 30), {
    startedOn: "2026-08-28",
    days: 30,
  });
});

test("a term the office set on the request wins over both", () => {
  const stored = { startedOn: "2026-09-01", days: 45 };
  assert.deepEqual(effectiveDeadline("2026-08-28", stored, 10, 30), stored);
});

test("a malformed stored term reads as none, never as half a term", () => {
  assert.equal(readDeadline(null), undefined);
  assert.equal(readDeadline({ deadline: "amanhã" }), undefined);
  assert.equal(
    readDeadline({ deadline: { startedOn: "28/08/2026" } }),
    undefined,
  );
  assert.equal(
    readDeadline({ deadline: { startedOn: "2026-08-28", days: 0 } }),
    undefined,
  );
  assert.deepEqual(
    readDeadline({ deadline: { startedOn: "2026-08-28", days: 10 } }),
    {
      startedOn: "2026-08-28",
      days: 10,
    },
  );
});

test("the term is bounded to a sane number of days", () => {
  assert.equal(deadlineDaysSchema.safeParse(1).success, true);
  assert.equal(deadlineDaysSchema.safeParse(365).success, true);
  assert.equal(deadlineDaysSchema.safeParse(0).success, false);
  assert.equal(deadlineDaysSchema.safeParse(366).success, false);
  assert.equal(deadlineDaysSchema.safeParse(15.5).success, false);
});

test("a stored pause survives the read; a malformed one drops the term", () => {
  assert.deepEqual(
    readDeadline({
      deadline: { startedOn: "2026-08-28", days: 10, pausedOn: "2026-09-01" },
    }),
    { startedOn: "2026-08-28", days: 10, pausedOn: "2026-09-01" },
  );
  assert.equal(
    readDeadline({
      deadline: { startedOn: "2026-08-28", days: 10, pausedOn: "ontem" },
    }),
    undefined,
  );
});

test("only a written requirement or a priced payment pauses the clock", () => {
  assert.deepEqual(
    pauseReasons({
      status: "in-review",
      amountCents: null,
      pendingRequirements: 1,
    }),
    ["requirement"],
  );
  assert.deepEqual(
    pauseReasons({
      status: "awaiting-compliance",
      amountCents: null,
      pendingRequirements: 0,
    }),
    [],
  );
  assert.deepEqual(
    pauseReasons({
      status: "awaiting-payment",
      amountCents: 5790,
      pendingRequirements: 0,
    }),
    ["payment"],
  );
  assert.deepEqual(
    pauseReasons({
      status: "awaiting-payment",
      amountCents: null,
      pendingRequirements: 0,
    }),
    [],
  );
  assert.deepEqual(
    pauseReasons({
      status: "awaiting-payment",
      amountCents: 100,
      pendingRequirements: 2,
    }),
    ["requirement", "payment"],
  );
});

test("the clock reads the day it stopped while paused", () => {
  const paused = { startedOn: "2026-08-03", days: 10, pausedOn: "2026-08-07" };
  assert.equal(deadlineClock(paused, "2026-08-20"), "2026-08-07");
  assert.equal(
    dayOfDeadline(paused.startedOn, deadlineClock(paused, "2026-08-20")),
    4,
  );
  assert.equal(
    deadlineClock({ startedOn: "2026-08-03", days: 10 }, "2026-08-20"),
    "2026-08-20",
  );
});

test("an act with a legal term restarts on the day of the retomada", () => {
  assert.deepEqual(
    resumeDeadline(
      { startedOn: "2026-08-03", days: 10, pausedOn: "2026-08-07" },
      "2026-08-17",
      true,
    ),
    { startedOn: "2026-08-17", days: 10 },
  );
});

test("an act on the office default resumes where it stopped", () => {
  // Paused Friday the 7th, resumed Monday the 17th: the weekend in between
  // is not a business day, so the pause is worth six days, not ten.
  assert.deepEqual(
    resumeDeadline(
      { startedOn: "2026-08-03", days: 20, pausedOn: "2026-08-07" },
      "2026-08-17",
      false,
    ),
    { startedOn: "2026-08-11", days: 20 },
  );
  // Read on the day it resumed, the counting is back on day 4 of 20.
  assert.equal(dayOfDeadline("2026-08-11", "2026-08-17"), 4);
});

test("resuming a running term only strips a pause it does not have", () => {
  assert.deepEqual(
    resumeDeadline({ startedOn: "2026-08-03", days: 10 }, "2026-08-17", true),
    { startedOn: "2026-08-03", days: 10 },
  );
});
