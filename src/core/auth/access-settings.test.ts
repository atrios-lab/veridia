import assert from "node:assert/strict";
import { test } from "node:test";
import {
  codeEmailFor,
  deviceEpochOf,
  needsAccessCode,
  parseOfficeAccess,
} from "./access-settings.ts";

test("o código vai para o e-mail escolhido pelo administrador, ou para o da conta", () => {
  const access = parseOfficeAccess({
    users: {
      u1: { email: "verificacao@exemplo.com", epoch: 2 },
      u2: { email: "isto-nao-e-email" },
      u3: { epoch: 1 },
    },
  });
  assert.equal(
    codeEmailFor(access, "u1", "conta@exemplo.com"),
    "verificacao@exemplo.com",
  );
  assert.equal(
    codeEmailFor(access, "u2", "conta2@exemplo.com"),
    "conta2@exemplo.com",
  );
  assert.equal(
    codeEmailFor(access, "u9", "conta9@exemplo.com"),
    "conta9@exemplo.com",
  );
  assert.equal(deviceEpochOf(access, "u1"), 2);
  assert.equal(deviceEpochOf(access, "u9"), 0);
  assert.deepEqual(parseOfficeAccess(null), {});
});

test("a conta mestre da Átrios não passa pelo código; as do cartório passam", () => {
  assert.equal(needsAccessCode("superadmin"), false);
  assert.equal(needsAccessCode("admin"), true);
  assert.equal(needsAccessCode("staff"), true);
});
