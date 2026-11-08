import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CITIZEN_NUDGE_MESSAGE,
  canNudge,
  isOfficeNudge,
  nudgeAvailableAt,
  nudgeMessage,
  nudgeWaitLabel,
  OFFICE_NUDGE_MESSAGE,
} from "./nudge.ts";

const START = new Date("2026-11-08T12:00:00Z");
const at = (minutes: number) => new Date(START.getTime() + minutes * 60_000);

test("the first call waits ten minutes from the start", () => {
  const state = {
    startedAt: START,
    lastStaffMessageAt: null,
    lastNudgeAt: null,
  };
  assert.equal(canNudge(state, at(9)), false);
  assert.equal(canNudge(state, at(10)), true);
});

test("a reply from the office restarts the ten minutes", () => {
  const state = {
    startedAt: START,
    lastStaffMessageAt: at(8),
    lastNudgeAt: null,
  };
  assert.equal(canNudge(state, at(12)), false);
  assert.equal(canNudge(state, at(18)), true);
});

test("after a call, the next waits ten more minutes", () => {
  const state = {
    startedAt: START,
    lastStaffMessageAt: null,
    lastNudgeAt: at(11),
  };
  assert.deepEqual(nudgeAvailableAt(state), at(21));
  assert.equal(canNudge(state, at(20)), false);
  assert.equal(canNudge(state, at(21)), true);
});

test("the wait reads in whole minutes, rounded up", () => {
  assert.equal(nudgeWaitLabel(at(10), at(3)), "em 7 min");
  assert.equal(nudgeWaitLabel(at(10), at(9.9)), "em 1 min");
});

test("each side leaves its own line, and the citizen can tell the office's", () => {
  assert.equal(nudgeMessage("citizen"), CITIZEN_NUDGE_MESSAGE);
  assert.equal(nudgeMessage("office"), OFFICE_NUDGE_MESSAGE);
  assert.equal(
    isOfficeNudge({ authorType: "system", body: OFFICE_NUDGE_MESSAGE }),
    true,
  );
  assert.equal(
    isOfficeNudge({ authorType: "staff", body: OFFICE_NUDGE_MESSAGE }),
    false,
  );
  assert.equal(
    isOfficeNudge({ authorType: "system", body: CITIZEN_NUDGE_MESSAGE }),
    false,
  );
});
