import "server-only";
import { and, asc, eq } from "drizzle-orm";
import {
  type AttributionBook,
  BookEntryError,
  type EntryInput,
  fillEmpty,
  type ImportMode,
} from "@/core/books/catalog.ts";
import type { Database } from "@/db/index.ts";
import { attributionBookEntries } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The lançamentos of the books of Notas, Títulos e Documentos, Pessoas
 * Jurídicas and Protesto (core/books/catalog.ts). Nothing is removed and
 * nothing imported ever replaces a value already in the book.
 */

export type BookEntryRow = typeof attributionBookEntries.$inferSelect;
type Actor = { id: string };

interface HistoryEntry {
  at: string;
  by: string;
  what: string;
  before?: Record<string, string>;
}

const historyOf = (row: { history: unknown }) =>
  (row.history as HistoryEntry[] | null) ?? [];

export const entryInputOf = (row: BookEntryRow): EntryInput => ({
  number: row.number,
  date: row.entryDate,
  data: (row.data as Record<string, string> | null) ?? {},
});

export async function listBookEntriesWith(
  database: Database,
  tenantSlug: string,
  book: AttributionBook,
  options: { deleted?: boolean } = {},
): Promise<BookEntryRow[]> {
  const rows = await database
    .select()
    .from(attributionBookEntries)
    .where(
      and(
        eq(attributionBookEntries.tenantSlug, tenantSlug),
        eq(attributionBookEntries.attribution, book.attribution),
        eq(attributionBookEntries.book, book.key),
      ),
    )
    .orderBy(asc(attributionBookEntries.number));
  return rows.filter((r) => Boolean(r.deletedAt) === Boolean(options.deleted));
}

async function rowWith(
  database: Database,
  tenantSlug: string,
  book: AttributionBook,
  id: string,
): Promise<BookEntryRow> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new BookEntryError("Lançamento não encontrado.");
  }
  const [row] = await database
    .select()
    .from(attributionBookEntries)
    .where(
      and(
        eq(attributionBookEntries.tenantSlug, tenantSlug),
        eq(attributionBookEntries.attribution, book.attribution),
        eq(attributionBookEntries.book, book.key),
        eq(attributionBookEntries.id, id),
      ),
    );
  if (!row) throw new BookEntryError("Lançamento não encontrado.");
  return row;
}

const audit = (
  database: Database,
  tenantSlug: string,
  actor: Actor,
  action: string,
  book: AttributionBook,
  targetId: string | undefined,
  reason?: string,
) =>
  recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action,
    targetType: `livro:${book.attribution}:${book.key}`,
    targetId,
    reason: reason ? `${book.name}: ${reason}` : book.name,
  });

export async function createBookEntryWith(
  database: Database,
  tenantSlug: string,
  book: AttributionBook,
  input: EntryInput,
  actor: Actor,
): Promise<string> {
  const existing = await listBookEntriesWith(database, tenantSlug, book);
  if (existing.some((r) => r.number === input.number)) {
    throw new BookEntryError(
      `O nº ${input.number} já está no livro. Use outro número ou altere o lançamento existente.`,
    );
  }
  const [row] = await database
    .insert(attributionBookEntries)
    .values({
      tenantSlug,
      attribution: book.attribution,
      book: book.key,
      number: input.number,
      entryDate: input.date,
      data: input.data,
      createdBy: actor.id,
    })
    .returning({ id: attributionBookEntries.id });
  await audit(database, tenantSlug, actor, "book.entry-create", book, row?.id);
  return row?.id ?? "";
}

/** Changes a lançamento; the previous values go to the history. */
export async function updateBookEntryWith(
  database: Database,
  tenantSlug: string,
  book: AttributionBook,
  id: string,
  input: EntryInput,
  reason: string,
  actor: Actor,
): Promise<void> {
  const row = await rowWith(database, tenantSlug, book, id);
  const current = entryInputOf(row);
  const before: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.data)) {
    if ((current.data[key] ?? "") !== value)
      before[key] = current.data[key] ?? "";
  }
  if (Object.keys(before).length === 0) return;
  await database
    .update(attributionBookEntries)
    .set({
      entryDate: input.date,
      data: input.data,
      history: [
        ...historyOf(row),
        { at: new Date().toISOString(), by: actor.id, what: reason, before },
      ],
    })
    .where(eq(attributionBookEntries.id, row.id));
  await audit(
    database,
    tenantSlug,
    actor,
    "book.entry-update",
    book,
    row.id,
    reason,
  );
}

export async function setBookEntryDeletedWith(
  database: Database,
  tenantSlug: string,
  book: AttributionBook,
  id: string,
  deleted: boolean,
  reason: string,
  actor: Actor,
): Promise<void> {
  const row = await rowWith(database, tenantSlug, book, id);
  await database
    .update(attributionBookEntries)
    .set({
      deletedAt: deleted ? new Date() : null,
      deletedBy: deleted ? actor.id : null,
      history: [
        ...historyOf(row),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: `${deleted ? "Apagado" : "Restaurado"}: ${reason}`,
        },
      ],
    })
    .where(eq(attributionBookEntries.id, row.id));
  await audit(
    database,
    tenantSlug,
    actor,
    deleted ? "book.entry-delete" : "book.entry-restore",
    book,
    row.id,
    reason,
  );
}

export interface ImportResult {
  created: number;
  completed: number;
  unchanged: number;
}

/**
 * Brings in what was read. "conferir" writes nothing and says what would
 * happen; "novos" adds only numbers not in the book; "completar" also
 * fills the empty fields of the ones already there (never replacing).
 */
export async function importBookEntriesWith(
  database: Database,
  tenantSlug: string,
  book: AttributionBook,
  items: EntryInput[],
  mode: ImportMode,
  actor: Actor,
): Promise<ImportResult> {
  const existing = new Map(
    (await listBookEntriesWith(database, tenantSlug, book)).map((r) => [
      r.number,
      r,
    ]),
  );
  const result: ImportResult = { created: 0, completed: 0, unchanged: 0 };
  for (const item of items) {
    const row = existing.get(item.number);
    if (!row) {
      result.created++;
      if (mode !== "conferir") {
        await database.insert(attributionBookEntries).values({
          tenantSlug,
          attribution: book.attribution,
          book: book.key,
          number: item.number,
          entryDate: item.date,
          data: item.data,
          origin: "importacao",
          createdBy: actor.id,
        });
      }
      continue;
    }
    const filled =
      mode === "novos" ? null : fillEmpty(entryInputOf(row).data, item.data);
    if (!filled) {
      result.unchanged++;
      continue;
    }
    result.completed++;
    if (mode === "completar") {
      await database
        .update(attributionBookEntries)
        .set({
          data: filled,
          entryDate: row.entryDate ?? item.date,
          history: [
            ...historyOf(row),
            {
              at: new Date().toISOString(),
              by: actor.id,
              what: "Campos vazios completados por importação",
              before: entryInputOf(row).data,
            },
          ],
        })
        .where(eq(attributionBookEntries.id, row.id));
    }
  }
  if (mode !== "conferir") {
    await audit(
      database,
      tenantSlug,
      actor,
      "book.import",
      book,
      undefined,
      `${result.created} novos, ${result.completed} completados, ${result.unchanged} sem mudança`,
    );
  }
  return result;
}
