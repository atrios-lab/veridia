import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { addEntryWith } from "./daily-book.ts";
import {
  bookFiguresWith,
  findExcessWith,
  listExcessWith,
  removeExcessWith,
  renderExcessPdf,
  saveExcessWith,
} from "./daily-book-excess.ts";

let db: Database;
let close: () => Promise<void>;
const TENANT = "cartorio-marinho";
const calc = {
  period: "trimestral" as const,
  start: "2026-10-01",
  end: "2026-12-31",
  subsidyCents: 4_000_000,
  revenueCents: 15_000_000,
  expensesCents: 4_000_000,
  notes: "",
};

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("cálculo do excedente: salvar, editar, excluir sem apagar, PDF", async () => {
  const saved = await saveExcessWith(db, TENANT, calc, "titular");
  await saveExcessWith(
    db,
    TENANT,
    { ...calc, notes: "Corrigido (fictício)" },
    "titular",
    saved.id,
  );
  assert.equal(
    (await findExcessWith(db, TENANT, saved.id))?.notes,
    "Corrigido (fictício)",
  );
  const pdf = await renderExcessPdf(
    TENANTS[TENANT],
    (await findExcessWith(db, TENANT, saved.id)) ?? saved,
    "2027-01-05",
  );
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
  await removeExcessWith(db, TENANT, saved.id, "teste fictício", "titular");
  assert.equal((await listExcessWith(db, TENANT)).length, 0);
  const kept = await listExcessWith(db, TENANT, { withRemoved: true });
  assert.equal(kept[0]?.removeReason, "teste fictício");
  await assert.rejects(
    saveExcessWith(db, TENANT, { ...calc, subsidyCents: 0 }, "titular"),
    /subsídio/,
  );
});

test("preencher com o livro: sem a remuneração do interino", async () => {
  const base = {
    occurredOn: "2026-10-10",
    specialty: "",
    actCode: "",
    quantity: 1,
    fundsCents: 0,
    issCents: 0,
    supplier: "",
    documentRef: "",
    fiscalDistinct: false,
    fiscalNote: "",
    explanation: "",
  };
  await addEntryWith(
    db,
    TENANT,
    {
      ...base,
      kind: "receita",
      specialty: "Tabelionato de Notas",
      category: "",
      description: "Ato fictício",
      amountCents: 900_000,
    },
    "titular",
  );
  await addEntryWith(
    db,
    TENANT,
    {
      ...base,
      kind: "despesa",
      category: "locacao",
      description: "Aluguel fictício",
      amountCents: 200_000,
    },
    "titular",
  );
  await addEntryWith(
    db,
    TENANT,
    {
      ...base,
      kind: "despesa",
      category: "interino",
      description: "Remuneração fictícia",
      amountCents: 500_000,
    },
    "titular",
  );
  assert.deepEqual(
    await bookFiguresWith(db, TENANT, {
      start: "2026-10-01",
      end: "2026-12-31",
    }),
    { revenueCents: 900_000, expensesCents: 200_000 },
  );
});
