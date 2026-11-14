import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { emptyAct, emptyParty } from "@/core/censec/censec.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, censecActs } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  CensecError,
  censecQuinzenasWith,
  createCensecActWith,
  getCensecActWith,
  listCensecActsWith,
  listClosingsWith,
  recordClosingWith,
  removeCensecActWith,
  removeClosingWith,
  updateCensecActWith,
} from "./censec.ts";

// Fictitious office and people only (LGPD).
const OFFICE = "cartorio-censec";

function procuracao(date: string) {
  return {
    ...emptyAct("cep"),
    kind: "Procuracao",
    date,
    book: "10",
    page: "5",
    parties: [
      {
        ...emptyParty(),
        name: "Maria Fictícia",
        quality: "Outorgante",
        docType: "Cpf",
        docNumber: "529.982.247-25",
      },
    ],
  };
}

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("lança na quinzena da data, corrige e exclui com justificativa, sem apagar", async () => {
  const a = await createCensecActWith(
    db,
    OFFICE,
    procuracao("2026-11-03"),
    "traslados.pdf",
    "escrevente",
  );
  await createCensecActWith(
    db,
    OFFICE,
    procuracao("2026-11-20"),
    "",
    "escrevente",
  );
  // Without a date, the quinzena chosen in the sending.
  await createCensecActWith(
    db,
    OFFICE,
    procuracao(""),
    "",
    "escrevente",
    "2026-11-1",
  );
  await assert.rejects(
    createCensecActWith(db, OFFICE, procuracao(""), "", "escrevente"),
    CensecError,
  );
  assert.equal((await listCensecActsWith(db, OFFICE, "2026-11-1")).length, 2);
  assert.deepEqual(await censecQuinzenasWith(db, OFFICE), [
    { quinzena: "2026-11-2", count: 1 },
    { quinzena: "2026-11-1", count: 2 },
  ]);

  await assert.rejects(
    updateCensecActWith(
      db,
      OFFICE,
      a,
      procuracao("2026-11-18"),
      "escrevente",
      "",
    ),
    CensecError,
  );
  const moved = await updateCensecActWith(
    db,
    OFFICE,
    a,
    procuracao("2026-11-18"),
    "escrevente",
    "data corrigida",
  );
  assert.equal(moved, "2026-11-2");
  assert.equal((await getCensecActWith(db, OFFICE, a))?.quinzena, "2026-11-2");

  await removeCensecActWith(db, OFFICE, a, "escrevente", "lançado em dobro");
  assert.equal(await getCensecActWith(db, OFFICE, a), null);
  // Removed by a mark: the row stays.
  const [row] = await db.select().from(censecActs).where(eq(censecActs.id, a));
  assert.equal(row?.removedReason, "lançado em dobro");
  const actions = (
    await db.select().from(auditLog).where(eq(auditLog.targetId, a))
  ).map((r) => r.action);
  assert.deepEqual(actions.sort(), [
    "censec.create",
    "censec.edit",
    "censec.remove",
  ]);
});

test("fechamento positivo ou negativo, e a exclusão do registro com justificativa", async () => {
  const office = "cartorio-censec-fechamento";
  const id = await recordClosingWith(
    db,
    office,
    {
      quinzena: "2026-11-1",
      central: "rcto",
      acts: 0,
      sentOn: "2026-11-19",
      protocol: "R001",
    },
    "escrevente",
  );
  await assert.rejects(
    recordClosingWith(
      db,
      office,
      {
        quinzena: "2026-11-1",
        central: "x",
        acts: 0,
        sentOn: "2026-11-19",
        protocol: "",
      },
      "escrevente",
    ),
    CensecError,
  );
  const [closing] = await listClosingsWith(db, office, "2026-11-1");
  assert.equal(closing?.acts, 0);
  assert.equal(closing?.protocol, "R001");
  await removeClosingWith(
    db,
    office,
    id,
    "escrevente",
    "registrado na quinzena errada",
  );
  assert.equal((await listClosingsWith(db, office, "2026-11-1")).length, 0);
});
