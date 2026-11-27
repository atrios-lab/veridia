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

test("qualquer outra exclusão guarda o formulário e só roda quando aprovada", async () => {
  await requestDeletionWith(
    db,
    T,
    {
      kind: "guide",
      targetId: "guia-ficticia-1",
      label: "Guia imobiliária",
      reason: "Emitida por engano",
      payload: [
        ["id", "guia-ficticia-1"],
        ["justificativa", "Emitida por engano"],
      ],
    },
    { id: "u-escrevente" },
  );
  const [row] = (await listDeletionRequestsWith(db, T)).filter(
    (r) => r.kind === "guide",
  );
  assert.deepEqual(row?.payload, [
    ["id", "guia-ficticia-1"],
    ["justificativa", "Emitida por engano"],
  ]);
  let ran = 0;
  await decideDeletionWith(
    db,
    T,
    row?.id as string,
    true,
    "Confere",
    { id: "u-substituto" },
    async (r) => {
      assert.equal(r.targetId, "guia-ficticia-1");
      ran++;
    },
  );
  assert.equal(ran, 1);
  const [after1] = (await listDeletionRequestsWith(db, T)).filter(
    (r) => r.kind === "guide",
  );
  assert.equal(after1?.status, "aprovado");
});

test("se a exclusão falha ao aprovar, o pedido continua esperando", async () => {
  await requestDeletionWith(
    db,
    T,
    {
      kind: "iss",
      targetId: "iss-ficticio",
      label: "Declaração de ISS",
      reason: "Duplicada",
      payload: [["id", "iss-ficticio"]],
    },
    { id: "u-escrevente" },
  );
  const [row] = (await listDeletionRequestsWith(db, T)).filter(
    (r) => r.kind === "iss",
  );
  await assert.rejects(
    decideDeletionWith(db, T, row?.id as string, true, "", { id: "u" }, () =>
      Promise.reject(new Error("não existe mais")),
    ),
  );
  const [still] = (await listDeletionRequestsWith(db, T)).filter(
    (r) => r.kind === "iss",
  );
  assert.equal(still?.status, "pendente");
});
