import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { cnmOf } from "@/core/ri/cnm.ts";
import type { Database } from "@/db/index.ts";
import { riProperties } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  importPgvReturnWith,
  pgvCredentialWith,
  savePgvCredentialWith,
} from "./ri-pgv.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  process.env.BETTER_AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const TENANT = { slug: "cartorio-teste-pgv", cns: "123456" };
const ACTOR = { id: "u-oficial" };

test("o retorno do PGV marca as matrículas e não troca CNM diferente", async () => {
  await db.insert(riProperties).values([
    { tenantSlug: TENANT.slug, number: 1 },
    { tenantSlug: TENANT.slug, number: 2, cnm: cnmOf("123456", 2, 3) },
  ]);
  const file = `matricula;cnm\n1;${cnmOf("123456", 2, 1)}\n2;${cnmOf("123456", 2, 2)}\n7;${cnmOf("123456", 2, 7)}`;
  const out = await importPgvReturnWith(db, TENANT, file, ACTOR);
  assert.equal(out.marked, 1);
  assert.equal(out.filled, 1);
  assert.equal(out.differ.length, 1);
  assert.equal(out.missing.length, 1);
  const [one] = await db
    .select()
    .from(riProperties)
    .where(eq(riProperties.number, 1));
  assert.equal(one?.cnmInPgv, true);
  assert.equal(one?.cnm, cnmOf("123456", 2, 1));
});

test("a credencial guarda o Hash cifrado e apagar só esvazia", async () => {
  await savePgvCredentialWith(
    db,
    TENANT.slug,
    { clientId: "cliente-exemplo", hash: "hash-ficticio-123" },
    ACTOR,
  );
  let c = await pgvCredentialWith(db, TENANT.slug);
  assert.equal(c.clientId, "cliente-exemplo");
  assert.equal(c.hasHash, true);
  await savePgvCredentialWith(
    db,
    TENANT.slug,
    { clientId: "", hash: "", clear: true },
    ACTOR,
  );
  c = await pgvCredentialWith(db, TENANT.slug);
  assert.equal(c.hasHash, false);
});
