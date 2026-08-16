import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedTransition,
  isOpenServiceRequestStatus,
  isOpenStatus,
  isServiceRequestStatus,
  ombudsmanDetailsSchema,
  parseDetails,
  phaseOfStatus,
  SERVICE_REQUEST_PHASES,
  SERVICE_REQUEST_STATUSES,
  statusLabel,
  suggestedNextStatuses,
} from "./kinds.ts";

test("every service request status has a Portuguese label", () => {
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.notEqual(statusLabel("service-request", status), "Em andamento");
  }
});

test("a value outside the eighteen is not a service request status", () => {
  assert.equal(isServiceRequestStatus("in-progress"), false);
  assert.equal(isServiceRequestStatus("new"), true);
  // The registral steps the office actually works in.
  assert.equal(isServiceRequestStatus("pre-noted"), true);
  assert.equal(isServiceRequestStatus("in-qualification"), true);
  assert.equal(isServiceRequestStatus("annotated"), true);
});

test("the eight andamentos that predate the registral ones still validate", () => {
  // No row was renamed when the list grew, so every value already in the
  // database has to stay valid.
  for (const status of [
    "new",
    "in-review",
    "awaiting-payment",
    "paid",
    "done",
    "rejected",
    "cancelled",
    "archived",
  ]) {
    assert.ok(isServiceRequestStatus(status), status);
  }
});

test("every andamento belongs to exactly one phase", () => {
  const seen = new Set<string>();
  for (const phase of SERVICE_REQUEST_PHASES) {
    for (const status of phase.statuses) {
      assert.equal(seen.has(status), false, `${status} in two phases`);
      seen.add(status);
    }
  }
  for (const status of SERVICE_REQUEST_STATUSES) {
    assert.ok(seen.has(status), `${status} has no phase`);
    assert.ok(phaseOfStatus(status));
  }
  assert.equal(seen.size, SERVICE_REQUEST_STATUSES.length);
});

test("the flow is free, except standing still", () => {
  // A title's andamento does not fit a state machine: qualificação may go back
  // to exigência, a concluído may reopen. The only refusal is a no-op.
  assert.ok(isAllowedTransition("done", "in-review"));
  assert.ok(isAllowedTransition("cancelled", "in-qualification"));
  assert.ok(isAllowedTransition("archived", "new"));
  assert.equal(isAllowedTransition("in-review", "in-review"), false);
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
    "pre-noted",
    "rejected",
    "cancelled",
  ]);
  assert.deepEqual(suggestedNextStatuses("pre-noted"), [
    "in-qualification",
    "with-requirement",
    "cancelled",
  ]);
  assert.deepEqual(suggestedNextStatuses("archived"), []);
});

test("every suggestion is itself a valid andamento", () => {
  // A typo here would offer the operator a button the server then refuses.
  for (const status of SERVICE_REQUEST_STATUSES) {
    for (const next of suggestedNextStatuses(status)) {
      assert.ok(isServiceRequestStatus(next), `${status} -> ${next}`);
      assert.notEqual(next, status, `${status} suggests itself`);
    }
  }
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

test("a service request's details carry the consent with its timestamp", () => {
  const consentedAt = "2026-08-11T12:00:00.000Z";
  const details = parseDetails("service-request", {
    channel: "online",
    consents: { lgpd: consentedAt, truth: consentedAt },
  });
  assert.equal(details.consents?.lgpd, consentedAt);
  assert.equal(details.consents?.truth, consentedAt);
});

test("requests filed before the consent was recorded still parse", () => {
  // Absence reads as "predates the record", never as an invalid row.
  const details = parseDetails("service-request", { channel: "counter" });
  assert.equal(details.consents, undefined);
});

test("a consent that is not a timestamp is refused", () => {
  assert.throws(() =>
    parseDetails("service-request", {
      consents: { lgpd: "sim", truth: "sim" },
    }),
  );
});
