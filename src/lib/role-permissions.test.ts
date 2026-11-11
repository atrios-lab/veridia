import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  getRolePermissionsWith,
  saveRolePermissionsWith,
} from "./role-permissions.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("as permissões de cada cargo ficam gravadas, sem nada reservado ou desconhecido", async () => {
  assert.deepEqual(await getRolePermissionsWith(db, "cartorio-marinho"), {});
  await saveRolePermissionsWith(
    db,
    "cartorio-marinho",
    {
      contador: ["billing.edit", "user.manage", "inventado"],
      rh: [],
      admin: ["desk.access"],
    },
    "titular",
  );
  const saved = await getRolePermissionsWith(db, "cartorio-marinho");
  assert.deepEqual(saved.contador, ["billing.edit"]);
  assert.deepEqual(saved.rh, []);
  assert.equal(saved.admin, undefined);
  // Another office is untouched.
  assert.deepEqual(await getRolePermissionsWith(db, "cartorio-brejinho"), {});
});
