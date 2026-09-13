import assert from "node:assert/strict";
import { test } from "node:test";
import { emailsMatch } from "./match.ts";

test("same address matches", () => {
  assert.equal(emailsMatch("maria@exemplo.com", "maria@exemplo.com"), true);
});

test("case differs but matches", () => {
  assert.equal(emailsMatch("Maria@Exemplo.com", "maria@exemplo.com"), true);
});

test("surrounding whitespace is ignored", () => {
  assert.equal(emailsMatch("  maria@exemplo.com ", "maria@exemplo.com"), true);
});

test("different address does not match", () => {
  assert.equal(emailsMatch("maria@exemplo.com", "joao@exemplo.com"), false);
});

test("a plus tag is not normalised away", () => {
  assert.equal(
    emailsMatch("maria+recuperacao@exemplo.com", "maria@exemplo.com"),
    false,
  );
});

test("a dot is not normalised away", () => {
  assert.equal(emailsMatch("m.aria@exemplo.com", "maria@exemplo.com"), false);
});
