import assert from "node:assert/strict";
import { test } from "node:test";
import { decidesDeletions } from "./official.ts";

test("o Tabelião decide; o substituto só quando autorizado em Perfis e permissões", () => {
  assert.equal(decidesDeletions("admin"), true);
  assert.equal(decidesDeletions("superadmin"), true);
  assert.equal(decidesDeletions("substituto"), false);
  assert.equal(decidesDeletions("substituto", ["desk.access"]), false);
  assert.equal(
    decidesDeletions("substituto", ["desk.access", "deletion.decide"]),
    true,
  );
  assert.equal(decidesDeletions("staff"), false);
});
