import assert from "node:assert/strict";
import { test } from "node:test";
import {
  businessDaysBetween,
  dayOfDeadline,
  deadlineDate,
  deadlineDaysSchema,
  effectiveDeadline,
  readDeadline,
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
