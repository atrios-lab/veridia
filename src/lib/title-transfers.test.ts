import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  emptyTransfer,
  type TitleTransfer,
} from "@/core/titularidade/titularidade.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  competencesWith,
  createFilingWith,
  createTransferWith,
  listFilingsWith,
  listTransfersWith,
  markDoiSentWith,
  markSentWith,
  refreshFilingWith,
  removeTransferWith,
  renumberFilingWith,
  TitularidadeError,
  updateTransferWith,
} from "./title-transfers.ts";

// Fictitious office and parties only (LGPD).
const OFFICE = "cartorio-titularidade";
const CPF = "529.982.247-25";

function act(date: string, operation = "11"): TitleTransfer {
  return {
    ...emptyTransfer("notas"),
    actDate: date,
    operation,
    matricula: "1.234",
    transmitentes: [{ name: "Maria Fictícia", taxId: CPF, share: "" }],
    adquirentes: [{ name: "João Modelo", taxId: "", share: "" }],
  };
}

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => close());

test("lança por mês, corrige e exclui com justificativa", async () => {
  await assert.rejects(
    createTransferWith(db, OFFICE, emptyTransfer(), "", "escrevente"),
    TitularidadeError,
  );
  const a = await createTransferWith(
    db,
    OFFICE,
    act("2026-10-20"),
    "escritura.pdf",
    "escrevente",
  );
  await createTransferWith(
    db,
    OFFICE,
    act("2026-10-05", "67"),
    "",
    "escrevente",
  );
  await createTransferWith(db, OFFICE, act("2026-09-30"), "", "escrevente");
  const october = await listTransfersWith(db, OFFICE, "2026-10");
  assert.deepEqual(
    october.map((t) => t.transfer.actDate),
    ["2026-10-05", "2026-10-20"],
    "na ordem dos atos",
  );
  assert.deepEqual(await competencesWith(db, OFFICE), [
    { competence: "2026-10", count: 2 },
    { competence: "2026-09", count: 1 },
  ]);
  await assert.rejects(
    updateTransferWith(db, OFFICE, a, act("2026-11-02"), "escrevente", ""),
    /justificativa/,
  );
  await updateTransferWith(
    db,
    OFFICE,
    a,
    act("2026-11-02"),
    "escrevente",
    "Data errada.",
  );
  assert.equal(
    (await listTransfersWith(db, OFFICE, "2026-11")).length,
    1,
    "muda de mês",
  );
  await removeTransferWith(
    db,
    OFFICE,
    a,
    "tabeliao",
    "Lançado em duplicidade.",
  );
  assert.equal((await listTransfersWith(db, OFFICE, "2026-11")).length, 0);
  const audit = await db
    .select({ action: auditLog.action, reason: auditLog.reason })
    .from(auditLog)
    .where(eq(auditLog.targetId, a));
  assert.deepEqual(audit.map((r) => r.action).sort(), [
    "titularidade.create",
    "titularidade.edit",
    "titularidade.remove",
  ]);
});

test("ofício numerado com os atos do mês, ou sem movimento, e o envio", async () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const id = await createFilingWith(
    db,
    OFFICE,
    "2026-10",
    "2026-11-14",
    "escrevente",
    now,
  );
  await createFilingWith(
    db,
    OFFICE,
    "2026-08",
    "2026-11-14",
    "escrevente",
    now,
  );
  const [empty, october] = await listFilingsWith(db, OFFICE);
  assert.equal(october?.number, "001/2026");
  assert.equal(october?.transfers.length, 1);
  assert.equal(empty?.number, "002/2026");
  assert.equal(empty?.transfers.length, 0, "sem movimento");
  await assert.rejects(
    markSentWith(
      db,
      OFFICE,
      id,
      { sentOn: "", channel: "", receipt: "" },
      "escrevente",
    ),
    /data do envio/,
  );
  await assert.rejects(
    markSentWith(
      db,
      OFFICE,
      id,
      { sentOn: "2026-11-20", channel: "Protocolo na SEMUT", receipt: "123" },
      "escrevente",
    ),
    /plataforma/,
    "só a plataforma vale como envio (§ 2º)",
  );
  await assert.rejects(
    markSentWith(
      db,
      OFFICE,
      id,
      { sentOn: "2026-11-20", channel: "cnb", receipt: "" },
      "escrevente",
    ),
    /recibo de entrega/,
  );
  await markSentWith(
    db,
    OFFICE,
    id,
    {
      sentOn: "2026-11-20",
      channel: "cnb",
      receipt: "CNB-2026-000123",
      receiptFile: { path: "titularidade/recibo.pdf", name: "recibo.pdf" },
      semutOn: "2026-11-21",
      semutReceipt: "Protocolo 45/2026",
    },
    "escrevente",
  );
  const sent = (await listFilingsWith(db, OFFICE)).find((f) => f.id === id);
  assert.equal(sent?.receipt, "CNB-2026-000123");
  assert.equal(sent?.receiptName, "recibo.pdf");
  assert.equal(sent?.semutReceipt, "Protocolo 45/2026");
});

test("editar o ofício com os atos atuais e modificar a numeração", async () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const id = await createFilingWith(
    db,
    OFFICE,
    "2026-09",
    "2026-11-14",
    "escrevente",
    now,
  );
  await createTransferWith(db, OFFICE, act("2026-09-10"), "", "escrevente");
  await refreshFilingWith(
    db,
    OFFICE,
    id,
    "2026-11-15",
    "escrevente",
    "Faltava um ato.",
  );
  let filing = (await listFilingsWith(db, OFFICE)).find((f) => f.id === id);
  assert.equal(filing?.issuedOn, "2026-11-15");
  assert.equal(filing?.transfers.length, 2);
  await assert.rejects(
    renumberFilingWith(db, OFFICE, id, 1, "tabeliao", "Ajuste."),
    /já é de outro ofício/,
  );
  await renumberFilingWith(
    db,
    OFFICE,
    id,
    40,
    "tabeliao",
    "Seguir a numeração do livro.",
  );
  filing = (await listFilingsWith(db, OFFICE)).find((f) => f.id === id);
  assert.equal(filing?.number, "040/2026");
});

test("DOI entregue na hora da escritura: marca, e desmarca só com justificativa", async () => {
  const office = "cartorio-doi-entregue";
  const id = await createTransferWith(
    db,
    office,
    act("2026-08-10"),
    "",
    "escrevente",
  );
  await assert.rejects(
    markDoiSentWith(db, office, id, { sentOn: "", receipt: "" }, "escrevente"),
    TitularidadeError,
  );
  await markDoiSentWith(
    db,
    office,
    id,
    { sentOn: "2026-08-10", receipt: "123" },
    "escrevente",
  );
  let [stored] = await listTransfersWith(db, office, "2026-08");
  assert.equal(stored?.transfer.doi?.sentOn, "2026-08-10");
  assert.equal(stored?.transfer.doi?.receipt, "123");
  await assert.rejects(
    markDoiSentWith(db, office, id, null, "escrevente", ""),
    TitularidadeError,
  );
  await markDoiSentWith(
    db,
    office,
    id,
    null,
    "escrevente",
    "marcada no ato errado",
  );
  [stored] = await listTransfersWith(db, office, "2026-08");
  assert.equal(stored?.transfer.doi?.sentOn, "");
});
