import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { SettingsSchema, summarize } from "@/core/daily-book/book.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addEntryWith,
  DailyBookError,
  entryOf,
  importProductivityWith,
  issueBookReportWith,
  listEntriesWith,
  numberSheetsWith,
  removeBookReportWith,
  removeEntryWith,
  renderBookPdf,
  saveBookSettingsWith,
  snapshotOf,
  updateBookReportWith,
  updateEntryWith,
} from "./daily-book.ts";

let db: Database;
let close: () => Promise<void>;
const TENANT = "cartorio-marinho";
const tenant = TENANTS[TENANT];
const OCT = { start: "2026-10-01", end: "2026-10-31" };
const line = (amountCents: number) => ({
  code: "2200569",
  description: "Reconhecimento de firma",
  quantity: 10,
  amountCents,
  fundsCents: 0,
  issCents: 210,
  specialty: "Tabelionato de Notas",
  explanation: "",
});
const expense = {
  kind: "despesa" as const,
  occurredOn: "2026-10-10",
  specialty: "",
  category: "locacao",
  actCode: "",
  description: "Aluguel do imóvel da serventia (fictício)",
  quantity: 1,
  amountCents: 50000,
  fundsCents: 0,
  issCents: 0,
  supplier: "Imobiliária Exemplo",
  documentRef: "Recibo 1",
  fiscalDistinct: false,
  fiscalNote: "",
  explanation: "",
};

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("relatório do dia lançado; repetir pede substituir; substituir guarda o antigo", async () => {
  const day = { start: "2026-10-05", end: "2026-10-05" };
  await importProductivityWith(
    db,
    TENANT,
    { ...day, lines: [line(4210)], replace: false },
    "escrevente",
  );
  await assert.rejects(
    importProductivityWith(
      db,
      TENANT,
      { ...day, lines: [line(5000)], replace: false },
      "escrevente",
    ),
    DailyBookError,
  );
  await importProductivityWith(
    db,
    TENANT,
    { ...day, lines: [line(5000)], replace: true },
    "escrevente",
  );
  const live = await listEntriesWith(db, TENANT, OCT);
  assert.deepEqual(
    live.map((r) => r.amountCents),
    [5000],
  );
  assert.equal(
    (await listEntriesWith(db, TENANT, OCT, { withRemoved: true })).length,
    2,
  );
});

test("despesa: lançar, editar, excluir sem apagar; categoria obrigatória", async () => {
  await assert.rejects(
    addEntryWith(db, TENANT, { ...expense, category: "" }, "titular"),
    /categoria/,
  );
  const row = await addEntryWith(db, TENANT, expense, "titular");
  await updateEntryWith(
    db,
    TENANT,
    row.id,
    { ...expense, amountCents: 60000, explanation: "valor corrigido" },
    "titular",
  );
  const [edited] = (await listEntriesWith(db, TENANT, OCT)).filter(
    (r) => r.kind === "despesa",
  );
  assert.equal(edited?.amountCents, 60000);
  assert.equal(edited?.explanation, "valor corrigido");
  const other = await addEntryWith(
    db,
    TENANT,
    { ...expense, amountCents: 100 },
    "titular",
  );
  await removeEntryWith(db, TENANT, other.id, "lançado em dobro", "titular");
  assert.equal(
    (await listEntriesWith(db, TENANT, OCT)).filter((r) => r.kind === "despesa")
      .length,
    1,
  );
});

test("página do mês congela os lançamentos; refazer traz os de agora; balanço do ano", async () => {
  const signers = [{ name: "Fulana Fictícia", title: "Escrevente" }];
  const page = await issueBookReportWith(
    db,
    TENANT,
    {
      kind: "mes",
      ...OCT,
      issuedOn: "2026-11-02",
      notes: "",
      signerIndex: 0,
      signers,
    },
    "titular",
  );
  const frozen = snapshotOf(page);
  assert.equal(frozen.entries.length, 2);
  await addEntryWith(
    db,
    TENANT,
    { ...expense, occurredOn: "2026-10-20", amountCents: 1000 },
    "titular",
  );
  await updateBookReportWith(
    db,
    TENANT,
    page.id,
    {
      issuedOn: "2026-11-03",
      notes: "refeito",
      signerIndex: 0,
      signers,
      refresh: true,
    },
    "titular",
  );
  const year = await issueBookReportWith(
    db,
    TENANT,
    {
      kind: "ano",
      start: "2026-01-01",
      end: "2026-12-31",
      issuedOn: "2027-01-05",
      notes: "",
      signerIndex: 0,
      signers,
    },
    "titular",
  );
  const october = snapshotOf(year).months.find((m) => m.month === "2026-10");
  assert.deepEqual(october, {
    month: "2026-10",
    revenueCents: 5000,
    expensesCents: 61000,
  });
  const pdf = await PDFDocument.load(await renderBookPdf(tenant, page));
  assert.ok(pdf.getPageCount() >= 1);
  const [first] = await listEntriesWith(db, TENANT, OCT);
  assert.ok(first);
  assert.equal(entryOf(first).kind, "receita");
});

test("art. 190: relatório de vários dias é recusado; a identificação do ato vai para a linha", async () => {
  await assert.rejects(
    importProductivityWith(
      db,
      TENANT,
      {
        start: "2026-09-01",
        end: "2026-09-30",
        lines: [line(100)],
        replace: false,
      },
      "titular",
    ),
    /no dia da prática do ato/,
  );
  await importProductivityWith(
    db,
    TENANT,
    {
      start: "2026-09-03",
      end: "2026-09-03",
      lines: [{ ...line(100), identification: "Livro 7, fls. 12 a 21" }],
      replace: false,
    },
    "titular",
  );
  const [row] = await listEntriesWith(db, TENANT, {
    start: "2026-09-03",
    end: "2026-09-03",
  });
  assert.equal(row?.occurredOn, "2026-09-03");
  assert.equal(row?.documentRef, "Livro 7, fls. 12 a 21");
});

test("art. 186: folhas numeradas em sequência; folha usada não volta; termo de encerramento", async () => {
  const signers = [{ name: "Fulana Fictícia", title: "Escrevente" }];
  await saveBookSettingsWith(
    db,
    TENANT,
    SettingsSchema.parse({ bookNumber: 4, sheetCount: 3 }),
    "titular",
  );
  const issue = (day: string) =>
    issueBookReportWith(
      db,
      TENANT,
      {
        kind: "dia",
        start: day,
        end: day,
        issuedOn: day,
        notes: "",
        signerIndex: 0,
        signers,
      },
      "titular",
    );
  const one = await issue("2026-10-05");
  const a = await numberSheetsWith(db, tenant, one.id);
  assert.equal(a?.first, 1);
  const two = await issue("2026-10-06");
  const b = await numberSheetsWith(db, tenant, two.id);
  assert.equal(b?.first, (a?.last ?? 0) + 1);
  await removeBookReportWith(db, TENANT, two.id, "teste fictício", "titular");
  const three = await issue("2026-10-07");
  const c = await numberSheetsWith(db, tenant, three.id);
  assert.equal(c?.first, (b?.last ?? 0) + 1);
  assert.equal(c?.overflow, (c?.last ?? 0) > 3);
  // Edited, the page keeps its first sheet.
  const again = await numberSheetsWith(db, tenant, one.id);
  assert.equal(again?.first, 1);
  const closing = await issueBookReportWith(
    db,
    TENANT,
    {
      kind: "encerramento",
      start: "2026-10-31",
      end: "2026-10-31",
      issuedOn: "2026-10-31",
      notes: "",
      signerIndex: 0,
      signers,
    },
    "titular",
  );
  assert.deepEqual(snapshotOf(closing).book, {
    number: 4,
    sheetCount: 3,
    lastSheet: c?.last,
  });
  const pdf = await PDFDocument.load(await renderBookPdf(tenant, closing));
  assert.equal(pdf.getPageCount(), 1);
});

test("art. 194: depósito com a conta, fora da receita e da despesa; apuração trimestral", async () => {
  await assert.rejects(
    addEntryWith(
      db,
      TENANT,
      { ...expense, kind: "deposito", category: "", documentRef: "" },
      "titular",
    ),
    /conta/,
  );
  await addEntryWith(
    db,
    TENANT,
    {
      ...expense,
      kind: "deposito",
      category: "",
      occurredOn: "2026-12-20",
      description: "Excedente fictício",
      documentRef: "Conta judicial fictícia 0001",
      amountCents: 7000,
    },
    "titular",
  );
  await saveBookSettingsWith(
    db,
    TENANT,
    SettingsSchema.parse({
      interim: true,
      ceilingCents: 1000,
      interimPeriod: "trimestral",
    }),
    "titular",
  );
  const signers = [{ name: "Fulana Fictícia", title: "Escrevente" }];
  const month = (start: string, end: string) =>
    issueBookReportWith(
      db,
      TENANT,
      {
        kind: "mes",
        start,
        end,
        issuedOn: end,
        notes: "",
        signerIndex: 0,
        signers,
      },
      "titular",
    );
  const november = snapshotOf(await month("2026-11-01", "2026-11-30"));
  assert.equal(november.interim, null);
  const december = snapshotOf(await month("2026-12-01", "2026-12-31"));
  assert.ok(december.interim && "period" in december.interim);
  assert.equal(december.interim.start, "2026-10-01");
  assert.equal(december.interim.months, 3);
  assert.equal(december.interim.depositsCents, 7000);
  assert.equal(summarize(december.entries).depositsCents, 7000);
  assert.equal(summarize(december.entries).expensesCents, 0);
});
