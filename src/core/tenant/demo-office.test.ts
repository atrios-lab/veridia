import assert from "node:assert/strict";
import { test } from "node:test";
import {
  holdsEmail,
  isOutboundAllowed,
  showsDemoPanelNotice,
} from "./demo-office.ts";
import { TENANTS } from "./resolve.ts";

test("the demonstration office holds the office's e-mail and sends the account's", () => {
  assert.equal(holdsEmail({ demo: true }, "office"), true);
  assert.equal(holdsEmail({ demo: true }, "account"), false);
});

test("a real office sends every e-mail", () => {
  assert.equal(holdsEmail({ demo: false }, "office"), false);
  assert.equal(holdsEmail({}, "office"), false);
  assert.equal(holdsEmail({ demo: false }, "account"), false);
});

test("nothing leaves for an outside system from the demonstration office", () => {
  assert.equal(isOutboundAllowed({ demo: true }), false);
  assert.equal(isOutboundAllowed({ demo: false }), true);
  assert.equal(isOutboundAllowed({}), true);
});

test("every registered office but the fictional ones sends as before", () => {
  for (const tenant of Object.values(TENANTS)) {
    assert.equal(
      isOutboundAllowed(tenant),
      !tenant.demo,
      `${tenant.slug}: demo ${tenant.demo}`,
    );
  }
});

test("the panel's demonstration bar is for the participant, not for the Átrios", () => {
  assert.equal(showsDemoPanelNotice("learner", { demo: true }), true);
  assert.equal(showsDemoPanelNotice("superadmin", { demo: true }), false);
  assert.equal(showsDemoPanelNotice("staff", { demo: true }), false);
  assert.equal(showsDemoPanelNotice("learner", { demo: false }), false);
});
