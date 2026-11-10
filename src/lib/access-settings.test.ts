import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  forgetSavedComputersWith,
  getOfficeAccessWith,
  officeAccountsWith,
  setCodeEmailWith,
} from "./access-settings.ts";

let db: Database;
let close: () => Promise<void>;
const TENANT = "cartorio-marinho";
before(async () => {
  ({ db, close } = await createTestDb());
  // Fictitious people only (LGPD).
  await db.insert(user).values([
    {
      id: "adm",
      name: "Maria Exemplo da Silva",
      email: "maria.acesso@exemplo.com",
      tenantSlug: TENANT,
      role: "admin",
    },
    {
      id: "esc",
      name: "João Fictício de Souza",
      email: "joao.acesso@exemplo.com",
      tenantSlug: TENANT,
      role: "staff",
    },
    {
      id: "atrios",
      name: "Átrios",
      email: "mestre@exemplo.com",
      tenantSlug: "atrios",
      role: "superadmin",
    },
  ]);
});
after(async () => {
  await close();
});

test("o administrador escolhe, troca e apaga o e-mail de verificação de cada pessoa", async () => {
  assert.deepEqual(
    (await officeAccountsWith(db, TENANT)).map((a) => a.id).sort(),
    ["adm", "esc"],
  );
  await setCodeEmailWith(db, TENANT, "esc", "joao.celular@exemplo.com", "adm");
  assert.equal(
    (await getOfficeAccessWith(db, TENANT)).esc?.email,
    "joao.celular@exemplo.com",
  );
  await forgetSavedComputersWith(db, TENANT, "esc", "adm");
  await forgetSavedComputersWith(db, TENANT, "esc", "adm");
  assert.equal((await getOfficeAccessWith(db, TENANT)).esc?.epoch, 2);
  await setCodeEmailWith(db, TENANT, "esc", undefined, "adm");
  const after = (await getOfficeAccessWith(db, TENANT)).esc;
  assert.equal(after?.email, undefined);
  // Clearing the e-mail keeps the saved-computers epoch.
  assert.equal(after?.epoch, 2);
});
