import assert from "node:assert/strict";
import { test } from "node:test";
import { SERVICE_REQUEST_STATUSES } from "../../../../../core/request/kinds.ts";
import { STATUS_TONES } from "./status-tone.ts";

test("an exigência reads as stalled, not as work in progress", () => {
  assert.equal(STATUS_TONES["with-requirement"], "blocked");
  assert.equal(STATUS_TONES["awaiting-compliance"], "blocked");
  assert.notEqual(STATUS_TONES["in-review"], "blocked");
});

test("every andamento names its own tone", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.ok(STATUS_TONES[status], `sem tom declarado: ${status}`);
  }
  assert.equal(
    Object.keys(STATUS_TONES).length,
    SERVICE_REQUEST_STATUSES.length,
  );
});
