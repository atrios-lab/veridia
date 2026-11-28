import "server-only";
import { and, eq } from "drizzle-orm";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import { volumeName } from "@/core/ri/books.ts";
import { type IndexEntry, protocolIndex } from "@/core/ri/protocol-index.ts";
import { faceLabel, placeOf } from "@/core/ri/protocol-sheets.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { riProtocols } from "@/db/schema.ts";
import { brandFor } from "./document-brand.ts";
import { renderDocument } from "./pdf.ts";
import { drawTableBook, type TableBook } from "./ri-book-model.ts";
import { bookToWord } from "./ri-book-word.ts";
import { bookWith } from "./ri-books.ts";
import { bookSheetsWith } from "./ri-protocol-sheets.ts";
import { officeToday } from "./ri-protocols.ts";
import { type PrintChoice, signerLinesOf, stampRubric } from "./ri-signers.ts";
import { joinPdfs } from "./ri-tiff.ts";

const brDay = (iso: string) => iso.split("-").reverse().join("/");

/** The índice of one Livro 1, with the folha of each título. */
export async function protocolIndexWith(
  database: Database,
  tenant: Tenant,
  bookId: string,
): Promise<{ volume: string; entries: IndexEntry[] } | null> {
  const book = await bookWith(database, tenant.slug, bookId);
  if (!book || book.book !== 1 || book.deletedAt) return null;
  const low = book.firstItem ?? 1;
  const high = book.lastItem ?? Number.MAX_SAFE_INTEGER;
  const rows = (
    await database
      .select()
      .from(riProtocols)
      .where(
        and(
          eq(riProtocols.tenantSlug, tenant.slug),
          eq(riProtocols.kind, "prenotacao"),
        ),
      )
  ).filter((r) => r.number >= low && r.number <= high);
  const sheets = await bookSheetsWith(database, tenant, bookId);
  return {
    volume: book.volume,
    entries: protocolIndex(
      rows.map((r) => {
        const at = sheets ? placeOf(sheets.pagination, r.number) : null;
        return {
          presenter: r.presenterName,
          presentedOn: r.presentedOn,
          titleKind: r.titleKind,
          number: r.number,
          sheet: at ? faceLabel(at.sheet, at.side) : (r.sheetLabel ?? ""),
        };
      }),
    ),
  };
}

const COLUMNS = [
  "Nome do apresentante",
  "Data",
  "Natureza do título",
  "Nº de ordem",
  "Folha",
];

/** The rows of the índice, for the spreadsheet and the PDF. */
export function indexRows(entries: readonly IndexEntry[]): string[][] {
  return entries.map((e) => [
    e.presenter,
    brDay(e.presentedOn),
    e.titleKind,
    e.number.toLocaleString("pt-BR"),
    e.sheet,
  ]);
}

export const INDEX_COLUMNS = COLUMNS;

function indexTable(
  tenant: Tenant,
  volume: string,
  entries: readonly IndexEntry[],
): TableBook {
  return {
    title: "ÍNDICE DO PROTOCOLO",
    book: 1,
    volume,
    year: `ATÉ ${brDay(officeToday())}`,
    columns: [
      { label: "NOME DO APRESENTANTE", width: 0.34 },
      { label: "Data", width: 0.12 },
      { label: "Natureza do título", width: 0.3 },
      { label: "Nº de ordem", width: 0.12 },
      { label: "Folha", width: 0.12 },
    ],
    rows: indexRows(entries).map((cells) => ({ cells })),
    footer: `${officialName(tenant)} · ${volumeName(volume)} · Índice do Protocolo`,
    // An internal act, ex officio: no note of custas (28/11/2026).
    closingNote: null,
  };
}

/** The closing of the índice, signed by who was chosen. */
function indexClosing(
  tenant: Tenant,
  volume: string,
  count: number,
  choice: PrintChoice,
): RequerimentoDocument {
  return {
    eyebrow: "Registro de Imóveis",
    title: "Índice do Protocolo",
    subtitle: volumeName(volume),
    office: [officialName(tenant), tenant.subtitle],
    sections: [
      {
        heading: "Encerramento do índice",
        paragraphs: [
          `Índice dos apresentantes do ${volumeName(volume)} (Protocolo), em ordem alfabética, com a data, a natureza do título, o número de ordem e a folha de cada um: ${count.toLocaleString("pt-BR")} ${count === 1 ? "título" : "títulos"}.`,
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${brDay(officeToday())}.`,
    ...signerLinesOf(choice),
    footer: `${officialName(tenant)} · ${volumeName(volume)} · Índice do Protocolo · ${tenant.legalFooter}`,
  };
}

export async function protocolIndexPdf(
  tenant: Tenant,
  volume: string,
  entries: readonly IndexEntry[],
  choice: PrintChoice,
): Promise<Uint8Array> {
  let bytes = await joinPdfs([
    new Uint8Array(await drawTableBook(indexTable(tenant, volume, entries))),
    new Uint8Array(
      await renderDocument(
        indexClosing(tenant, volume, entries.length, choice),
        await brandFor(tenant),
      ),
    ),
  ]);
  if (choice.rubric && choice.signer?.rubricImage) {
    bytes = await stampRubric(bytes, choice.signer.rubricImage);
  }
  return bytes;
}

export async function protocolIndexWord(
  tenant: Tenant,
  volume: string,
  entries: readonly IndexEntry[],
  choice: PrintChoice,
): Promise<Buffer> {
  return bookToWord(`Índice do Protocolo · ${volumeName(volume)}`, [
    { kind: "table", book: indexTable(tenant, volume, entries) },
    {
      kind: "term",
      document: indexClosing(tenant, volume, entries.length, choice),
    },
  ]);
}
