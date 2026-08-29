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

test("an open record runs quietly while the term is far", () => {
  assert.deepEqual(deadlineUrgency(true, "2026-08-01", 30, "2026-08-10"), {
    kind: "running",
  });
});

test("an open record flags inside the three day horizon", () => {
  // Start counts as day 1: the 28th is day 28 of 30, two days left.
  assert.deepEqual(deadlineUrgency(true, "2026-08-01", 30, "2026-08-28"), {
    kind: "due-soon",
    daysLeft: 2,
  });
});

test("an open record past its term reports how late it is", () => {
  assert.deepEqual(deadlineUrgency(true, "2026-08-01", 30, "2026-09-05"), {
    kind: "overdue",
    daysLate: 6,
  });
});

test("a closed record has no urgency, however old", () => {
  assert.deepEqual(deadlineUrgency(false, "2026-01-01", 30, "2026-08-20"), {
    kind: "closed",
  });
});
