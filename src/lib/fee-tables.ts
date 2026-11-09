import "server-only";
import { readFile } from "node:fs/promises";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { type PdfTextPiece, rowsOfPage } from "@/core/fees/pdf-rows.ts";
import {
  type FeeItem,
  isTrustedRead,
  PRENOTATION_ATTRIBUTIONS,
  type PrenotationAttribution,
  type PrenotationItems,
  prenotationCodesFor,
  prenotationItemsSchema,
  type ReadPrenotation,
  readPrenotationTable,
} from "@/core/fees/prenotation.ts";
import { type Database, db } from "@/db/index.ts";
import { tenantContent, transparencyDocuments } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { getDocument, type TransparencyDocumentRow } from "./transparency.ts";

/** The category whose current edition prices the site's acts. */
export const FEE_TABLE_CATEGORY = "Tabela de emolumentos";

/** Where each fee table's items live: in the office's settings, keyed by the
 * table's transparency document, so a new table never needs a migration. */
export const FEE_TABLES_KEY = "fee-tables";

const savedTableSchema = z.object({
  items: prenotationItemsSchema,
  /** "pdf" when read from the file and not yet touched, "manual" after the
   * office saved the screen. */
  source: z.enum(["pdf", "manual"]),
  updatedAt: z.string(),
});
export type SavedFeeTable = z.infer<typeof savedTableSchema>;

const storedSchema = z.object({
  tables: z.record(z.string(), savedTableSchema).default({}),
});

/** The saved tables, or a thrown error when the database cannot say: a
 * save builds on this, and must never write over values it could not read. */
async function storedTablesWith(
  database: Database,
  tenantSlug: string,
): Promise<Record<string, SavedFeeTable>> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, FEE_TABLES_KEY),
      ),
    )
    .limit(1);
  const parsed = storedSchema.safeParse(row?.published ?? {});
  return parsed.success ? parsed.data.tables : {};
}

export async function readFeeTablesWith(
  database: Database,
  tenantSlug: string,
): Promise<Record<string, SavedFeeTable>> {
  try {
    return await storedTablesWith(database, tenantSlug);
  } catch {
    // A database that is down prices nothing: the operator still sets the
    // amount by hand, as before this existed.
    return {};
  }
}

export function readFeeTables(
  tenantSlug: string,
): Promise<Record<string, SavedFeeTable>> {
  return readFeeTablesWith(db, tenantSlug);
}

/** Saves one table's items, keeping every other table's. Written straight
 * to `published`: a price the office confirmed is in force the moment it is
 * saved. */
export async function saveFeeTableItemsWith(
  database: Database,
  tenantSlug: string,
  documentId: string,
  items: PrenotationItems,
  source: SavedFeeTable["source"],
  actorId: string | null,
): Promise<void> {
  const tables = await storedTablesWith(database, tenantSlug);
  tables[documentId] = {
    items,
    source,
    updatedAt: new Date().toISOString(),
  };
  const published = { tables };
  await database
    .insert(tenantContent)
    .values({ tenantSlug, key: FEE_TABLES_KEY, published, updatedBy: actorId })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published, updatedAt: new Date(), updatedBy: actorId },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "fee-table.items",
    targetType: "transparency-document",
    targetId: documentId,
  });
}

export function saveFeeTableItems(
  tenantSlug: string,
  documentId: string,
  items: PrenotationItems,
  source: SavedFeeTable["source"],
  actorId: string | null,
): Promise<void> {
  return saveFeeTableItemsWith(
    db,
    tenantSlug,
    documentId,
    items,
    source,
    actorId,
  );
}

/**
 * The fee table in force: the first published "Tabela de emolumentos" in
 * the panel's order, the same one the public transparency page shows as
 * vigente. Putting a new table on top is what makes it the current one.
 */
export async function currentFeeTableWith(
  database: Database,
  tenantSlug: string,
): Promise<
  | {
      document: TransparencyDocumentRow;
      items: PrenotationItems;
    }
  | undefined
> {
  const [document] = await database
    .select()
    .from(transparencyDocuments)
    .where(
      and(
        eq(transparencyDocuments.tenantSlug, tenantSlug),
        eq(transparencyDocuments.status, "published"),
        eq(transparencyDocuments.category, FEE_TABLE_CATEGORY),
      ),
    )
    .orderBy(asc(transparencyDocuments.position))
    .limit(1)
    .catch(() => []);
  if (!document) return undefined;
  const saved = (await readFeeTablesWith(database, tenantSlug))[document.id];
  return { document, items: saved?.items ?? {} };
}

export function currentFeeTable(tenantSlug: string) {
  return currentFeeTableWith(db, tenantSlug);
}

/** The prenotação of a registry in the table in force, with the table's
 * name to cite next to the code. Undefined when the table has no such item:
 * the operator prices that request by hand, as before.
 *
 * A table in force that nobody read yet (one published before this
 * existed) is read here, once, and what was read with certainty is kept. */
export async function currentPrenotation(
  tenant: { slug: string; location: { state: string } },
  attribution: PrenotationAttribution,
): Promise<
  { item: FeeItem; tableTitle: string; documentId: string } | undefined
> {
  let table = await currentFeeTable(tenant.slug);
  if (table && !(await readFeeTables(tenant.slug))[table.document.id]) {
    await readNewFeeTable(tenant, table.document.id).catch((error) =>
      console.error("fee-table.first-read", error),
    );
    table = await currentFeeTable(tenant.slug);
  }
  const item = table?.items[attribution];
  if (!table || !item) return undefined;
  return {
    item,
    tableTitle: table.document.title,
    documentId: table.document.id,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The transparency document `id` names, when it is a fee table of this
 * office. A malformed id is "not found", not a database error. */
export async function getFeeTableDocument(
  tenantSlug: string,
  id: string,
): Promise<TransparencyDocumentRow | undefined> {
  if (!UUID.test(id)) return undefined;
  const document = await getDocument(tenantSlug, id);
  return document?.category === FEE_TABLE_CATEGORY ? document : undefined;
}

/**
 * The text of a table's PDF, one table row per line: each page's pieces of
 * text put back in rows by their position (`rowsOfPage`), which is what
 * keeps a code, its description and its total together however the file
 * drew the cells.
 */
export async function pdfTableText(bytes: Uint8Array): Promise<string> {
  // Loaded on demand: the reader is heavy, and only the fee tables need it.
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const lines: string[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    lines.push(
      ...rowsOfPage(
        content.items.filter(
          (item): item is PdfTextPiece & typeof item => "str" in item,
        ),
      ),
    );
  }
  return lines.join("\n");
}

async function documentBytes(
  document: TransparencyDocumentRow,
): Promise<Uint8Array> {
  return document.filePath.startsWith("http")
    ? new Uint8Array(await (await fetch(document.filePath)).arrayBuffer())
    : new Uint8Array(await readFile(document.filePath));
}

/** What the table's PDF says about the prenotações, each item with how it
 * was found and whether its total adds up. Empty when the file is not a PDF
 * or holds no readable text (a scan): the office types the values instead. */
export async function readPrenotationFromPdf(
  tenant: { slug: string; location: { state: string } },
  documentId: string,
): Promise<ReadPrenotation> {
  const document = await getFeeTableDocument(tenant.slug, documentId);
  if (!document || document.fileMimeType !== "application/pdf") return {};
  try {
    return readPrenotationTable(
      await pdfTableText(await documentBytes(document)),
      prenotationCodesFor(tenant.location.state),
    );
  } catch (error) {
    console.error("fee-table.read-pdf", documentId, error);
    return {};
  }
}

/** Only what was read with certainty: found on the row of its known code,
 * with a total that adds up. */
export function trustedItems(read: ReadPrenotation): PrenotationItems {
  const items: PrenotationItems = {};
  for (const attribution of PRENOTATION_ATTRIBUTIONS) {
    const item = read[attribution];
    if (item && isTrustedRead(item)) {
      items[attribution] = {
        code: item.code,
        description: item.description,
        totalCents: item.totalCents,
      };
    }
  }
  return items;
}

/**
 * Right after a fee table is uploaded (or the first time the site needs a
 * table in force that nobody read): read its prenotações from the PDF and
 * keep what was read with certainty, unless the office already entered
 * values for this table. A doubtful item is left for the office to type on
 * the table's screen; the read is kept even when empty, so the file is read
 * once, not on every request.
 */
export async function readNewFeeTable(
  tenant: { slug: string; location: { state: string } },
  documentId: string,
): Promise<void> {
  if (!(await getFeeTableDocument(tenant.slug, documentId))) return;
  if ((await readFeeTables(tenant.slug))[documentId]) return;
  const items = trustedItems(await readPrenotationFromPdf(tenant, documentId));
  await saveFeeTableItems(tenant.slug, documentId, items, "pdf", null);
}
