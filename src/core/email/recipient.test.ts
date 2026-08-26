import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRecipient } from "./recipient.ts";

test("without a redirect configured the message goes where it was addressed", () => {
  const resolved = resolveRecipient(
    "cidada@exemplo.com",
    "Exigência registrada",
    undefined,
  );
  assert.deepEqual(resolved, {
    to: "cidada@exemplo.com",
    subject: "Exigência registrada",
    redirected: false,
  });
});

test("an empty or blank value is not a redirect", () => {
  // A variable set to "" in a deployment's settings is someone clearing it,
  // not someone asking for every message to go to nobody.
  for (const value of ["", "   "]) {
    const resolved = resolveRecipient("cidada@exemplo.com", "Assunto", value);
    assert.equal(resolved.to, "cidada@exemplo.com");
    assert.equal(resolved.redirected, false);
  }
});

test("a redirect takes the message and keeps the addressee in the subject", () => {
  const resolved = resolveRecipient(
    "rosa.fontes@email.com",
    "Exigência registrada · REQ.2098.000001",
    "atrioss.ia@gmail.com",
  );
  assert.deepEqual(resolved, {
    to: "atrioss.ia@gmail.com",
    subject:
      "[teste → rosa.fontes@email.com] Exigência registrada · REQ.2098.000001",
    redirected: true,
  });
});
