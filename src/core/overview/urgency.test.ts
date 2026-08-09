import assert from "node:assert/strict";
import { test } from "node:test";
import { dataRightsUrgency } from "./urgency.ts";

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
