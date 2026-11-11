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
  issueIssDeclarationWith,
  listIssDeclarationsWith,
  pendingBulletinIssWith,
  removeIssDeclarationWith,
  renderIssDeclarationPdf,
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
    null,
    "titular",
    now,
  );
  const second = await issueIssDeclarationWith(
    db,
    TENANT,
    input("2026-10", 200_000),
    null,
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
    null,
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
    null,
    "titular",
    now,
  );
  assert.equal(again.sequence, 2);
});

test("o ISS vai para o boletim do mês, ou espera o boletim ser publicado", async () => {
  assert.equal(
    await applyIssToBulletinWith(db, TENANT, "2026-08", 4_321, "titular"),
    "pending",
  );
  assert.deepEqual(await pendingBulletinIssWith(db, TENANT), {
    "2026-08": 4_321,
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
    await applyIssToBulletinWith(db, TENANT, "2026-07", 9_999, "titular"),
    "updated",
  );
  const [row] = await db.select().from(transparencyBulletins);
  assert.equal(row.issCents, 9_999);
});

test("o PDF leva a declaração e, atrás, o livro anexo", async () => {
  const book = await PDFDocument.create();
  book.addPage();
  book.addPage();
  const stored = await storeOfficePdf(TENANT, Buffer.from(await book.save()));
  const row = await issueIssDeclarationWith(
    db,
    TENANT,
    input("2026-06", 50_000),
    { path: stored.path, name: "livro-junho.pdf" },
    "titular",
    new Date("2026-11-11T12:00:00Z"),
  );
  const pdf = await renderIssDeclarationPdf(
    tenant,
    row,
    defaultIssSettings(tenant),
  );
  const merged = await PDFDocument.load(pdf);
  // The declaration's own page(s), then the book's two pages.
  assert.ok(merged.getPageCount() >= 3);
});
