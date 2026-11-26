import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { riProperties } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  decideDeletionWith,
  listDeletionRequestsWith,
  requestDeletionWith,
} from "./deletion-requests.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const T = "cartorio-teste-exclusao";

test("documento oficial só sai com o Tabelião; recusar mantém; nada é tirado do banco", async () => {
  const [p] = await db
    .insert(riProperties)
    .values({ tenantSlug: T, number: 7 })
    .returning({ id: riProperties.id });
  const id = p?.id as string;
  await requestDeletionWith(
    db,
    T,
    {
      kind: "ri-property",
      targetId: id,
      label: "",
      reason: "Lançada em duplicidade",
    },
    { id: "u-escrevente" },
  );
  await assert.rejects(
    requestDeletionWith(
      db,
      T,
      { kind: "ri-property", targetId: id, label: "", reason: "de novo" },
      { id: "u-escrevente" },
    ),
  );
  let [req] = await listDeletionRequestsWith(db, T);
  assert.equal(req?.label, "Matrícula nº 007");
  assert.equal(req?.status, "pendente");
  let [row] = await db
    .select()
    .from(riProperties)
    .where(eq(riProperties.id, id));
  assert.equal(row?.deletedAt, null);
  await decideDeletionWith(db, T, req?.id as string, true, "Confirmo", {
    id: "u-tabeliao",
  });
  [row] = await db.select().from(riProperties).where(eq(riProperties.id, id));
  assert.ok(row?.deletedAt);
  [req] = await listDeletionRequestsWith(db, T);
  assert.equal(req?.status, "aprovado");
  await assert.rejects(
    decideDeletionWith(db, T, req?.id as string, false, "x", {
      id: "u-tabeliao",
    }),
  );
});
