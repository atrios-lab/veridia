import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isOpenServiceRequestStatus,
  isOpenStatus,
  isServiceRequestStatus,
  ombudsmanDetailsSchema,
  parseDetails,
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

test("isOpenStatus counts everything short of each kind's terminal statuses", () => {
  assert.ok(isOpenStatus("appointment", "requested"));
  assert.ok(isOpenStatus("appointment", "proposed"));
  assert.ok(isOpenStatus("appointment", "confirmed"));
  assert.equal(isOpenStatus("appointment", "done"), false);
  assert.equal(isOpenStatus("appointment", "cancelled"), false);

  assert.ok(isOpenStatus("data-rights", "new"));
  assert.equal(isOpenStatus("data-rights", "answered"), false);
  assert.equal(isOpenStatus("data-rights", "cancelled"), false);

  assert.ok(isOpenStatus("ombudsman", "new"));
  assert.ok(isOpenStatus("ombudsman", "in-review"));
  assert.equal(isOpenStatus("ombudsman", "answered"), false);
  assert.equal(isOpenStatus("ombudsman", "done"), false);
});

test("isOpenStatus agrees with isOpenServiceRequestStatus for service requests", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.equal(
      isOpenStatus("service-request", status),
      isOpenServiceRequestStatus(status),
    );
  }
});

test("draft reply and internal note round-trip through details", () => {
  const details = parseDetails("ombudsman", {
    manifestationType: "complaint",
    anonymous: true,
    confidential: false,
    draftReply: "rascunho",
    internalNote: "nota interna",
  });
  assert.equal(details.draftReply, "rascunho");
  assert.equal(details.internalNote, "nota interna");

  const bare = ombudsmanDetailsSchema.parse({
    manifestationType: "praise",
    anonymous: false,
    confidential: false,
  });
  assert.equal(bare.draftReply, undefined);
  assert.equal(bare.internalNote, undefined);
});
