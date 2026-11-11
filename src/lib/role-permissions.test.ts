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

test("permissão nova segue a antiga até o Tabelião decidir; depois fica como ele deixou", async () => {
  const { tenantContent } = await import("@/db/schema.ts");
  const { OFFICE_ROLE_PERMISSIONS_KEY } = await import("./office-config.ts");
  // Saved before the per-tool permissions existed (no `known`).
  await db.insert(tenantContent).values({
    tenantSlug: "cartorio-teste-antigo",
    key: OFFICE_ROLE_PERMISSIONS_KEY,
    published: {
      staff: ["desk.access", "requests.manage"],
      rh: ["desk.access"],
    },
  });
  const old = await getRolePermissionsWith(db, "cartorio-teste-antigo");
  // Who worked the requests keeps the guias and the ISS; desk keeps the signer.
  assert.ok(old.staff?.includes("guides.manage"));
  assert.ok(old.staff?.includes("iss.manage"));
  assert.ok(old.staff?.includes("signer.use"));
  assert.ok(!old.rh?.includes("guides.manage"));
  // Reserved parents never pass anything on.
  assert.ok(!old.staff?.includes("access.manage"));

  // Once saved again, an unchecked new permission stays unchecked.
  await saveRolePermissionsWith(
    db,
    "cartorio-teste-antigo",
    { staff: ["desk.access", "requests.manage"] },
    "titular",
  );
  const decided = await getRolePermissionsWith(db, "cartorio-teste-antigo");
  assert.deepEqual(decided.staff, ["desk.access", "requests.manage"]);
});
