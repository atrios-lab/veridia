import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  cancelHabilitacaoWith,
  createHabilitacaoWith,
  getHabilitacaoWith,
  HabilitacaoError,
  listHabilitacoesWith,
  markEditalWith,
  restoreHabilitacaoWith,
  saveHabilitacaoWith,
} from "./rcpn-habilitacao.ts";

// Fictitious office and nubentes only (LGPD).
const OFFICE = "cartorio-habilitacao";
const NOW = new Date("2026-11-14T12:00:00Z");

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => close());

test("abre com o número do ano, altera com justificativa e guarda o histórico", async () => {
  await assert.rejects(
    createHabilitacaoWith(
      db,
      OFFICE,
      { regime: "comunhao-parcial" },
      "escrevente",
      NOW,
    ),
    HabilitacaoError,
  );
  const id = await createHabilitacaoWith(
    db,
    OFFICE,
    {
      "n1.nome": "Ana Exemplo",
      "n2.nome": "Bia Modelo",
      "n1.nascimento": "02/03/1995",
    },
    "escrevente",
    NOW,
  );
  const second = await createHabilitacaoWith(
    db,
    OFFICE,
    { "n1.nome": "Caio Teste", "n2.nome": "Davi Teste" },
    "escrevente",
    NOW,
  );
  const list = await listHabilitacoesWith(db, OFFICE);
  assert.deepEqual(
    list.map((h) => h.number),
    ["2/2026", "1/2026"],
  );
  assert.equal(list[1]?.id, id);
  assert.equal(list[0]?.id, second);

  await assert.rejects(
    saveHabilitacaoWith(
      db,
      OFFICE,
      id,
      { regime: "comunhao-universal" },
      "escrevente",
      "",
    ),
    /justificativa/,
  );
  const changed = await saveHabilitacaoWith(
    db,
    OFFICE,
    id,
    {
      "n1.nome": "Ana Exemplo",
      regime: "separacao-convencional",
      pacto: "Escritura fictícia",
    },
    "escrevente",
    "Nubentes trouxeram o pacto.",
  );
  assert.equal(changed, 2, "o nome igual não conta");
  const found = await getHabilitacaoWith(db, OFFICE, id);
  assert.equal(found?.values.regime, "separacao-convencional");
  assert.equal(found?.values["n1.nascimento"], "1995-03-02");
  assert.deepEqual(
    found?.history.map((h) => h.kind),
    ["edicao", "abertura"],
  );
});

test("edital publicado, cancelamento e estorno, sem apagar nada", async () => {
  const [first] = (await listHabilitacoesWith(db, OFFICE)).slice(-1);
  const id = first?.id ?? "";
  await markEditalWith(
    db,
    OFFICE,
    id,
    "00000000-0000-4000-8000-000000000001",
    "2026-11-14",
    "escrevente",
  );
  let found = await getHabilitacaoWith(db, OFFICE, id);
  assert.equal(found?.values.editalEm, "2026-11-14");
  assert.equal(found?.publicationId, "00000000-0000-4000-8000-000000000001");

  await cancelHabilitacaoWith(
    db,
    OFFICE,
    id,
    "tabeliao",
    "Desistência dos nubentes.",
  );
  await assert.rejects(
    saveHabilitacaoWith(
      db,
      OFFICE,
      id,
      { observacoes: "x" },
      "escrevente",
      "teste",
    ),
    /cancelado/,
  );
  await assert.rejects(
    cancelHabilitacaoWith(db, OFFICE, id, "tabeliao", "de novo"),
    /já está cancelado/,
  );
  await restoreHabilitacaoWith(
    db,
    OFFICE,
    id,
    "tabeliao",
    "Cancelado por engano.",
  );
  found = await getHabilitacaoWith(db, OFFICE, id);
  assert.equal(found?.canceledAt, null);
  assert.deepEqual(found?.history.map((h) => h.kind).sort(), [
    "abertura",
    "cancelamento",
    "edicao",
    "edital",
    "estorno",
  ]);
  const audit = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(eq(auditLog.targetId, "1/2026"));
  assert.deepEqual(audit.map((a) => a.action).sort(), [
    "rcpn.habilitacao.cancel",
    "rcpn.habilitacao.create",
    "rcpn.habilitacao.edit",
    "rcpn.habilitacao.edital",
    "rcpn.habilitacao.restore",
  ]);
});
