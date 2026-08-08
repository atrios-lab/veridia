import assert from "node:assert/strict";
import { test } from "node:test";
import { ROLES } from "../../../core/auth/roles.ts";
import { ROLE_LABELS } from "./role-labels.ts";

test("every role has a Portuguese label", () => {
  for (const role of ROLES) {
    assert.ok(ROLE_LABELS[role], `papel "${role}" sem rótulo`);
  }
});

test("labels match the design: admin is Registrador, staff is Operador", () => {
  assert.equal(ROLE_LABELS.admin, "Registrador");
  assert.equal(ROLE_LABELS.staff, "Operador");
});
