import "server-only";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import {
  type BalanceOficio,
  type BookDocKind,
  type BookEntry,
  type BookSettings,
  type BookSnapshot,
  buildBalanceOficio,
  buildBookPdfDocument,
  DEFAULT_SPECIALTIES,
  type EntryKind,
  interimPeriodOf,
  SettingsSchema,
  SHEET_KINDS,
  summarize,
} from "@/core/daily-book/book.ts";
import {
  type BookBulletin,
  monthEnd,
  sumReadings,
} from "@/core/daily-book/bulletin.ts";
import type { ReportFigures } from "@/core/iss/notaris-report.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { type Database, db } from "@/db/index.ts";
import {
  dailyBookEntries,
  dailyBookImports,
  dailyBookReports,
  tenantContent,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { brandFor } from "./document-brand.ts";
import {
  OFFICE_BOOK_BULLETIN_KEY,
  OFFICE_DAILY_BOOK_KEY,
} from "./office-config.ts";
import { renderDocument, renderDocuments } from "./pdf.ts";

export class DailyBookError extends Error {}

const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/* --------------------------------------------------------------- settings */

export async function getBookSettingsWith(
  database: Database,
  tenantSlug: string,
): Promise<BookSettings> {
  try {
    const [row] = await database
      .select({ published: tenantContent.published })
      .from(tenantContent)
      .where(
        and(
          eq(tenantContent.tenantSlug, tenantSlug),
          eq(tenantContent.key, OFFICE_DAILY_BOOK_KEY),
        ),
      )
      .limit(1);
    const parsed = SettingsSchema.safeParse(row?.published);
    if (parsed.success) return parsed.data;
  } catch {
    // The defaults, never a broken screen.
  }
  return SettingsSchema.parse({ specialties: DEFAULT_SPECIALTIES });
}

export async function saveBookSettingsWith(
  database: Database,
  tenantSlug: string,
  settings: BookSettings,
  actorId: string,
): Promise<void> {
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_DAILY_BOOK_KEY,
      published: settings,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: {
        published: settings,
        publishedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "office-settings.save",
    targetType: "tenant-content",
    targetId: OFFICE_DAILY_BOOK_KEY,
  });
}

/* ---------------------------------------------------------------- entries */

export type StoredEntry = typeof dailyBookEntries.$inferSelect;
export type StoredReport = typeof dailyBookReports.$inferSelect;

export function entryOf(row: StoredEntry): BookEntry {
  return {
    id: row.id,
    kind:
      row.kind === "despesa" || row.kind === "deposito" ? row.kind : "receita",
    date: row.occurredOn,
    specialty: row.specialty,
    category: row.category,
    actCode: row.actCode,
    description: row.description,
    quantity: row.quantity,
    amountCents: row.amountCents,
    fundsCents: row.fundsCents,
    issCents: row.issCents,
    supplier: row.supplier,
    documentRef: row.documentRef,
    fiscalDistinct: row.fiscalDistinct,
    fiscalNote: row.fiscalNote,
    explanation: row.explanation,
    hasAttachment: Boolean(row.attachmentPath),
  };
}

export async function listEntriesWith(
  database: Database,
  tenantSlug: string,
  period: { start: string; end: string },
  options: { withRemoved?: boolean } = {},
): Promise<StoredEntry[]> {
  return database
    .select()
    .from(dailyBookEntries)
    .where(
      and(
        eq(dailyBookEntries.tenantSlug, tenantSlug),
        gte(dailyBookEntries.occurredOn, period.start),
        lte(dailyBookEntries.occurredOn, period.end),
        ...(options.withRemoved ? [] : [isNull(dailyBookEntries.removedAt)]),
      ),
    )
    .orderBy(
      asc(dailyBookEntries.occurredOn),
      asc(dailyBookEntries.kind),
      asc(dailyBookEntries.createdAt),
    );
}

export async function findEntryWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredEntry | undefined> {
  if (!isId(id)) return undefined;
  const [row] = await database
    .select()
    .from(dailyBookEntries)
    .where(
      and(
        eq(dailyBookEntries.tenantSlug, tenantSlug),
        eq(dailyBookEntries.id, id),
      ),
    )
    .limit(1);
  return row;
}

export interface EntryInput {
  kind: EntryKind;
  occurredOn: string;
  specialty: string;
  category: string;
  actCode: string;
  description: string;
  quantity: number;
  amountCents: number;
  fundsCents: number;
  issCents: number;
  supplier: string;
  documentRef: string;
  fiscalDistinct: boolean;
  fiscalNote: string;
  explanation: string;
  attachment?: { path: string; name: string } | null;
  source?: "manual" | "comprovante";
}

function checkEntry(input: EntryInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) {
    throw new DailyBookError("Confira a data.");
  }
  if (!input.description.trim()) {
    throw new DailyBookError("Descreva o lançamento.");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new DailyBookError("Confira o valor.");
  }
  if (input.kind === "despesa" && !input.category) {
    throw new DailyBookError(
      "Escolha a categoria da despesa (art. 191-A, § 1º).",
    );
  }
  if (input.kind === "deposito" && !input.documentRef.trim()) {
    throw new DailyBookError(
      "Informe a conta em que o depósito foi feito (art. 194, I).",
    );
  }
}

const values = (input: EntryInput) => ({
  kind: input.kind,
  occurredOn: input.occurredOn,
  specialty: input.kind === "receita" ? input.specialty : "",
  category: input.kind === "despesa" ? input.category : "",
  actCode: input.actCode,
  description: input.description.trim(),
  quantity: Math.max(1, input.quantity || 1),
  amountCents: input.amountCents,
  fundsCents: input.kind === "receita" ? input.fundsCents : 0,
  issCents: input.kind === "receita" ? input.issCents : 0,
  supplier: input.supplier,
  documentRef: input.documentRef,
  fiscalDistinct: input.fiscalDistinct,
  fiscalNote: input.fiscalNote,
  explanation: input.explanation,
});

export async function addEntryWith(
  database: Database,
  tenantSlug: string,
  input: EntryInput,
  actorId: string,
): Promise<StoredEntry> {
  checkEntry(input);
  const [row] = await database
    .insert(dailyBookEntries)
    .values({
      tenantSlug,
      ...values(input),
      attachmentPath: input.attachment?.path ?? null,
      attachmentName: input.attachment?.name ?? null,
      source: input.source ?? "manual",
      createdBy: actorId,
    })
    .returning();
  if (!row) throw new Error("lançamento não gravado");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.entry-add",
    targetType: "daily-book",
    targetId: row.id,
  });
  return row;
}

export async function updateEntryWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: EntryInput,
  actorId: string,
): Promise<void> {
  checkEntry(input);
  const row = await findEntryWith(database, tenantSlug, id);
  if (!row || row.removedAt)
    throw new DailyBookError("Lançamento não encontrado.");
  await database
    .update(dailyBookEntries)
    .set({
      ...values(input),
      ...(input.attachment
        ? {
            attachmentPath: input.attachment.path,
            attachmentName: input.attachment.name,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(dailyBookEntries.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.entry-edit",
    targetType: "daily-book",
    targetId: id,
  });
}

export async function removeEntryWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const updated = await database
    .update(dailyBookEntries)
    .set({ removedAt: new Date(), removedBy: actorId, removeReason: reason })
    .where(
      and(
        eq(dailyBookEntries.tenantSlug, tenantSlug),
        eq(dailyBookEntries.id, id),
        isNull(dailyBookEntries.removedAt),
      ),
    )
    .returning({ id: dailyBookEntries.id });
  if (!updated.length) throw new DailyBookError("Lançamento não encontrado.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.entry-remove",
    targetType: "daily-book",
    targetId: id,
    reason,
  });
}

/* ----------------------------------------------------------------- import */

export interface ImportLine {
  code: string;
  description: string;
  quantity: number;
  amountCents: number;
  fundsCents: number;
  issCents: number;
  specialty: string;
  /** Art. 190: the act's number, or book and sheet, or protocol. */
  identification?: string;
  explanation: string;
}

/**
 * Books the productivity report's acts as revenue (art. 190): one line
 * per act code, dated the report's day ("no dia da prática do ato"; a
 * report of several days is refused). A period already
 * read is refused unless `replace`: then the earlier lines are excluded
 * (kept, with the reason) and the new ones booked.
 */
export async function importProductivityWith(
  database: Database,
  tenantSlug: string,
  input: {
    start: string;
    end: string;
    lines: ImportLine[];
    file?: { path: string; name: string } | null;
    reading?: unknown;
    replace: boolean;
  },
  actorId: string,
): Promise<{ importId: string; count: number }> {
  if (input.end < input.start) throw new DailyBookError("Confira o período.");
  // Art. 190: "no dia da prática do ato".
  if (input.start !== input.end) {
    throw new DailyBookError(
      "O art. 190 manda lançar a receita no dia da prática do ato: envie o relatório de um dia só.",
    );
  }
  if (input.lines.length === 0) {
    throw new DailyBookError("Nenhum ato para lançar.");
  }
  return database.transaction(async (tx) => {
    const earlier = await tx
      .select({ id: dailyBookEntries.id })
      .from(dailyBookEntries)
      .where(
        and(
          eq(dailyBookEntries.tenantSlug, tenantSlug),
          eq(dailyBookEntries.source, "produtividade"),
          isNull(dailyBookEntries.removedAt),
          gte(dailyBookEntries.occurredOn, input.start),
          lte(dailyBookEntries.occurredOn, input.end),
        ),
      );
    if (earlier.length && !input.replace) {
      throw new DailyBookError(
        `Já há ${earlier.length} receita(s) lida(s) de relatório nesse período. Marque "Substituir as receitas já lidas desse período" para trocar pelas deste relatório.`,
      );
    }
    for (const e of earlier) {
      await tx
        .update(dailyBookEntries)
        .set({
          removedAt: new Date(),
          removedBy: actorId,
          removeReason:
            "Substituída por um novo relatório de produtividade do mesmo período.",
        })
        .where(eq(dailyBookEntries.id, e.id));
    }
    const [imported] = await tx
      .insert(dailyBookImports)
      .values({
        tenantSlug,
        periodStart: input.start,
        periodEnd: input.end,
        filePath: input.file?.path ?? null,
        fileName: input.file?.name ?? null,
        reading: input.reading ?? null,
        createdBy: actorId,
      })
      .returning();
    if (!imported) throw new Error("relatório não gravado");
    for (const line of input.lines) {
      await tx.insert(dailyBookEntries).values({
        tenantSlug,
        kind: "receita",
        occurredOn: input.start,
        specialty: line.specialty,
        actCode: line.code,
        description: line.description,
        quantity: Math.max(1, line.quantity),
        amountCents: line.amountCents,
        fundsCents: line.fundsCents,
        issCents: line.issCents,
        documentRef: line.identification ?? "",
        explanation: line.explanation.trim(),
        source: "produtividade",
        importId: imported.id,
        createdBy: actorId,
      });
    }
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "daily-book.import",
      targetType: "daily-book",
      targetId: imported.id,
    });
    return { importId: imported.id, count: input.lines.length };
  });
}

/* ---------------------------------------------------------------- reports */

export function snapshotOf(row: Pick<StoredReport, "snapshot">): BookSnapshot {
  return row.snapshot as BookSnapshot;
}

export async function listBookReportsWith(
  database: Database,
  tenantSlug: string,
  options: { withRemoved?: boolean } = {},
): Promise<StoredReport[]> {
  return database
    .select()
    .from(dailyBookReports)
    .where(
      and(
        eq(dailyBookReports.tenantSlug, tenantSlug),
        ...(options.withRemoved ? [] : [isNull(dailyBookReports.removedAt)]),
      ),
    )
    .orderBy(desc(dailyBookReports.createdAt));
}

export async function findBookReportWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredReport | undefined> {
  if (!isId(id)) return undefined;
  const [row] = await database
    .select()
    .from(dailyBookReports)
    .where(
      and(
        eq(dailyBookReports.tenantSlug, tenantSlug),
        eq(dailyBookReports.id, id),
      ),
    )
    .limit(1);
  return row;
}

async function buildSnapshotWith(
  database: Database,
  tenantSlug: string,
  input: {
    kind: BookDocKind;
    start: string;
    end: string;
    issuedOn: string;
    notes: string;
    signer: { name: string; title: string; note?: string } | null;
  },
): Promise<BookSnapshot> {
  const settings = await getBookSettingsWith(database, tenantSlug);
  const book = {
    number: settings.bookNumber,
    sheetCount: settings.sheetCount,
  };
  // The terms (art. 186) carry the book, not lines.
  if (input.kind === "abertura" || input.kind === "encerramento") {
    return {
      kind: input.kind,
      start: input.start,
      end: input.end,
      issuedOn: input.issuedOn,
      entries: [],
      months: [],
      notes: input.notes.trim(),
      signer: input.signer,
      book:
        input.kind === "encerramento"
          ? {
              ...book,
              lastSheet:
                (await lastSheetWith(database, tenantSlug, book.number)) ||
                undefined,
            }
          : book,
    };
  }
  const rows = await listEntriesWith(database, tenantSlug, {
    start: input.start,
    end: input.end,
  });
  const entries = rows.map(entryOf);
  const months: BookSnapshot["months"] = [];
  if (input.kind === "ano") {
    for (let m = 1; m <= 12; m++) {
      const month = `${input.start.slice(0, 4)}-${String(m).padStart(2, "0")}`;
      const sum = summarize(entries.filter((e) => e.date.startsWith(month)));
      months.push({
        month,
        revenueCents: sum.revenueCents,
        expensesCents: sum.expensesCents,
        acts: sum.acts,
        fundsCents: sum.fundsCents,
        issCents: sum.issCents,
      });
    }
  }
  return {
    kind: input.kind,
    start: input.start,
    end: input.end,
    issuedOn: input.issuedOn,
    // The year's balance keeps the months, not every line.
    entries: input.kind === "ano" ? [] : entries,
    months,
    notes: input.notes.trim(),
    signer: input.signer,
    interim:
      input.kind === "mes"
        ? await interimOf(database, tenantSlug, settings, input.start)
        : null,
    book,
  };
}

/**
 * Art. 194: in the month that closes the interim's period (every month, or
 * March, June, September and December), the period's figures and the
 * ceiling in force when generated.
 */
async function interimOf(
  database: Database,
  tenantSlug: string,
  settings: BookSettings,
  monthStart: string,
): Promise<BookSnapshot["interim"]> {
  if (!settings.interim) return null;
  const period = interimPeriodOf(
    monthStart.slice(0, 7),
    settings.interimPeriod,
  );
  if (!period) return null;
  const entries = (await listEntriesWith(database, tenantSlug, period)).map(
    entryOf,
  );
  const pay = entries.filter(
    (e) => e.kind === "despesa" && e.category === "interino",
  );
  const sum = summarize(entries.filter((e) => !pay.includes(e)));
  return {
    ceilingCents: settings.ceilingCents,
    period: settings.interimPeriod,
    start: period.start,
    end: period.end,
    months: period.months,
    revenueCents: sum.revenueCents,
    expensesCents: sum.expensesCents,
    depositsCents: sum.depositsCents,
  };
}

/** The last sheet used in a book, removed pages included (art. 186). */
async function lastSheetWith(
  database: Database,
  tenantSlug: string,
  bookNumber: number,
  except?: string,
): Promise<number> {
  const rows = await database
    .select({ id: dailyBookReports.id, snapshot: dailyBookReports.snapshot })
    .from(dailyBookReports)
    .where(eq(dailyBookReports.tenantSlug, tenantSlug));
  let last = 0;
  for (const row of rows) {
    if (row.id === except) continue;
    const book = snapshotOf(row).book;
    if (book?.number === bookNumber && book.lastSheet) {
      last = Math.max(last, book.lastSheet);
    }
  }
  return last;
}

/**
 * Art. 186: a page of the book takes the next sheets of the book, and keeps
 * them; a sheet once used is never used again, even if the page is
 * removed. Edited, a page keeps its first sheet and counts its pages again.
 * Returns the sheets and whether the book's sheets ran out.
 */
export async function numberSheetsWith(
  database: Database,
  tenant: Tenant,
  id: string,
): Promise<{ first: number; last: number; overflow: boolean } | null> {
  const row = await findBookReportWith(database, tenant.slug, id);
  if (!row) return null;
  const snapshot = snapshotOf(row);
  if (!SHEET_KINDS.includes(snapshot.kind) || !snapshot.book) return null;
  const first =
    snapshot.book.firstSheet ??
    (await lastSheetWith(database, tenant.slug, snapshot.book.number, id)) + 1;
  const withFirst: BookSnapshot = {
    ...snapshot,
    book: { ...snapshot.book, firstSheet: first },
  };
  const pdf = await renderBookPdf(tenant, { snapshot: withFirst });
  const pages = (await PDFDocument.load(pdf)).getPageCount();
  const last = first + Math.max(1, pages) - 1;
  await database
    .update(dailyBookReports)
    .set({
      snapshot: {
        ...withFirst,
        book: { ...withFirst.book, firstSheet: first, lastSheet: last },
      },
    })
    .where(eq(dailyBookReports.id, id));
  return {
    first,
    last,
    overflow: snapshot.book.sheetCount > 0 && last > snapshot.book.sheetCount,
  };
}

export async function issueBookReportWith(
  database: Database,
  tenantSlug: string,
  input: {
    kind: BookDocKind;
    start: string;
    end: string;
    issuedOn: string;
    notes: string;
    signerIndex: number;
    signers: { name: string; title: string; note?: string }[];
  },
  actorId: string,
): Promise<StoredReport> {
  const snapshot = await buildSnapshotWith(database, tenantSlug, {
    ...input,
    signer: input.signers[input.signerIndex] ?? input.signers[0] ?? null,
  });
  const [row] = await database
    .insert(dailyBookReports)
    .values({
      tenantSlug,
      kind: input.kind,
      periodStart: input.start,
      periodEnd: input.end,
      snapshot,
      signer: input.signerIndex,
      createdBy: actorId,
    })
    .returning();
  if (!row) throw new Error("página não gravada");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.report-issue",
    targetType: "daily-book",
    targetId: row.id,
  });
  return row;
}

/** Edits a page: date, signer, notes; with `refresh`, the lines of now. */
export async function updateBookReportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: {
    issuedOn: string;
    notes: string;
    signerIndex: number;
    signers: { name: string; title: string; note?: string }[];
    refresh: boolean;
  },
  actorId: string,
): Promise<void> {
  const row = await findBookReportWith(database, tenantSlug, id);
  if (!row || row.removedAt) throw new DailyBookError("Página não encontrada.");
  const old = snapshotOf(row);
  const signer = input.signers[input.signerIndex] ?? input.signers[0] ?? null;
  // Refreshed, a page keeps its book and first sheet (art. 186).
  const snapshot = input.refresh
    ? {
        ...(await buildSnapshotWith(database, tenantSlug, {
          kind: old.kind,
          start: old.start,
          end: old.end,
          issuedOn: input.issuedOn,
          notes: input.notes,
          signer,
        })),
        ...(old.book && SHEET_KINDS.includes(old.kind)
          ? { book: old.book }
          : {}),
      }
    : { ...old, issuedOn: input.issuedOn, notes: input.notes.trim(), signer };
  await database
    .update(dailyBookReports)
    .set({ snapshot, signer: input.signerIndex, updatedAt: new Date() })
    .where(eq(dailyBookReports.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.report-edit",
    targetType: "daily-book",
    targetId: id,
  });
}

export async function removeBookReportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const updated = await database
    .update(dailyBookReports)
    .set({ removedAt: new Date(), removedBy: actorId, removeReason: reason })
    .where(
      and(
        eq(dailyBookReports.tenantSlug, tenantSlug),
        eq(dailyBookReports.id, id),
        isNull(dailyBookReports.removedAt),
      ),
    )
    .returning({ id: dailyBookReports.id });
  if (!updated.length) throw new DailyBookError("Página não encontrada.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.report-remove",
    targetType: "daily-book",
    targetId: id,
    reason,
  });
}

export async function renderBookPdf(
  tenant: Tenant,
  row: Pick<StoredReport, "snapshot">,
): Promise<Buffer> {
  return renderDocument(
    buildBookPdfDocument(tenant, snapshotOf(row)),
    await brandFor(tenant),
  );
}

/**
 * The ofício that sends the year's balance to the Corregedoria: kept with
 * the balance, so the PDF comes out the same every time it is opened.
 */
export async function saveBalanceOficioWith(
  database: Database,
  tenantSlug: string,
  id: string,
  oficio: BalanceOficio,
  actorId: string,
): Promise<void> {
  const row = await findBookReportWith(database, tenantSlug, id);
  if (!row || row.removedAt) throw new DailyBookError("Página não encontrada.");
  const old = snapshotOf(row);
  if (old.kind !== "ano") {
    throw new DailyBookError("O ofício acompanha o balanço anual.");
  }
  await database
    .update(dailyBookReports)
    .set({ snapshot: { ...old, oficio }, updatedAt: new Date() })
    .where(eq(dailyBookReports.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.report-edit",
    targetType: "daily-book",
    targetId: id,
  });
}

/** The ofício first, then the balance it sends, in one PDF. */
export async function renderBalanceOficioPdf(
  tenant: Tenant,
  row: Pick<StoredReport, "snapshot">,
  options: { transparencyUrl?: string } = {},
): Promise<Buffer> {
  const s = snapshotOf(row);
  return renderDocuments(
    [buildBalanceOficio(tenant, s, options), buildBookPdfDocument(tenant, s)],
    await brandFor(tenant),
  );
}

export const getBookSettings = (tenantSlug: string) =>
  getBookSettingsWith(db, tenantSlug);

/* --------------------------------------------------------------- bulletin */

/**
 * The month's bulletin from the book: the totals of each day's
 * productivity report read into it whose lines are still in the book (a
 * report replaced or removed leaves out). Days read before the totals were
 * kept have no reading and are not counted.
 */
export async function monthBulletinFromBookWith(
  database: Database,
  tenantSlug: string,
  month: string,
): Promise<BookBulletin> {
  const start = `${month}-01`;
  const end = monthEnd(month);
  const imports = await database
    .select({
      id: dailyBookImports.id,
      start: dailyBookImports.periodStart,
      end: dailyBookImports.periodEnd,
      reading: dailyBookImports.reading,
    })
    .from(dailyBookImports)
    .where(
      and(
        eq(dailyBookImports.tenantSlug, tenantSlug),
        gte(dailyBookImports.periodStart, start),
        lte(dailyBookImports.periodStart, end),
        isNotNull(dailyBookImports.reading),
      ),
    )
    .orderBy(asc(dailyBookImports.periodStart));
  const live = new Set(
    (
      await database
        .selectDistinct({ id: dailyBookEntries.importId })
        .from(dailyBookEntries)
        .where(
          and(
            eq(dailyBookEntries.tenantSlug, tenantSlug),
            isNull(dailyBookEntries.removedAt),
            isNotNull(dailyBookEntries.importId),
            gte(dailyBookEntries.occurredOn, start),
            lte(dailyBookEntries.occurredOn, end),
          ),
        )
    ).map((r) => r.id),
  );
  const kept = imports.filter(
    (i) => i.start === i.end && live.has(i.id) && isReading(i.reading),
  );
  const entries = (
    await listEntriesWith(database, tenantSlug, { start, end })
  ).map(entryOf);
  return {
    month,
    figures: sumReadings(kept.map((i) => i.reading as ReportFigures)),
    source: "dias",
    days: [...new Set(kept.map((i) => i.start))],
    bookExpensesCents: summarize(entries).expensesCents,
  };
}

function isReading(value: unknown): value is ReportFigures {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "produtividade"
  );
}

async function readBookBulletins(
  database: Database,
  tenantSlug: string,
): Promise<Record<string, BookBulletin>> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_BOOK_BULLETIN_KEY),
      ),
    )
    .limit(1);
  const value = row?.published;
  return value && typeof value === "object"
    ? (value as Record<string, BookBulletin>)
    : {};
}

/** Keeps the month's figures for the bulletin's form to open with. */
export async function saveBookBulletinWith(
  database: Database,
  tenantSlug: string,
  bulletin: BookBulletin,
  actorId: string,
): Promise<void> {
  const all = await readBookBulletins(database, tenantSlug);
  const published = { ...all, [bulletin.month]: bulletin };
  const now = new Date();
  await database
    .insert(tenantContent)
    .values({
      tenantSlug,
      key: OFFICE_BOOK_BULLETIN_KEY,
      published,
      publishedAt: now,
      updatedBy: actorId,
    })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published, publishedAt: now, updatedAt: now, updatedBy: actorId },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "daily-book.bulletin-prepare",
    targetType: "daily-book",
    targetId: bulletin.month,
  });
}

/** The figures the book left for a month, if any. */
export async function bookBulletinWith(
  database: Database,
  tenantSlug: string,
  month: string,
): Promise<BookBulletin | null> {
  try {
    return (await readBookBulletins(database, tenantSlug))[month] ?? null;
  } catch {
    return null;
  }
}
