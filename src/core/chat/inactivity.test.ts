import assert from "node:assert/strict";
import { test } from "node:test";
import { isStale, needsInactivityWarning } from "./inactivity.ts";

const NOW = new Date("2026-08-11T13:00:00Z");
function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

test("a fresh active conversation is not stale", () => {
  assert.equal(
    isStale({ status: "active", lastActivityAt: minutesAgo(1) }, NOW),
    false,
  );
});

test("an active conversation idle for 10 minutes is stale", () => {
  assert.equal(
    isStale({ status: "active", lastActivityAt: minutesAgo(10) }, NOW),
    true,
  );
});

test("a waiting conversation is never stale, however old", () => {
  assert.equal(
    isStale({ status: "waiting", lastActivityAt: minutesAgo(60) }, NOW),
    false,
  );
});

test("a closed conversation is never stale", () => {
  assert.equal(
    isStale({ status: "closed", lastActivityAt: minutesAgo(60) }, NOW),
    false,
  );
});

test("the warning is off before 8 minutes idle", () => {
  assert.equal(
    needsInactivityWarning(
      { status: "active", lastActivityAt: minutesAgo(5) },
      NOW,
    ),
    false,
  );
});

test("the warning is on between 8 and 10 minutes idle", () => {
  assert.equal(
    needsInactivityWarning(
      { status: "active", lastActivityAt: minutesAgo(9) },
      NOW,
    ),
    true,
  );
});

test("the warning is off once the conversation is already stale", () => {
  assert.equal(
    needsInactivityWarning(
      { status: "active", lastActivityAt: minutesAgo(11) },
      NOW,
    ),
    false,
  );
});
