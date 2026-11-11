import "server-only";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import {
  type BookDocKind,
  type BookEntry,
  type BookSettings,
  type BookSnapshot,
  buildBookPdfDocument,
  DEFAULT_SPECIALTIES,
  SettingsSchema,
  summarize,
} from "@/core/daily-book/book.ts";
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
import { OFFICE_DAILY_BOOK_KEY } from "./office-config.ts";
import { renderDocument } from "./pdf.ts";

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
    kind: row.kind === "despesa" ? "despesa" : "receita",
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
  kind: "receita" | "despesa";
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
  explanation: string;
}

/**
 * Books the productivity report's acts as revenue (art. 190): one line
 * per act code. A report of one day dates them that day; a report of the
 * month dates them its last day, marked as consolidated. A period already
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
    const oneDay = input.start === input.end;
    const consolidated = oneDay
      ? ""
      : `Consolidado do relatório de ${input.start.split("-").reverse().join("/")} a ${input.end.split("-").reverse().join("/")}. O art. 190 pede a receita no dia do ato: anexe o relatório de cada dia quando possível.`;
    for (const line of input.lines) {
      await tx.insert(dailyBookEntries).values({
        tenantSlug,
        kind: "receita",
        occurredOn: input.end,
        specialty: line.specialty,
        actCode: line.code,
        description: line.description,
        quantity: Math.max(1, line.quantity),
        amountCents: line.amountCents,
        fundsCents: line.fundsCents,
        issCents: line.issCents,
        explanation: [consolidated, line.explanation.trim()]
          .filter(Boolean)
          .join(" "),
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
    interim: await interimOf(database, tenantSlug, input.kind),
  };
}

/** A month of an interim office keeps the ceiling in force when generated. */
async function interimOf(
  database: Database,
  tenantSlug: string,
  kind: BookDocKind,
): Promise<BookSnapshot["interim"]> {
  if (kind !== "mes") return null;
  const settings = await getBookSettingsWith(database, tenantSlug);
  return settings.interim ? { ceilingCents: settings.ceilingCents } : null;
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
  const snapshot = input.refresh
    ? await buildSnapshotWith(database, tenantSlug, {
        kind: old.kind,
        start: old.start,
        end: old.end,
        issuedOn: input.issuedOn,
        notes: input.notes,
        signer,
      })
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

export const getBookSettings = (tenantSlug: string) =>
  getBookSettingsWith(db, tenantSlug);
