import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { defaultIssSettings } from "@/core/iss/declaration.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { transparencyBulletins } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  applyIssToBulletinWith,
  inputOf,
  issueIssDeclarationWith,
  listIssDeclarationsWith,
  pendingBulletinsWith,
  recordIssFilingWith,
  removeIssDeclarationWith,
  renderIssDeclarationPdf,
  renderIssReceiptPdf,
  updateIssDeclarationWith,
} from "./iss-declarations.ts";
import { storeOfficePdf } from "./uploads.ts";

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "iss-"));

let db: Database;
let close: () => Promise<void>;
const TENANT = "cartorio-marinho";
const tenant = TENANTS[TENANT];
const input = (competence: string, emolumentsCents: number) => ({
  competence,
  emolumentsCents,
  rateBasisPoints: 500,
  damNumber: "",
  dueDate: "",
  paidOn: "",
  notes: "",
  issCents: null,
  signer: 0,
});

before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

test("numeração anual, correção e exclusão que libera o número", async () => {
  const now = new Date("2026-11-11T12:00:00Z");
  const first = await issueIssDeclarationWith(
    db,
    TENANT,
    input("2026-09", 100_000),
    [],
    "titular",
    now,
  );
  const second = await issueIssDeclarationWith(
    db,
    TENANT,
    input("2026-10", 200_000),
    [],
    "titular",
    now,
  );
  assert.deepEqual([first.sequence, second.sequence], [1, 2]);
  assert.equal(second.issCents, 10_000);
  const fixed = await updateIssDeclarationWith(
    db,
    TENANT,
    second.id,
    input("2026-10", 300_000),
    [],
    "titular",
    now,
  );
  assert.equal(fixed.issCents, 15_000);
  await removeIssDeclarationWith(db, TENANT, second.id, "titular", now);
  assert.deepEqual(
    (await listIssDeclarationsWith(db, TENANT)).map((r) => r.id),
    [first.id],
  );
  const again = await issueIssDeclarationWith(
    db,
    TENANT,
    input("2026-10", 300_000),
    [],
    "titular",
    now,
  );
  assert.equal(again.sequence, 2);
});

test("o ISS vai para o boletim do mês, ou espera o boletim ser publicado", async () => {
  assert.equal(
    await applyIssToBulletinWith(
      db,
      TENANT,
      "2026-08",
      { issCents: 4_321 },
      "titular",
    ),
    "pending",
  );
  // Fictitious figures, as read from a productivity report.
  const read = {
    issCents: 9_000,
    actsCount: 120,
    fundAmountsCents: {
      fdj: 50_000,
      frmp: 15_000,
      fcrcpn: 16_000,
      funaf: 2_500,
    },
    grossRevenueCents: 292_500,
    expensesCents: 750_000,
  };
  assert.equal(
    await applyIssToBulletinWith(db, TENANT, "2026-09", read, "titular"),
    "pending",
  );
  assert.deepEqual(await pendingBulletinsWith(db, TENANT), {
    "2026-08": { issCents: 4_321 },
    "2026-09": read,
  });
  // A correction with only the ISS keeps the report's other figures.
  await applyIssToBulletinWith(
    db,
    TENANT,
    "2026-09",
    { issCents: 9_100 },
    "titular",
  );
  assert.deepEqual((await pendingBulletinsWith(db, TENANT))["2026-09"], {
    ...read,
    issCents: 9_100,
  });
  await db.insert(transparencyBulletins).values({
    tenantSlug: TENANT,
    referenceMonth: "2026-07-01",
    actsCount: 10,
    fundAmountsCents: { fdj: 1, frmp: 1, fcrcpn: 1, funaf: 1 },
    issCents: 0,
    status: "preliminary",
  });
  assert.equal(
    await applyIssToBulletinWith(
      db,
      TENANT,
      "2026-07",
      { issCents: 9_999, actsCount: 1 },
      "titular",
    ),
    "updated",
  );
  const [row] = await db.select().from(transparencyBulletins);
  assert.equal(row.issCents, 9_999);
  // Only the ISS changes in a published month.
  assert.equal(row.actsCount, 10);
});

test("o ISS ato a ato do relatório fica como foi informado", async () => {
  const row = await issueIssDeclarationWith(
    db,
    TENANT,
    { ...input("2026-05", 200_000), issCents: 9_000 },
    [],
    "titular",
    new Date("2026-11-11T12:00:00Z"),
  );
  assert.equal(row.issCents, 9_000);
  assert.equal(row.issFromReport, true);
  assert.equal(inputOf(row).issCents, 9_000);
});

test("o PDF leva a declaração e, atrás, o livro e o relatório anexos", async () => {
  const book = await PDFDocument.create();
  book.addPage();
  book.addPage();
  const stored = await storeOfficePdf(TENANT, Buffer.from(await book.save()));
  const one = await PDFDocument.create();
  one.addPage();
  const report = await storeOfficePdf(TENANT, Buffer.from(await one.save()));
  const row = await issueIssDeclarationWith(
    db,
    TENANT,
    input("2026-06", 50_000),
    [
      { path: stored.path, name: "livro-junho.pdf" },
      { path: report.path, name: "produtividade-junho.pdf" },
    ],
    "titular",
    new Date("2026-11-11T12:00:00Z"),
  );
  const pdf = await renderIssDeclarationPdf(
    tenant,
    row,
    defaultIssSettings(tenant),
  );
  const merged = await PDFDocument.load(pdf);
  // The declaration's own page(s), the book's two pages, the report's one.
  assert.ok(merged.getPageCount() >= 4);
});

test("entrega anotada (data e protocolo) e protocolo da SEMUT em PDF", async () => {
  const row = await issueIssDeclarationWith(
    db,
    TENANT,
    input("2026-04", 80_000),
    [],
    "titular",
    new Date("2026-11-11T12:00:00Z"),
  );
  await recordIssFilingWith(
    db,
    TENANT,
    row.id,
    { filedOn: "2026-11-11", reference: " 123/2026 (fictício) " },
    "titular",
  );
  const [saved] = (await listIssDeclarationsWith(db, TENANT)).filter(
    (r) => r.id === row.id,
  );
  assert.equal(saved.filedOn, "2026-11-11");
  assert.equal(saved.filingReference, "123/2026 (fictício)");
  const pdf = await renderIssReceiptPdf(
    tenant,
    saved,
    defaultIssSettings(tenant),
  );
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
});
