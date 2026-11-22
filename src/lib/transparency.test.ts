import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { BulletinFigures } from "@/core/transparency/bulletin.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  tenantContent,
  transparencyBulletins,
  transparencyDocuments,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { OFFICE_BULLETIN_KEY } from "./office-config.ts";
import {
  getBulletinWith,
  makeCurrentFeeTableWith,
  removeBulletinWith,
  reorderDocumentsWith,
  saveBulletinOptionWith,
  storedBulletinOf,
  upsertBulletinWith,
} from "./transparency.ts";

const TENANT = "cartorio-canguaretama";
const ACTOR = "user-operadora";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

const FIGURES: BulletinFigures = {
  actsCount: 267,
  fundAmountsCents: {
    fdj: 123_456,
    frmp: 32_100,
    fcrcpn: 21_040,
    funaf: 9_810,
  },
  issCents: 61_200,
  grossRevenueCents: 797_812,
  expensesCents: 806_931,
};

async function rowsFor(month: string) {
  return db
    .select()
    .from(transparencyBulletins)
    .where(
      and(
        eq(transparencyBulletins.tenantSlug, TENANT),
        eq(transparencyBulletins.referenceMonth, month),
      ),
    );
}

test("a published bulletin reads back fund by fund, with ISS and private figures", async () => {
  await upsertBulletinWith(
    db,
    TENANT,
    { referenceMonth: "2026-01-01", figures: FIGURES, status: "preliminary" },
    ACTOR,
  );

  const [row] = await rowsFor("2026-01-01");
  assert.ok(row);
  assert.equal(row.taxesPaidCents, null);
  const again = await getBulletinWith(db, TENANT, row.id);
  assert.ok(again);
  assert.deepEqual(storedBulletinOf(again, "RN"), {
    kind: "current",
    figures: FIGURES,
  });
});

test("publishing the same month again replaces it, never a second row", async () => {
  const month = "2026-02-01";
  await upsertBulletinWith(
    db,
    TENANT,
    { referenceMonth: month, figures: FIGURES, status: "preliminary" },
    ACTOR,
  );
  await upsertBulletinWith(
    db,
    TENANT,
    {
      referenceMonth: month,
      figures: { ...FIGURES, issCents: 70_000 },
      status: "consolidated",
    },
    ACTOR,
  );

  const rows = await rowsFor(month);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "consolidated");
  assert.equal(rows[0].issCents, 70_000);
});

test("publishing with the option off stores no gross revenue or expenses", async () => {
  const month = "2026-03-01";
  await upsertBulletinWith(
    db,
    TENANT,
    {
      referenceMonth: month,
      figures: { ...FIGURES, grossRevenueCents: null, expensesCents: null },
      status: "consolidated",
    },
    ACTOR,
  );

  const [row] = await rowsFor(month);
  assert.equal(row.grossRevenueCents, null);
  assert.equal(row.expensesCents, null);
});

test("another office's bulletin id answers nothing", async () => {
  const [row] = await rowsFor("2026-01-01");
  assert.equal(
    await getBulletinWith(db, "cartorio-marinho", row.id),
    undefined,
  );
});

test("a row whose funds are not the state's reads as an error, not as zeros", async () => {
  const [row] = await rowsFor("2026-01-01");
  assert.equal(
    storedBulletinOf({ ...row, fundAmountsCents: { fdj: 100 } }, "RN"),
    null,
  );
  // No funds and no old total either: not an old bulletin, just broken.
  assert.equal(
    storedBulletinOf(
      { ...row, fundAmountsCents: {}, taxesPaidCents: null },
      "RN",
    ),
    null,
  );
});

/** A row as the code before Res. 670 wrote it, then migrated. */
async function insertLegacy(month: string): Promise<void> {
  await db.insert(transparencyBulletins).values({
    tenantSlug: TENANT,
    referenceMonth: month,
    actsCount: 267,
    grossRevenueCents: 797_812,
    taxesPaidCents: 265_259,
    expensesCents: 806_931,
    status: "consolidated",
  });
}

test("a bulletin from before the funds reads as the old format, not as an error", async () => {
  await insertLegacy("2025-01-01");
  const [row] = await rowsFor("2025-01-01");
  assert.deepEqual(row.fundAmountsCents, {});
  assert.deepEqual(storedBulletinOf(row, "RN"), {
    kind: "legacy",
    figures: {
      actsCount: 267,
      grossRevenueCents: 797_812,
      taxesPaidCents: 265_259,
      expensesCents: 806_931,
    },
  });
});

test("republishing an old month in the current format drops the old total", async () => {
  await insertLegacy("2025-02-01");
  await upsertBulletinWith(
    db,
    TENANT,
    { referenceMonth: "2025-02-01", figures: FIGURES, status: "consolidated" },
    ACTOR,
  );
  const rows = await rowsFor("2025-02-01");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].taxesPaidCents, null);
  assert.equal(storedBulletinOf(rows[0], "RN")?.kind, "current");
});

test("saving the option writes the override and leaves a trail", async () => {
  await saveBulletinOptionWith(db, TENANT, false, ACTOR);
  await saveBulletinOptionWith(db, TENANT, true, ACTOR);

  const rows = await db
    .select()
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, TENANT),
        eq(tenantContent.key, OFFICE_BULLETIN_KEY),
      ),
    );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].published, { publishBulletinPrivateFigures: true });

  const trail = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantSlug, TENANT),
        eq(auditLog.targetId, OFFICE_BULLETIN_KEY),
      ),
    );
  assert.equal(trail.length, 2);
  assert.equal(trail[0].actorId, ACTOR);
});

test("excluir um boletim tira do site sem apagar do banco; publicar de novo o traz de volta", async () => {
  const month = "2026-03-01";
  await upsertBulletinWith(
    db,
    TENANT,
    { referenceMonth: month, figures: FIGURES, status: "consolidated" },
    ACTOR,
  );
  const [row] = await rowsFor(month);
  assert.ok(row);
  assert.equal(await removeBulletinWith(db, TENANT, row.id, ACTOR), true);
  // Gone from the site and the list, still in the database.
  assert.equal(await getBulletinWith(db, TENANT, row.id), undefined);
  const [kept] = await rowsFor(month);
  assert.ok(kept?.removedAt);
  // A second "Excluir" finds nothing.
  assert.equal(await removeBulletinWith(db, TENANT, row.id, ACTOR), false);
  const acts = await db.select().from(auditLog);
  assert.ok(acts.some((a) => a.action === "transparency.bulletin.remove"));
  // Published again, corrected: back, same row.
  await upsertBulletinWith(
    db,
    TENANT,
    {
      referenceMonth: month,
      figures: { ...FIGURES, actsCount: 300 },
      status: "consolidated",
    },
    ACTOR,
  );
  const back = await getBulletinWith(db, TENANT, row.id);
  assert.equal(back?.actsCount, 300);
});

async function addDocument(
  tenantSlug: string,
  title: string,
  position: number,
  status = "published",
  category = "Tabela de emolumentos",
): Promise<string> {
  const [row] = await db
    .insert(transparencyDocuments)
    .values({
      tenantSlug,
      category,
      title,
      yearLabel: "2026",
      fileStoredName: `${title}.pdf`,
      fileDisplayName: `${title}.pdf`,
      filePath: `/tmp/${title}.pdf`,
      fileMimeType: "application/pdf",
      fileSizeBytes: 1000,
      status,
      position,
    })
    .returning({ id: transparencyDocuments.id });
  return row.id;
}

async function titlesInOrder(tenantSlug: string): Promise<string[]> {
  const rows = await db
    .select({
      title: transparencyDocuments.title,
      position: transparencyDocuments.position,
    })
    .from(transparencyDocuments)
    .where(eq(transparencyDocuments.tenantSlug, tenantSlug));
  return rows.sort((a, b) => a.position - b.position).map((r) => r.title);
}

test("arrastar reordena só os documentos mostrados, nas posições que já tinham", async () => {
  const office = "cartorio-arrastar";
  const a = await addDocument(office, "A", 1);
  const b = await addDocument(office, "B", 2, "published", "Relatório");
  const c = await addDocument(office, "C", 3);
  const d = await addDocument(office, "D", 4);
  // The list filtered to fee tables shows A, C, D; D is dragged to the top.
  assert.equal(await reorderDocumentsWith(db, office, [d, a, c]), true);
  assert.deepEqual(await titlesInOrder(office), ["D", "B", "A", "C"]);
  // Another office's id, or a repeated one, refuses the whole order.
  const other = await addDocument("cartorio-outro", "X", 1);
  assert.equal(await reorderDocumentsWith(db, office, [a, other]), false);
  assert.equal(await reorderDocumentsWith(db, office, [a, a]), false);
  assert.deepEqual(await titlesInOrder(office), ["D", "B", "A", "C"]);
  void b;
});

test("tornar vigente publica a tabela, leva ao topo e fica na auditoria", async () => {
  const office = "cartorio-vigente";
  await addDocument(office, "Tabela 2025", 1);
  await addDocument(office, "Relatório", 2, "published", "Relatório");
  const nova = await addDocument(office, "Tabela 2026", 3, "draft");
  assert.equal(
    await makeCurrentFeeTableWith(
      db,
      office,
      nova,
      "Tabela de emolumentos",
      ACTOR,
    ),
    true,
  );
  assert.deepEqual(await titlesInOrder(office), [
    "Tabela 2026",
    "Tabela 2025",
    "Relatório",
  ]);
  const [row] = await db
    .select({ status: transparencyDocuments.status })
    .from(transparencyDocuments)
    .where(eq(transparencyDocuments.id, nova));
  assert.equal(row?.status, "published");
  const audits = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantSlug, office),
        eq(auditLog.action, "transparency.document.current"),
      ),
    );
  assert.equal(audits.length, 1);
  // A document that is not a fee table is refused.
  const relatorio = await addDocument(office, "Outro", 4, "draft", "Relatório");
  assert.equal(
    await makeCurrentFeeTableWith(
      db,
      office,
      relatorio,
      "Tabela de emolumentos",
      ACTOR,
    ),
    false,
  );
});
