import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES } from "../../../core/auth/roles.ts";
import { ROLE_LABELS } from "./role-labels.ts";

test("every role has a Portuguese label", () => {
  for (const role of ROLES) {
    assert.ok(ROLE_LABELS[role], `papel "${role}" sem rótulo`);
  }
});

test("labels match the office's positions: admin is the Tabelião/Registrador, staff the Escrevente", () => {
  assert.equal(ROLE_LABELS.admin, "Tabelião/Registrador");
  assert.equal(ROLE_LABELS.staff, "Escrevente");
});
