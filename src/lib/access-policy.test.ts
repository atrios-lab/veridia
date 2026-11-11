import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  getAccessPolicyWith,
  listAccessPoliciesWith,
  setAccessPolicyWith,
} from "./access-policy.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("a Átrios desliga e religa as duas etapas de uma serventia, sem tocar nas outras", async () => {
  assert.equal(
    (await getAccessPolicyWith(db, "cartorio-marinho")).twoStep,
    "on",
  );
  await setAccessPolicyWith(
    db,
    "cartorio-marinho",
    "off",
    "E-mail fora do ar",
    "atrios",
  );
  const off = await getAccessPolicyWith(db, "cartorio-marinho");
  assert.equal(off.twoStep, "off");
  assert.equal(off.reason, "E-mail fora do ar");
  const all = await listAccessPoliciesWith(db, [
    "cartorio-marinho",
    "cartorio-brejinho",
  ]);
  assert.equal(all["cartorio-marinho"].twoStep, "off");
  assert.equal(all["cartorio-brejinho"].twoStep, "on");
  await setAccessPolicyWith(db, "cartorio-marinho", "on", "", "atrios");
  assert.equal(
    (await getAccessPolicyWith(db, "cartorio-marinho")).twoStep,
    "on",
  );
});
