import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/index.ts";
import { auditLog, transparencyDocuments } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  currentFeeTableWith,
  FEE_TABLE_CATEGORY,
  readFeeTablesWith,
  saveFeeTableItemsWith,
} from "./fee-tables.ts";

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

async function insertDocument(
  tenantSlug: string,
  fields: {
    title: string;
    category?: string;
    status: string;
    position: number;
  },
): Promise<string> {
  const [row] = await db
    .insert(transparencyDocuments)
    .values({
      tenantSlug,
      category: fields.category ?? FEE_TABLE_CATEGORY,
      title: fields.title,
      yearLabel: "2026",
      fileStoredName: "tabela.pdf",
      fileDisplayName: "tabela.pdf",
      filePath: "/tmp/tabela.pdf",
      fileMimeType: "application/pdf",
      fileSizeBytes: 1000,
      status: fields.status,
      position: fields.position,
    })
    .returning({ id: transparencyDocuments.id });
  return row.id;
}

const RI = { code: "2600103", description: "Prenotação", totalCents: 5790 };

test("the table in force is the first published fee table, with its items", async () => {
  const tenant = "cartorio-vigente";
  await insertDocument(tenant, {
    title: "Relatório",
    category: "Relatórios",
    status: "published",
    position: 0,
  });
  const draft = await insertDocument(tenant, {
    title: "Tabela 2027 (rascunho)",
    status: "draft",
    position: 1,
  });
  const current = await insertDocument(tenant, {
    title: "Tabela 2026",
    status: "published",
    position: 2,
  });
  const old = await insertDocument(tenant, {
    title: "Tabela 2025",
    status: "published",
    position: 3,
  });
  await saveFeeTableItemsWith(db, tenant, current, { RI }, "manual", "op");
  await saveFeeTableItemsWith(
    db,
    tenant,
    old,
    { RI: { ...RI, totalCents: 5000 } },
    "pdf",
    null,
  );
  await saveFeeTableItemsWith(
    db,
    tenant,
    draft,
    { RI: { ...RI, totalCents: 6100 } },
    "manual",
    "op",
  );

  const table = await currentFeeTableWith(db, tenant);
  assert.equal(table?.document.title, "Tabela 2026");
  assert.deepEqual(table?.items, { RI });
});

test("saving one table keeps the others' values", async () => {
  const tenant = "cartorio-duas-tabelas";
  await saveFeeTableItemsWith(db, tenant, "a", { RI }, "pdf", null);
  await saveFeeTableItemsWith(
    db,
    tenant,
    "b",
    { RTD: { ...RI, code: "2700105" } },
    "manual",
    "op",
  );
  const tables = await readFeeTablesWith(db, tenant);
  assert.deepEqual(Object.keys(tables).sort(), ["a", "b"]);
  assert.equal(tables.a.source, "pdf");
  assert.deepEqual(tables.a.items, { RI });
  assert.equal(tables.b.source, "manual");

  const audits = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantSlug, tenant),
        eq(auditLog.action, "fee-table.items"),
      ),
    );
  assert.equal(audits.length, 2);
});

test("an office without a published fee table has nothing in force", async () => {
  const tenant = "cartorio-sem-tabela";
  await insertDocument(tenant, {
    title: "Tabela (rascunho)",
    status: "draft",
    position: 0,
  });
  assert.equal(await currentFeeTableWith(db, tenant), undefined);
});

test("a published table without saved values prices nothing yet", async () => {
  const tenant = "cartorio-tabela-vazia";
  await insertDocument(tenant, {
    title: "Tabela 2026",
    status: "published",
    position: 0,
  });
  const table = await currentFeeTableWith(db, tenant);
  assert.equal(table?.document.title, "Tabela 2026");
  assert.deepEqual(table?.items, {});
});
