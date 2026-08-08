import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isOpenServiceRequestStatus,
  isServiceRequestStatus,
  SERVICE_REQUEST_STATUSES,
  statusLabel,
  suggestedNextStatuses,
} from "./kinds.ts";

test("every service request status has a Portuguese label", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.notEqual(statusLabel("service-request", status), "Em andamento");
  }
});

test("a value outside the eight is not a service request status", () => {
  assert.equal(isServiceRequestStatus("in-progress"), false);
  assert.equal(isServiceRequestStatus("new"), true);
});

test("open counts everything short of a terminal andamento", () => {
  assert.ok(isOpenServiceRequestStatus("new"));
  assert.ok(isOpenServiceRequestStatus("in-review"));
  assert.ok(isOpenServiceRequestStatus("awaiting-payment"));
  assert.ok(isOpenServiceRequestStatus("paid"));
  assert.equal(isOpenServiceRequestStatus("done"), false);
  assert.equal(isOpenServiceRequestStatus("rejected"), false);
  assert.equal(isOpenServiceRequestStatus("cancelled"), false);
  assert.equal(isOpenServiceRequestStatus("archived"), false);
});

test("suggested transitions match what the detail screen offers", () => {
  assert.deepEqual(suggestedNextStatuses("in-review"), [
    "awaiting-payment",
    "rejected",
    "cancelled",
  ]);
  assert.deepEqual(suggestedNextStatuses("archived"), []);
});
