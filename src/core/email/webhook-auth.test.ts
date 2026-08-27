import assert from "node:assert/strict";
import { test } from "node:test";
import { webhookSecretMatches } from "./webhook-auth.ts";

const SECRET = "segredo-de-teste-sem-valor-nenhum";

test("the configured secret is accepted", () => {
  assert.ok(webhookSecretMatches(SECRET, SECRET));
});

test("a wrong or missing secret is refused", () => {
  assert.equal(webhookSecretMatches("outro-segredo", SECRET), false);
  assert.equal(webhookSecretMatches("", SECRET), false);
  assert.equal(webhookSecretMatches(null, SECRET), false);
  assert.equal(webhookSecretMatches(undefined, SECRET), false);
});

test("a secret of the wrong length is refused without throwing", () => {
  // timingSafeEqual throws on differing lengths; the guard has to come first
  // or the endpoint answers 500 and says so by the shape of the failure.
  assert.doesNotThrow(() => webhookSecretMatches("curto", SECRET));
  assert.equal(webhookSecretMatches("curto", SECRET), false);
  assert.equal(webhookSecretMatches(`${SECRET}-a-mais`, SECRET), false);
});

test("with nothing configured, everything is refused", () => {
  // The direction that matters: an open endpoint writing to this table lets
  // anyone cut off mail to a person by posting their address.
  assert.equal(webhookSecretMatches(SECRET, undefined), false);
  assert.equal(webhookSecretMatches(SECRET, ""), false);
  assert.equal(webhookSecretMatches("", undefined), false);
});
