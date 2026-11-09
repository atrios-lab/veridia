import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import {
  prenotationCodesFor,
  readPrenotationTable,
} from "@/core/fees/prenotation.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, transparencyDocuments } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  currentFeeTableWith,
  FEE_TABLE_CATEGORY,
  pdfTableText,
  readFeeTablesWith,
  saveFeeTableItemsWith,
  trustedItems,
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

/**
 * A fee table as a real PDF: a grid of cells, drawn a column at a time (the
 * order that scatters a row the most when the text is read as it comes),
 * with a description that wraps inside its cell and the total centred on
 * it. `rotated` draws the whole table turned on its side, as a landscape
 * table in a portrait file.
 */
async function tablePdf(rotated = false): Promise<Uint8Array> {
  const rows: string[][] = [
    ["Código", "Descrição", "Emolumento", "FDJ", "FRMP", "Total"],
    ["", "REGISTRO CIVIL DAS PESSOAS JURÍDICAS", "", "", "", ""],
    ["2400104", "Certidão", "20,00", "3,00", "2,00", "25,00"],
    ["2400105", "Prenotação", "25,21", "3,78", "2,52", "31,51"],
    ["", "REGISTRO DE TÍTULOS E DOCUMENTOS", "", "", "", ""],
    [
      "2500140",
      "Prenotação de título ou documento, para registro, averbação ou anotação",
      "46,32",
      "6,95",
      "4,63",
      "57,90",
    ],
    ["", "REGISTRO DE IMÓVEIS", "", "", "", ""],
    ["2600102", "Busca por período", "10,00", "1,50", "1,00", "12,50"],
    ["2600103", "Prenotação", "46,32", "6,95", "4,63", "57,90"],
  ];
  const widths = [60, 200, 70, 50, 50, 60];
  const rowHeight = 30;
  const doc = new PDFDocument({ size: "A4", margin: 20 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", resolve));
  if (rotated) {
    doc.rotate(-90, { origin: [300, 300] });
  }
  doc.fontSize(9);
  let x = 30;
  widths.forEach((width, column) => {
    rows.forEach((row, index) => {
      const text = row[column];
      if (!text) return;
      // The amounts of the row whose description wraps sit centred on its
      // two lines, on a baseline of their own.
      const centred = column >= 2 && row[1].length > 60 ? 6 : 0;
      doc.text(text, x + 2, 40 + index * rowHeight + 4 + centred, {
        width: width - 4,
        lineBreak: true,
      });
    });
    x += width;
  });
  doc.end();
  await done;
  return new Uint8Array(Buffer.concat(chunks));
}

for (const rotated of [false, true]) {
  test(`a table PDF${rotated ? " turned on its side" : ""} is read row by row, by the RN codes`, async () => {
    const text = await pdfTableText(await tablePdf(rotated));
    const read = readPrenotationTable(text, prenotationCodesFor("RN"));
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(read).map(([key, item]) => [
          key,
          [item.code, item.totalCents, item.foundBy, item.check],
        ]),
      ),
      {
        RI: ["2600103", 5790, "code", "sum"],
        RTD: ["2500140", 5790, "code", "sum"],
        RCPJ: ["2400105", 3151, "code", "sum"],
      },
      text,
    );
    assert.deepEqual(trustedItems(read), {
      RI: { code: "2600103", description: "Prenotação", totalCents: 5790 },
      RTD: {
        code: "2500140",
        description: read.RTD?.description ?? "",
        totalCents: 5790,
      },
      RCPJ: { code: "2400105", description: "Prenotação", totalCents: 3151 },
    });
  });
}
