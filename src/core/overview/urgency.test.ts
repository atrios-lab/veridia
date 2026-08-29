import assert from "node:assert/strict";
import { test } from "node:test";
import { dataRightsUrgency, deadlineUrgency } from "./urgency.ts";

test("received far from the deadline", () => {
  const urgency = dataRightsUrgency("new", "2026-08-01", "2026-08-02");
  assert.deepEqual(urgency, { kind: "received" });
});

test("due-soon inside the three day horizon", () => {
  // Requested day counts as day 1: thirteen days later is day 14 of 15.
  const urgency = dataRightsUrgency("new", "2026-08-01", "2026-08-14");
  assert.deepEqual(urgency, { kind: "due-soon", daysLeft: 1 });
});

test("overdue past the fifteen day term", () => {
  const urgency = dataRightsUrgency("new", "2026-08-01", "2026-08-20");
  assert.deepEqual(urgency, { kind: "overdue", daysLate: 5 });
});

test("answered and cancelled ignore the term entirely", () => {
  assert.deepEqual(dataRightsUrgency("answered", "2026-01-01", "2026-08-20"), {
    kind: "answered",
  });
  assert.deepEqual(dataRightsUrgency("cancelled", "2026-01-01", "2026-08-20"), {
    kind: "cancelled",
  });
});

// Filed Monday 2026-08-03 with a ten business day term, which lands on
// 2026-08-17: two weekends sit inside it and neither ages the request.
const FILED = "2026-08-03";

test("an open record runs quietly while the term is far", () => {
  assert.deepEqual(deadlineUrgency(true, FILED, 10, "2026-08-10"), {
    kind: "running",
  });
});

test("an open record flags inside the three day horizon", () => {
  assert.deepEqual(deadlineUrgency(true, FILED, 10, "2026-08-12"), {
    kind: "due-soon",
    daysLeft: 3,
  });
});

test("the days left are business days, not calendar ones", () => {
  // Friday the 14th: only the 17th is left, though the calendar shows three.
  assert.deepEqual(deadlineUrgency(true, FILED, 10, "2026-08-14"), {
    kind: "due-soon",
    daysLeft: 1,
  });
});

test("an open record past its term reports how late it is", () => {
  assert.deepEqual(deadlineUrgency(true, FILED, 10, "2026-08-20"), {
    kind: "overdue",
    daysLate: 3,
  });
});

test("a closed record has no urgency, however old", () => {
  assert.deepEqual(deadlineUrgency(false, "2026-01-01", 10, "2026-08-20"), {
    kind: "closed",
  });
});
