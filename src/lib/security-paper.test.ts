import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addLotWith,
  addMovementWith,
  classifierWith,
  issueReportWith,
  type LotInput,
  pendingDutiesWith,
  renderReportPdf,
  SecurityPaperError,
  snapshotOf,
  voidLotWith,
  voidMovementWith,
} from "./security-paper.ts";
import { claimSecurityPaperReminderWith } from "./security-paper-reminders.ts";

let db: Database;
let close: () => Promise<void>;
const TENANT = "cartorio-marinho";
const tenant = TENANTS[TENANT];

const lotInput = (over: Partial<LotInput> = {}): LotInput => ({
  kind: "traslado",
  kindLabel: "",
  prefix: "AB",
  first: 1,
  last: 200,
  digits: 6,
  receivedOn: "2026-07-01",
  opening: false,
  supplier: "",
  invoice: "",
  requisition: "",
  notes: "",
  ...over,
});

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("lote, uso por quantidade, conflito de numeração e anulação sem apagar", async () => {
  const lot = await addLotWith(db, TENANT, lotInput(), "titular");
  await assert.rejects(
    addLotWith(db, TENANT, lotInput({ first: 150, last: 300 }), "titular"),
    SecurityPaperError,
  );

  const used = await addMovementWith(
    db,
    TENANT,
    {
      lotId: lot.id,
      type: "utilizado",
      quantity: 50,
      occurredOn: "2026-08-03",
      reference: "Livro fictício 1",
      notes: "",
    },
    "escrevente",
  );
  assert.equal(used.firstNumber, 1);
  assert.equal(used.lastNumber, 50);

  // The same sheet twice: refused.
  await assert.rejects(
    addMovementWith(
      db,
      TENANT,
      {
        lotId: lot.id,
        type: "extraviado",
        first: 40,
        last: 40,
        occurredOn: "2026-08-04",
        reference: "teste",
        notes: "",
      },
      "escrevente",
    ),
    /já foram lançadas/,
  );

  const lost = await addMovementWith(
    db,
    TENANT,
    {
      lotId: lot.id,
      type: "extraviado",
      first: 51,
      last: 51,
      occurredOn: "2026-08-04",
      reference: "Extraviada no balcão (fictício)",
      notes: "",
    },
    "escrevente",
  );

  // A lot with movements is not voided; a movement is, and stays stored.
  await assert.rejects(
    voidLotWith(db, TENANT, lot.id, "cadastro errado", "titular"),
    /Anule os lançamentos/,
  );
  await voidMovementWith(db, TENANT, used.id, "lançado em dobro", "titular");
  const { movementRows, lots, movements } = await classifierWith(db, TENANT);
  assert.equal(movementRows.length, 2);
  assert.ok(movementRows.find((m) => m.id === used.id)?.voidedAt);
  assert.equal(lots.length, 1);
  assert.equal(movements.filter((m) => !m.voided).length, 1);
  assert.equal(lost.lastNumber, 51);

  const actions = (await db.select().from(auditLog)).map((r) => r.action);
  assert.ok(actions.includes("security-paper.loss"));
  assert.ok(actions.includes("security-paper.movement-void"));
});

test("ofícios numerados por ano, conteúdo congelado e lembretes que somem", async () => {
  const before = await pendingDutiesWith(db, TENANT, "2026-11-11");
  assert.equal(before.quarter?.quarter, 3);
  assert.equal(before.occurrences.length, 1);

  const now = new Date("2026-11-11T12:00:00Z");
  const signers = [{ name: "Fulana Fictícia", title: "Escrevente autorizada" }];
  const extravio = await issueReportWith(
    db,
    tenant,
    {
      kind: "extravio",
      period: { start: "2026-08-01", end: "2026-08-31" },
      issuedOn: "2026-11-11",
      notes: "",
      signerIndex: 0,
      signers,
    },
    "titular",
    now,
  );
  const prestacao = await issueReportWith(
    db,
    tenant,
    {
      kind: "prestacao",
      period: { start: "2026-07-01", end: "2026-09-30" },
      issuedOn: "2026-11-11",
      notes: "",
      signerIndex: 0,
      signers,
    },
    "titular",
    now,
  );
  assert.equal(extravio.sequence, 1);
  assert.equal(prestacao.sequence, 2);
  const snapshot = snapshotOf(prestacao);
  assert.deepEqual(snapshot.toldBy, ["001/2026"]);
  const row = snapshot.summary[0];
  assert.equal(row?.received, 200);
  assert.equal(row?.moved.extraviado, 1);
  assert.equal(row?.final, 199);

  // The report is not numbered; an empty extravio is refused.
  const report = await issueReportWith(
    db,
    tenant,
    {
      kind: "relatorio",
      period: { start: "2026-01-01", end: "2026-11-11" },
      issuedOn: "2026-11-11",
      notes: "",
      signerIndex: 0,
      signers,
    },
    "titular",
    now,
  );
  assert.equal(report.sequence, null);
  await assert.rejects(
    issueReportWith(
      db,
      tenant,
      {
        kind: "extravio",
        period: { start: "2026-09-01", end: "2026-09-30" },
        issuedOn: "2026-11-11",
        notes: "",
        signerIndex: 0,
        signers,
      },
      "titular",
      now,
    ),
    SecurityPaperError,
  );

  const after = await pendingDutiesWith(db, TENANT, "2026-11-11");
  assert.equal(after.quarter, null);
  assert.equal(after.occurrences.length, 0);

  const pdf = await PDFDocument.load(await renderReportPdf(tenant, prestacao));
  assert.ok(pdf.getPageCount() >= 2);
});

test("o lembrete por e-mail sai uma vez por trimestre e por mês", async () => {
  assert.equal(
    await claimSecurityPaperReminderWith(db, TENANT, "quarter", "2026-T3"),
    true,
  );
  assert.equal(
    await claimSecurityPaperReminderWith(db, TENANT, "quarter", "2026-T3"),
    false,
  );
  assert.equal(
    await claimSecurityPaperReminderWith(db, TENANT, "month", "2026-11"),
    true,
  );
  assert.equal(
    await claimSecurityPaperReminderWith(db, TENANT, "month", "2026-11"),
    false,
  );
  assert.equal(
    await claimSecurityPaperReminderWith(db, TENANT, "quarter", "2026-T4"),
    true,
  );
});
