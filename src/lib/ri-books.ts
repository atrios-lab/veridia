import "server-only";
import { and, eq, ne } from "drizzle-orm";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import {
  type Act,
  actLabel,
  matriculaPeople,
  situationOf,
} from "@/core/ri/acts.ts";
import { AUX_ROLE_LABELS, auxText, notesOf } from "@/core/ri/auxiliary.ts";
import {
  BOOKS,
  type BookForm,
  type BookNumber,
  type BookRecord,
  closingTerm,
  isBookNumber,
  openingTerm,
  type ProtocolLine,
  protocolDay,
  readItem,
  shortDate,
  type TermOffice,
  type TermText,
} from "@/core/ri/books.ts";
import { custasNoteFor } from "@/core/ri/closing-notes.ts";
import { formatCnm } from "@/core/ri/cnm.ts";
import { fichaContent } from "@/core/ri/ficha.ts";
import { addressLine, isoDate, propertyTitle } from "@/core/ri/property.ts";
import { type ClosingKind, closingText } from "@/core/ri/protocol-days.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { riActs, riBooks, riOnrImages, riProtocols } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { brandFor } from "./document-brand.ts";
import { renderDocument } from "./pdf.ts";
import { type Actor, loadAcervoWith, RiError } from "./ri.ts";
import {
  drawFichas,
  drawTableBook,
  type FichaPage,
  type TableBook,
  type TableRow,
} from "./ri-book-model.ts";
import {
  personalIndicatorTable,
  realIndicatorTable,
} from "./ri-book-tables.ts";
import { bookToWord, type WordBlock } from "./ri-book-word.ts";
import { riSignerFor } from "./ri-docs.ts";
import { currentOf } from "./ri-onr-images.ts";
import { closedDaysWith, type ProtocolDayRow } from "./ri-protocol-days.ts";
import { officeToday } from "./ri-protocols.ts";
import { joinPdfs, tiffToPdf } from "./ri-tiff.ts";

/**
 * The books of the Registro de Imóveis (change registro-de-imoveis-livros):
 * each volume opened and closed with its termo (Lei nº 6.015/1973, art.
 * 4º), the whole book as one PDF to print or sign, and the Protocolo of
 * each day closed (art. 184). Nothing is deleted: "apagar" hides the
 * volume, every change keeps the previous values in the history.
 */

export type BookRow = typeof riBooks.$inferSelect;

const UUID = /^[0-9a-f-]{36}$/i;
const FORMS: readonly BookForm[] = [
  "fichas",
  "folhas",
  "eletronico",
  "hibrido",
];

export interface BookHistoryEntry {
  at: string;
  by: string;
  what: string;
  before: Partial<BookInput>;
}

export interface BookInput {
  book: BookNumber;
  volume: string;
  form: BookForm;
  sheetCount: number;
  firstItem: number | null;
  lastItem: number | null;
  openedOn: string;
  openingNotes: string;
}

const clean = (value: unknown, max = 2000) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

/** The form, checked. Throws RiError with what the screen shows. */
export function readBookInput(
  raw: Record<string, unknown>,
  today = officeToday(),
): BookInput {
  const book = Number(raw.book);
  if (!isBookNumber(book)) throw new RiError("Escolha o livro (1 a 5).");
  const volume = clean(raw.volume, 20).toUpperCase().replace(/\s+/g, "");
  if (
    !/^[1-5](-[A-Z0-9]{1,9})?$/.test(volume) ||
    !volume.startsWith(String(book))
  ) {
    throw new RiError(
      `O número do livro deve ser ${book}, ${book}-A, ${book}-B e assim por diante (Lei nº 6.015/1973, art. 6º).`,
    );
  }
  const form = FORMS.includes(raw.form as BookForm)
    ? (raw.form as BookForm)
    : "fichas";
  const sheetCount = readItem(clean(raw.sheetCount, 10)) ?? 0;
  if (sheetCount > 100_000) {
    throw new RiError("O número de folhas ou fichas passa do limite.");
  }
  const firstItem = readItem(clean(raw.firstItem, 12));
  const lastItem = readItem(clean(raw.lastItem, 12));
  if (firstItem !== null && lastItem !== null && lastItem < firstItem) {
    throw new RiError("O último número não pode ser menor que o primeiro.");
  }
  const openedRaw = clean(raw.openedOn, 20);
  const openedOn = openedRaw ? isoDate(openedRaw) : today;
  if (!openedOn) throw new RiError("A data de abertura não é uma data válida.");
  if (openedOn > today) {
    throw new RiError("A data de abertura não pode ser depois de hoje.");
  }
  return {
    book,
    volume,
    form,
    sheetCount,
    firstItem,
    lastItem,
    openedOn,
    openingNotes: clean(raw.openingNotes),
  };
}

export async function listBooksWith(
  database: Database,
  tenantSlug: string,
): Promise<BookRow[]> {
  const rows = await database
    .select()
    .from(riBooks)
    .where(eq(riBooks.tenantSlug, tenantSlug));
  return rows.sort(
    (a, b) =>
      a.book - b.book ||
      a.openedOn.localeCompare(b.openedOn) ||
      a.volume.localeCompare(b.volume, "pt-BR", { numeric: true }),
  );
}

export async function bookWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<BookRow | null> {
  if (!UUID.test(id)) return null;
  const [row] = await database
    .select()
    .from(riBooks)
    .where(and(eq(riBooks.tenantSlug, tenantSlug), eq(riBooks.id, id)))
    .limit(1);
  return row ?? null;
}

async function ownBook(database: Database, tenantSlug: string, id: string) {
  const row = await bookWith(database, tenantSlug, id);
  if (!row) throw new RiError("Livro não encontrado.");
  return row;
}

async function volumeTaken(
  database: Database,
  tenantSlug: string,
  input: Pick<BookInput, "book" | "volume">,
  except?: string,
) {
  const rows = await listBooksWith(database, tenantSlug);
  return rows.some(
    (r) =>
      !r.deletedAt &&
      r.id !== except &&
      r.book === input.book &&
      r.volume.toUpperCase() === input.volume,
  );
}

export const historyOf = (row: Pick<BookRow, "history">) =>
  (row.history as BookHistoryEntry[] | null) ?? [];

/** Opens a volume (art. 4º): the termo de abertura comes from it. */
export async function openBookWith(
  database: Database,
  tenantSlug: string,
  input: BookInput,
  actor: Actor,
): Promise<string> {
  if (await volumeTaken(database, tenantSlug, input)) {
    throw new RiError(`O livro ${input.volume} já está aberto aqui.`);
  }
  const [row] = await database
    .insert(riBooks)
    .values({ tenantSlug, ...input, createdBy: actor.id })
    .returning({ id: riBooks.id });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.book-open",
    targetType: "ri-book",
    targetId: row?.id,
  });
  return row?.id ?? "";
}

/**
 * The Indicador Real (Livro 4) and the Indicador Pessoal (Livro 5) are
 * kept by the system from the matrículas and the people: when they were
 * never opened, they open with the Livro 2 in use, on the same day and in
 * electronically: they are kept by the system (decision of 27/11/2026).
 * There is one Livro 4 and one Livro 5 for the whole acervo, never one per
 * Livro 2: they open once. Returns how many were opened.
 */
export async function openIndexBooksWith(
  database: Database,
  tenantSlug: string,
  actor: Actor,
): Promise<number> {
  const rows = (await listBooksWith(database, tenantSlug)).filter(
    (r) => !r.deletedAt,
  );
  const base = rows
    .filter((r) => r.book === 2 && !r.closedOn)
    .sort((a, b) => a.openedOn.localeCompare(b.openedOn))[0];
  if (!base) return 0;
  let opened = 0;
  for (const book of [4, 5] as const) {
    if (rows.some((r) => r.book === book)) continue;
    await openBookWith(
      database,
      tenantSlug,
      {
        book,
        volume: String(book),
        form: "eletronico",
        sheetCount: 0,
        firstItem: null,
        lastItem: null,
        openedOn: base.openedOn,
        openingNotes: `Aberto na data do Livro ${base.volume}, em meio eletrônico; alimentado pelas matrículas e pessoas lançadas (Lei nº 6.015/1973, arts. 179 e 180).`,
      },
      actor,
    );
    opened++;
  }
  return opened;
}

const snapshot = (row: BookRow): Partial<BookInput> => ({
  volume: row.volume,
  form: row.form as BookForm,
  sheetCount: row.sheetCount,
  firstItem: row.firstItem,
  lastItem: row.lastItem,
  openedOn: row.openedOn,
  openingNotes: row.openingNotes,
});

/** Changes the data of the volume, keeping what it had in the history. */
export async function updateBookWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: BookInput,
  actor: Actor,
): Promise<void> {
  const row = await ownBook(database, tenantSlug, id);
  if (input.book !== row.book) {
    throw new RiError("O número do livro (1 a 5) não muda depois de aberto.");
  }
  if (await volumeTaken(database, tenantSlug, input, id)) {
    throw new RiError(`O livro ${input.volume} já está aberto aqui.`);
  }
  await database
    .update(riBooks)
    .set({
      volume: input.volume,
      form: input.form,
      sheetCount: input.sheetCount,
      firstItem: input.firstItem,
      lastItem: input.lastItem,
      openedOn: input.openedOn,
      openingNotes: input.openingNotes,
      updatedAt: new Date(),
      history: [
        ...historyOf(row),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: "alterou os dados do livro",
          before: snapshot(row),
        },
      ],
    })
    .where(eq(riBooks.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.book-edit",
    targetType: "ri-book",
    targetId: id,
  });
}

/** Closes the volume (art. 4º): the termo de encerramento comes from it. */
export async function closeBookWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: {
    closedOn: string;
    lastSheet: number | null;
    lastItem: number | null;
    notes: string;
  },
  actor: Actor,
): Promise<void> {
  const row = await ownBook(database, tenantSlug, id);
  if (row.deletedAt) throw new RiError("Restaure o livro antes de encerrar.");
  const closedOn = isoDate(input.closedOn) ?? officeToday();
  if (closedOn < row.openedOn) {
    throw new RiError("O livro não pode ser encerrado antes de aberto.");
  }
  if (closedOn > officeToday()) {
    throw new RiError("A data de encerramento não pode ser depois de hoje.");
  }
  if (row.sheetCount && input.lastSheet && input.lastSheet > row.sheetCount) {
    throw new RiError(
      `A última folha (${input.lastSheet}) passa do número de folhas do livro (${row.sheetCount}).`,
    );
  }
  await database
    .update(riBooks)
    .set({
      closedOn,
      lastSheet: input.lastSheet,
      lastItem: input.lastItem ?? row.lastItem,
      closingNotes: clean(input.notes),
      updatedAt: new Date(),
      history: [
        ...historyOf(row),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: row.closedOn
            ? "alterou o encerramento do livro"
            : "encerrou o livro",
          before: { lastItem: row.lastItem },
        },
      ],
    })
    .where(eq(riBooks.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.book-close",
    targetType: "ri-book",
    targetId: id,
  });
}

/** Undoes the closing: the termo de encerramento stays in the history. */
export async function reopenBookWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actor: Actor,
): Promise<void> {
  const row = await ownBook(database, tenantSlug, id);
  if (!row.closedOn) return;
  await database
    .update(riBooks)
    .set({
      closedOn: null,
      lastSheet: null,
      closingNotes: "",
      updatedAt: new Date(),
      history: [
        ...historyOf(row),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: `desfez o encerramento de ${shortDate(row.closedOn)}${row.lastSheet ? ` (até a folha ${row.lastSheet})` : ""}${row.closingNotes ? `: ${row.closingNotes}` : ""}`,
          before: {},
        },
      ],
    })
    .where(eq(riBooks.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.book-reopen",
    targetType: "ri-book",
    targetId: id,
  });
}

/** "Apagar" hides the volume (lançado por engano); it can come back. */
export async function setBookDeletedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  deleted: boolean,
  actor: Actor,
): Promise<void> {
  const row = await ownBook(database, tenantSlug, id);
  if (Boolean(row.deletedAt) === deleted) return;
  if (
    !deleted &&
    (await volumeTaken(
      database,
      tenantSlug,
      {
        book: row.book as BookNumber,
        volume: row.volume.toUpperCase(),
      },
      id,
    ))
  ) {
    throw new RiError(
      `Já há outro livro ${row.volume} aberto: altere o número de um deles antes.`,
    );
  }
  await database
    .update(riBooks)
    .set(
      deleted
        ? { deletedAt: new Date(), deletedBy: actor.id }
        : { deletedAt: null, deletedBy: null },
    )
    .where(eq(riBooks.id, id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: deleted ? "ri.book-delete" : "ri.book-restore",
    targetType: "ri-book",
    targetId: id,
  });
}

export function recordOf(row: BookRow): BookRecord {
  return {
    book: row.book as BookNumber,
    volume: row.volume,
    form: row.form as BookForm,
    sheetCount: row.sheetCount,
    firstItem: row.firstItem,
    lastItem: row.lastItem,
    openedOn: row.openedOn,
    closedOn: row.closedOn,
    lastSheet: row.lastSheet,
    openingNotes: row.openingNotes,
    closingNotes: row.closingNotes,
  };
}

/* ------------------------------------------------------------ documents */

export function termOffice(tenant: Tenant): TermOffice {
  return {
    name: officialName(tenant),
    cns: tenant.cns,
    city: tenant.location.city,
    state: tenant.location.state,
  };
}

export async function signerLines(tenant: Tenant, withImage: boolean) {
  const { signer, settings } = await riSignerFor(tenant);
  return {
    signee: signer?.name,
    signature: signer ? [signer.title] : [],
    signatureImage: withImage
      ? (settings.signatureImage ?? undefined)
      : undefined,
  };
}

function termDocument(
  tenant: Tenant,
  term: TermText,
  signer: Awaited<ReturnType<typeof signerLines>>,
): RequerimentoDocument {
  return {
    eyebrow: term.eyebrow,
    title: term.title,
    subtitle: term.subtitle,
    office: [officialName(tenant), tenant.subtitle],
    sections: term.sections,
    dateLine: term.dateLine,
    ...signer,
    footer: `${officialName(tenant)} · ${term.subtitle} · ${term.title} · ${tenant.legalFooter}`,
    closingNotes: custasNoteFor(tenant.location.state)
      ? [{ text: custasNoteFor(tenant.location.state) as string }]
      : undefined,
  };
}

/** The termo de abertura or de encerramento of a volume, signed. */
export async function termDocumentFor(
  database: Database,
  tenant: Tenant,
  id: string,
  kind: "abertura" | "encerramento",
  withImage: boolean,
): Promise<{ document: RequerimentoDocument; name: string } | null> {
  const row = await bookWith(database, tenant.slug, id);
  if (!row) return null;
  if (kind === "encerramento" && !row.closedOn) return null;
  const record = recordOf(row);
  const term =
    kind === "abertura"
      ? openingTerm(record, termOffice(tenant))
      : closingTerm(record, termOffice(tenant));
  return {
    document: termDocument(tenant, term, await signerLines(tenant, withImage)),
    name: `livro-${row.volume.toLowerCase()}-termo-de-${kind}`,
  };
}

/** The most fichas or entries one PDF carries; past it, a smaller range. */
export const MAX_FICHAS = 300;
export const MAX_PROTOCOL_LINES = 2000;

function protocolLineOf(row: typeof riProtocols.$inferSelect): ProtocolLine {
  return {
    number: row.number,
    presentedOn: row.presentedOn,
    presenter: row.presenterName,
    titleKind: row.titleKind,
    acts: row.actsSummary,
    voided: Boolean(row.voidedAt),
  };
}

/** The prenotações of a span of days, grouped by day (art. 12, p. único). */
export async function protocolDaysWith(
  database: Database,
  tenantSlug: string,
  from: string,
  to: string,
): Promise<Map<string, ProtocolLine[]>> {
  const rows = await database
    .select()
    .from(riProtocols)
    .where(
      and(
        eq(riProtocols.tenantSlug, tenantSlug),
        eq(riProtocols.kind, "prenotacao"),
      ),
    );
  const days = new Map<string, ProtocolLine[]>();
  for (const row of rows) {
    if (row.presentedOn < from || row.presentedOn > to) continue;
    const list = days.get(row.presentedOn) ?? [];
    list.push(protocolLineOf(row));
    days.set(row.presentedOn, list);
  }
  return new Map([...days.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** The Protocolo of one day, closed (art. 184), signed by the oficial. */
export async function protocolDayDocumentFor(
  database: Database,
  tenant: Tenant,
  day: string,
  withImage: boolean,
): Promise<RequerimentoDocument> {
  const days = await protocolDaysWith(database, tenant.slug, day, day);
  const closed = (await closedDaysWith(database, tenant.slug)).get(day);
  return {
    eyebrow: "Registro de Imóveis · Livro nº 1 · Protocolo",
    title: `Protocolo do dia ${shortDate(day)}`,
    subtitle: "Encerramento diário (Lei nº 6.015/1973, art. 184)",
    office: [officialName(tenant), tenant.subtitle],
    sections: protocolDay(day, days.get(day) ?? [], recordedText(closed)),
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${shortDate(day)}.`,
    ...(await signerLines(tenant, withImage)),
    footer: `${officialName(tenant)} · Livro nº 1 · Protocolo de ${shortDate(day)} · ${tenant.legalFooter}`,
  };
}

/** The closing as recorded for the day, in the words of the Livro 1. */
function recordedText(row: ProtocolDayRow | undefined): string | undefined {
  if (!row) return undefined;
  return closingText(
    row.day,
    { kind: row.kind as ClosingKind, why: row.why },
    { count: row.count, first: row.firstNumber, last: row.lastNumber },
  );
}

export interface BookRange {
  /** Matrículas or registros (Livros 2 and 3); dates (Livro 1). */
  from?: string;
  to?: string;
}

export class BookTooLarge extends Error {}

/**
 * The whole volume as one PDF: the termo de abertura, the content, and the
 * termo de encerramento when it is closed. Livros 2 and 3 are their
 * fichas; the Livro 1, its days, each closed; the Livros 4 and 5, the
 * indicadores from the acervo.
 */
export async function bookDocumentsFor(
  database: Database,
  tenant: Tenant,
  id: string,
  range: BookRange,
  withImage: boolean,
): Promise<{
  documents: RequerimentoDocument[];
  /** documents[i] is replaced by the signed image of the ficha. */
  images: Map<number, Uint8Array>;
  name: string;
} | null> {
  const row = await bookWith(database, tenant.slug, id);
  if (!row) return null;
  const record = recordOf(row);
  const office = termOffice(tenant);
  const signer = await signerLines(tenant, withImage);
  const documents: RequerimentoDocument[] = [
    termDocument(tenant, openingTerm(record, office), signer),
  ];
  const info = BOOKS[record.book];
  const images = new Map<number, Uint8Array>();
  const footer = `${officialName(tenant)} · ${info.name} · ${row.volume} · ${tenant.legalFooter}`;
  if (record.book === 1) {
    const from = isoDate(range.from ?? "") ?? row.openedOn;
    const to = isoDate(range.to ?? "") ?? row.closedOn ?? officeToday();
    // A volume with its números (1, 1-B…) takes only its own títulos: two
    // volumes can share the day one closed and the other opened.
    const low = record.firstItem ?? 1;
    const high = record.lastItem ?? Number.MAX_SAFE_INTEGER;
    const days = new Map(
      [...(await protocolDaysWith(database, tenant.slug, from, to))]
        .map(
          ([day, lines]) =>
            [
              day,
              lines.filter((l) => l.number >= low && l.number <= high),
            ] as const,
        )
        .filter(([, lines]) => lines.length > 0),
    );
    const total = [...days.values()].reduce((n, l) => n + l.length, 0);
    if (total > MAX_PROTOCOL_LINES) {
      throw new BookTooLarge(
        `São ${total} títulos nesse período; escolha um período com até ${MAX_PROTOCOL_LINES}.`,
      );
    }
    // The closed days without títulos go in the book too, on their date.
    const closed = await closedDaysWith(database, tenant.slug);
    for (const [day, row] of closed) {
      // The days of the physical book have no termo of their own here.
      if (row.kind === "livro-fisico") continue;
      if (day >= from && day <= to && !days.has(day)) days.set(day, []);
    }
    const ordered = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [day, lines] of ordered) {
      documents.push({
        eyebrow: `Registro de Imóveis · ${info.name} · ${row.volume}`,
        title: `Protocolo do dia ${shortDate(day)}`,
        subtitle: "Lei nº 6.015/1973, arts. 175 e 184",
        office: [officialName(tenant), tenant.subtitle],
        sections: protocolDay(day, lines, recordedText(closed.get(day))),
        ...signer,
        footer,
      });
    }
  } else {
    const acervo = await loadAcervoWith(database, tenant.slug);
    if (record.book === 2 || record.book === 3) {
      const from = readItem(range.from ?? "") ?? record.firstItem ?? 1;
      const to =
        readItem(range.to ?? "") ?? record.lastItem ?? Number.MAX_SAFE_INTEGER;
      const items = acervo.properties.filter(
        (p) =>
          !p.deletedAt &&
          p.book === record.book &&
          p.number >= from &&
          p.number <= to,
      );
      if (items.length > MAX_FICHAS) {
        throw new BookTooLarge(
          `São ${items.length} fichas nesse intervalo; escolha um intervalo com até ${MAX_FICHAS}.`,
        );
      }
      const { signer: who } = await riSignerFor(tenant);
      // The Livro 2 is one digital book, the same one printed: where the
      // ficha was signed for the ONR, its page is that image.
      const signed =
        record.book === 2
          ? new Map(
              currentOf(
                await database
                  .select({
                    id: riOnrImages.id,
                    number: riOnrImages.number,
                    tiff: riOnrImages.tiff,
                    createdAt: riOnrImages.createdAt,
                    deletedAt: riOnrImages.deletedAt,
                  })
                  .from(riOnrImages)
                  .where(eq(riOnrImages.tenantSlug, tenant.slug)),
              ).map((r) => [r.number, r.tiff]),
            )
          : new Map<number, string>();
      for (const p of items) {
        const image = signed.get(p.number);
        if (image) images.set(documents.length, Buffer.from(image, "base64"));
        const content = fichaContent({
          office: {
            name: officialName(tenant),
            city: tenant.location.city,
            state: tenant.location.state,
          },
          property: p,
          acts: acervo.acts.get(p.id) ?? [],
          signer: who,
        });
        documents.push({
          eyebrow: `Registro de Imóveis · ${content.book} · ${row.volume}`,
          title: content.title,
          subtitle: content.cnm ? `CNM ${content.cnm}` : "CNM não lançado",
          office: [content.office, tenant.subtitle],
          sections: content.blocks.map((block) => ({
            heading: block.meta
              ? `${block.label} · ${block.meta}`
              : block.label,
            paragraphs: block.text.split("\n").filter(Boolean),
          })),
          ...signer,
          footer,
          closingNotes: custasNoteFor(tenant.location.state)
            ? [{ text: custasNoteFor(tenant.location.state) as string }]
            : undefined,
        });
      }
    } else {
      // Livros 4 and 5 in the columns of the models annexed to the Lei nº
      // 6.015/1973, with the year of the book in the header.
      const isReal = record.book === 4;
      const table = isReal
        ? realIndicatorTable(acervo)
        : personalIndicatorTable(acervo);
      const year = row.openedOn.slice(0, 4);
      documents.push({
        eyebrow: `Registro de Imóveis · ${info.name} · ${row.volume}`,
        title: isReal ? "Indicador Real" : "Indicador Pessoal",
        subtitle: `Livro nº ${record.book} · Ano: ${year} · ${table.rows.length} ${isReal ? (table.rows.length === 1 ? "imóvel" : "imóveis") : table.rows.length === 1 ? "nome" : "nomes"} (Lei nº 6.015/1973, art. ${isReal ? "179" : "180"}; modelo anexo à lei)`,
        office: [officialName(tenant), tenant.subtitle],
        sections: [
          {
            heading: isReal
              ? "Registro de Imóveis · Indicador Real"
              : "Registro de Imóveis · Indicador Pessoal",
            table: {
              columns: table.columns.map((label, i) => ({
                label,
                weight: i === 0 ? 0.6 : i === 1 ? 2.4 : i === 2 ? 1.6 : 1.4,
              })),
              rows: table.rows,
              empty: "Nenhum lançamento ainda.",
            },
          },
        ],
        ...signer,
        footer,
      });
    }
  }
  if (row.closedOn) {
    documents.push(termDocument(tenant, closingTerm(record, office), signer));
  }
  return { documents, images, name: `livro-${row.volume.toLowerCase()}` };
}

/** The fichas a volume of the Livro 2 or 3 holds now, for signing in lots. */
export async function bookFichasWith(
  database: Database,
  tenantSlug: string,
  row: BookRow,
): Promise<{ id: string; number: number; title: string }[]> {
  if (row.book !== 2 && row.book !== 3) return [];
  const acervo = await loadAcervoWith(database, tenantSlug);
  const from = row.firstItem ?? 1;
  const to = row.lastItem ?? Number.MAX_SAFE_INTEGER;
  return acervo.properties
    .filter(
      (p) =>
        !p.deletedAt &&
        p.book === row.book &&
        p.number >= from &&
        p.number <= to,
    )
    .map((p) => ({ id: p.id, number: p.number, title: propertyTitle(p) }));
}

/* ------------------------------------- the books in the model of the law */

const brDay = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/**
 * The whole volume as the models annexed to the Lei nº 6.015/1973: the
 * termo de abertura, the body in the columns of the model (or the fichas,
 * with the signed image where there is one) and the termo de encerramento.
 */
export async function bookPdfFor(
  database: Database,
  tenant: Tenant,
  id: string,
  range: BookRange,
  withImage: boolean,
  options: {
    /** The selo of each ato: none, its number, or number and image. */
    seal?: "nenhum" | "numero" | "imagem";
    /** Word, for the office to adjust. */
    word?: boolean;
  } = {},
): Promise<{ bytes: Uint8Array; name: string; word?: boolean } | null> {
  const sealMode = options.seal ?? "numero";
  const blocks: WordBlock[] = [];
  const row = await bookWith(database, tenant.slug, id);
  if (!row) return null;
  const record = recordOf(row);
  const office = termOffice(tenant);
  const signer = await signerLines(tenant, withImage);
  const brand = await brandFor(tenant);
  const parts: Uint8Array[] = [];
  const addTerm = async (doc: RequerimentoDocument) => {
    if (options.word) blocks.push({ kind: "term", document: doc });
    else parts.push(await renderDocument(doc, brand));
  };
  const addTable = async (book: TableBook) => {
    if (options.word) blocks.push({ kind: "table", book });
    else
      parts.push(
        await drawTableBook({
          ...book,
          closingNote: custasNoteFor(tenant.location.state),
        }),
      );
  };
  await addTerm(termDocument(tenant, openingTerm(record, office), signer));
  const footer = `${officialName(tenant)} · Livro nº ${row.volume}`;
  const year = `ANO: ${(row.closedOn ?? officeToday()).slice(0, 4)}`;
  if (record.book === 1) {
    const from = isoDate(range.from ?? "") ?? row.openedOn;
    const to = isoDate(range.to ?? "") ?? row.closedOn ?? officeToday();
    const days = await protocolDaysWith(database, tenant.slug, from, to);
    const closed = await closedDaysWith(database, tenant.slug);
    for (const [day, row] of closed) {
      // The days of the physical book have no termo of their own here.
      if (row.kind === "livro-fisico") continue;
      if (day >= from && day <= to && !days.has(day)) days.set(day, []);
    }
    const total = [...days.values()].reduce((n, l) => n + l.length, 0);
    if (total > MAX_PROTOCOL_LINES) {
      throw new BookTooLarge(
        `São ${total} títulos nesse período; escolha um período com até ${MAX_PROTOCOL_LINES}.`,
      );
    }
    const rows: TableRow[] = [];
    for (const [day, lines] of [...days.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      for (const l of [...lines].sort((a, b) => a.number - b.number)) {
        rows.push({
          cells: [
            l.number.toLocaleString("pt-BR"),
            brDay(l.presentedOn),
            l.presenter,
            l.titleKind,
            [l.acts, l.voided ? "Lançado por engano, sem efeito." : ""]
              .filter(Boolean)
              .join(" "),
          ],
        });
      }
      const text = recordedText(closed.get(day));
      rows.push({
        across:
          text ??
          `Protocolo do dia ${brDay(day)} ainda não encerrado (art. 184).`,
        bold: Boolean(text),
      });
    }
    await addTable({
      title: "PROTOCOLO",
      book: 1,
      volume: row.volume,
      year,
      columns: [
        { label: "Nº de ordem", width: 0.1 },
        { label: "Data", width: 0.13 },
        { label: "NOME DO APRESENTANTE", width: 0.25 },
        { label: "Natureza formal do título", width: 0.22 },
        { label: "ANOTAÇÕES", width: 0.3 },
      ],
      rows,
      footer,
    });
  } else {
    const acervo = await loadAcervoWith(database, tenant.slug);
    if (record.book === 2) {
      const from = readItem(range.from ?? "") ?? record.firstItem ?? 1;
      const to =
        readItem(range.to ?? "") ?? record.lastItem ?? Number.MAX_SAFE_INTEGER;
      const items = acervo.properties.filter(
        (p) =>
          !p.deletedAt && p.book === 2 && p.number >= from && p.number <= to,
      );
      if (items.length > MAX_FICHAS) {
        throw new BookTooLarge(
          `São ${items.length} fichas nesse intervalo; escolha um intervalo com até ${MAX_FICHAS}.`,
        );
      }
      const signed = new Map(
        currentOf(
          await database
            .select({
              id: riOnrImages.id,
              number: riOnrImages.number,
              tiff: riOnrImages.tiff,
              createdAt: riOnrImages.createdAt,
              deletedAt: riOnrImages.deletedAt,
            })
            .from(riOnrImages)
            .where(eq(riOnrImages.tenantSlug, tenant.slug)),
        ).map((r) => [r.number, r.tiff]),
      );
      const sealImages = new Map<string, Uint8Array>();
      if (sealMode === "imagem") {
        const rows = await database
          .select({ id: riActs.id, image: riActs.sealImage })
          .from(riActs)
          .where(
            and(eq(riActs.tenantSlug, tenant.slug), ne(riActs.sealImage, "")),
          );
        for (const r of rows) {
          sealImages.set(r.id, new Uint8Array(Buffer.from(r.image, "base64")));
        }
      }
      let run: FichaPage[] = [];
      const flush = async () => {
        if (run.length) {
          if (options.word) blocks.push({ kind: "fichas", fichas: run });
          else
            parts.push(
              await drawFichas(run, null, custasNoteFor(tenant.location.state)),
            );
        }
        run = [];
      };
      for (const p of items) {
        const image = signed.get(p.number);
        if (image) {
          // The Livro 2 digital: the signed ficha is the page.
          await flush();
          if (options.word) {
            blocks.push({
              kind: "image",
              tiff: Buffer.from(image, "base64"),
              label: `Matrícula nº ${String(p.number).padStart(3, "0")} (imagem assinada)`,
            });
          } else {
            parts.push(await tiffToPdf(Buffer.from(image, "base64")));
          }
          continue;
        }
        const acts = acervo.acts.get(p.id) ?? [];
        run.push(
          fichaPageOf(tenant, p, acts, row.volume, footer, (a) => ({
            seal: sealMode === "nenhum" ? undefined : a.seal || undefined,
            sealImage: sealImages.get(a.id),
          })),
        );
      }
      await flush();
    } else if (record.book === 3) {
      const items = acervo.properties
        .filter(
          (p) =>
            !p.deletedAt &&
            p.book === 3 &&
            p.number >= (record.firstItem ?? 1) &&
            p.number <= (record.lastItem ?? Number.MAX_SAFE_INTEGER),
        )
        .sort((a, b) => a.number - b.number);
      await addTable({
        title: "REGISTRO AUXILIAR",
        book: 3,
        volume: row.volume,
        year,
        columns: [
          { label: "Nº de ordem", width: 0.09 },
          { label: "Data", width: 0.12 },
          { label: "REGISTRO", width: 0.41 },
          { label: "Ref. aos demais livros", width: 0.14 },
          { label: "AVERBAÇÕES", width: 0.24 },
        ],
        rows: items.map((p) => ({
          cells: [
            p.number.toLocaleString("pt-BR"),
            brDay(p.openedOn),
            [p.auxKind, ...auxText(p.auxKind, p.aux, "")]
              .filter(Boolean)
              .join(" "),
            p.linkedNumbers ? `Mat. ${p.linkedNumbers}` : "",
            [
              ...(acervo.acts.get(p.id) ?? [])
                .filter((a) => a.kind === "AV")
                .map((a) => `${actLabel(a)} ${a.nature} ${a.summary}`),
              ...notesOf(p.aux.annotations)
                .filter((n) => !n.deletedAt)
                .map((n) => `${brDay(n.on)} ${n.text}`),
            ]
              .join(" · ")
              .trim(),
          ],
        })),
        footer,
      });
    } else if (record.book === 4) {
      const items = acervo.properties
        .filter((p) => !p.deletedAt && p.book === 2 && p.status !== 4)
        .sort((a, b) => addressLine(a).localeCompare(addressLine(b), "pt-BR"));
      await addTable({
        title: "INDICADOR REAL",
        book: 4,
        volume: row.volume,
        year,
        columns: [
          { label: "Nº de ordem", width: 0.1 },
          { label: "IDENTIFICAÇÃO DO IMÓVEL", width: 0.5 },
          { label: "Referência aos demais livros", width: 0.2 },
          { label: "ANOTAÇÕES", width: 0.2 },
        ],
        rows: items.map((p, i) => ({
          cells: [
            String(i + 1),
            [
              addressLine(p),
              p.rural.denominacao,
              p.rural.ccir && `CCIR ${p.rural.ccir}`,
              p.rural.car && `CAR ${p.rural.car}`,
            ]
              .filter(Boolean)
              .join(" · ") || propertyTitle(p),
            `Livro 2, matrícula ${p.number.toLocaleString("pt-BR")}`,
            p.cnm ? `CNM ${formatCnm(p.cnm)}` : "",
          ],
        })),
        footer,
      });
    } else {
      const people = new Map<
        string,
        { name: string; refs: Set<string>; roles: Set<string> }
      >();
      for (const p of acervo.properties) {
        if (p.deletedAt) continue;
        const ref =
          p.book === 3
            ? `L3 nº ${p.number.toLocaleString("pt-BR")}`
            : `Mat. ${p.number.toLocaleString("pt-BR")}`;
        const add = (name: string, document: string, role: string) => {
          const key = document || name.toUpperCase();
          const entry = people.get(key) ?? {
            name: document ? `${name}, ${formatTaxId(document)}` : name,
            refs: new Set<string>(),
            roles: new Set<string>(),
          };
          entry.refs.add(ref);
          if (role) entry.roles.add(role);
          people.set(key, entry);
        };
        if (p.book === 3) {
          for (const party of p.aux.parties) {
            add(party.name, party.document, AUX_ROLE_LABELS[party.role] ?? "");
          }
        }
        for (const person of matriculaPeople(acervo.acts.get(p.id) ?? [])) {
          add(person.name, person.document, person.situation.join(", "));
        }
      }
      const rows = [...people.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      );
      await addTable({
        title: "INDICADOR PESSOAL",
        book: 5,
        volume: row.volume,
        year,
        columns: [
          { label: "Nº de ordem", width: 0.1 },
          { label: "PESSOAS", width: 0.42 },
          { label: "Referência aos demais livros", width: 0.26 },
          { label: "ANOTAÇÕES", width: 0.22 },
        ],
        rows: rows.map((e, i) => ({
          cells: [
            String(i + 1),
            e.name,
            [...e.refs].join("; "),
            [...e.roles].join(", "),
          ],
        })),
        footer,
      });
    }
  }
  if (row.closedOn) {
    await addTerm(termDocument(tenant, closingTerm(record, office), signer));
  }
  const name = `livro-${row.volume.toLowerCase()}`;
  if (options.word) {
    return {
      bytes: new Uint8Array(await bookToWord(`Livro nº ${row.volume}`, blocks)),
      name,
      word: true,
    };
  }
  return { bytes: await joinPdfs(parts), name };
}

/**
 * One matrícula as the ficha of the Livro 2 annexed to the Lei nº
 * 6.015/1973 (decision of 26/11/2026: "todos têm que seguir os modelos da
 * lei"): for the PDF of the matrícula, the image for the ONR and the
 * printing. With `signer`, the place, date and who signs close the ficha;
 * the image of the signature only with `withImage`. A registro of the
 * Livro 3 comes out as its row of the model of the Livro 3.
 */
/** The ficha of one matrícula, as drawFichas takes it. */
function fichaPageOf(
  tenant: Tenant,
  p: Awaited<ReturnType<typeof loadAcervoWith>>["properties"][number],
  acts: Act[],
  volume: string,
  footer: string,
  extra: (a: Act) => { seal?: string; sealImage?: Uint8Array } = (a) => ({
    seal: a.seal || undefined,
  }),
): FichaPage {
  const people = matriculaPeople(acts);
  const who = (list: typeof people) =>
    list
      .map(
        (o) =>
          `${o.name}${o.document ? `, CPF/CNPJ nº ${formatTaxId(o.document)}` : ""}${o.acts.length ? ` (${o.acts.join(", ")})` : ""}`,
      )
      .join("; ");
  const current = situationOf(acts).owners;
  const digits = (tenant.cns ?? "").replace(/\D/g, "");
  return {
    volume,
    sheet: Number(p.ficha) || p.number,
    matricula: p.number,
    date: brDay(p.openedOn),
    identificationLabel: p.location === 1 ? "IMÓVEL RURAL" : "IMÓVEL URBANO",
    identification: p.description || propertyTitle(p),
    memorial: "",
    owner: current
      .map((o) =>
        o.document
          ? `${o.name}, CPF/CNPJ nº ${formatTaxId(o.document)}`
          : o.name,
      )
      .join("; "),
    previousOwners: who(
      people.filter((x) => x.situation.includes("Proprietário anterior")),
    ),
    previous: p.origin,
    acts: acts
      .filter((a) => a.kind !== "M")
      .map((a) => ({
        label: `${actLabel(a, p.number)}${a.registeredOn ? ` \u2013 Data: ${brDay(a.registeredOn)}` : ""}`,
        text: [a.nature, a.summary].filter(Boolean).join(". "),
        ...extra(a),
      })),
    cnm: p.cnm ? formatCnm(p.cnm) : "",
    cns:
      digits.length === 6
        ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}-${digits.slice(5)}`
        : tenant.cns,
    footer,
  };
}

export async function fichaLegalPdfWith(
  database: Database,
  tenant: Tenant,
  propertyId: string,
  options: { signer?: boolean; withImage?: boolean } = {},
): Promise<{ bytes: Buffer; number: number } | null> {
  const acervo = await loadAcervoWith(database, tenant.slug);
  const p = acervo.properties.find((x) => x.id === propertyId);
  if (!p || p.deletedAt) return null;
  const acts = acervo.acts.get(p.id) ?? [];
  const footer = officialName(tenant);
  const openBook = (await listBooksWith(database, tenant.slug)).find(
    (b) => b.book === p.book && !b.deletedAt && !b.closedOn,
  );
  const volume = openBook?.volume ?? String(p.book);
  if (p.book === 3) {
    const bytes = await drawTableBook({
      closingNote: custasNoteFor(tenant.location.state),
      title: "REGISTRO AUXILIAR",
      book: 3,
      volume,
      year: `ANO: ${(p.openedOn ?? officeToday()).slice(0, 4)}`,
      columns: [
        { label: "Nº de ordem", width: 0.09 },
        { label: "Data", width: 0.12 },
        { label: "REGISTRO", width: 0.41 },
        { label: "Ref. aos demais livros", width: 0.14 },
        { label: "AVERBAÇÕES", width: 0.24 },
      ],
      rows: [
        {
          cells: [
            p.number.toLocaleString("pt-BR"),
            brDay(p.openedOn),
            [p.auxKind, ...auxText(p.auxKind, p.aux, "")]
              .filter(Boolean)
              .join(" "),
            p.linkedNumbers ? `Mat. ${p.linkedNumbers}` : "",
            acts
              .filter((a) => a.kind === "AV")
              .map((a) => `${actLabel(a)} ${a.nature} ${a.summary}`)
              .join(" · "),
          ],
        },
      ],
      footer,
    });
    return { bytes, number: p.number };
  }
  const { signer, settings } = await riSignerFor(tenant);
  const today = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const bytes = await drawFichas(
    [fichaPageOf(tenant, p, acts, volume, footer)],
    options.signer && signer
      ? {
          name: signer.name,
          title: signer.title,
          place: `${tenant.location.city}/${tenant.location.state}, ${today}.`,
          image:
            options.withImage && settings.signatureImage
              ? settings.signatureImage
              : undefined,
        }
      : null,
    custasNoteFor(tenant.location.state),
  );
  return { bytes, number: p.number };
}

export interface ProtocolVolume {
  /** "1", "1-B", "1-C"… */
  volume: string;
  first: number;
  /** Empty: the volume in use. */
  last: number | null;
  form: BookForm;
  sheetCount: number;
}

/**
 * Opens the volumes of the Livro 1 from their números (decision of
 * 27/11/2026): the dates come from the títulos already in the Protocolo,
 * the first one's for the abertura and the last one's for the
 * encerramento. A volume already open is left as it is.
 */
export async function openProtocolVolumesWith(
  database: Database,
  tenantSlug: string,
  volumes: ProtocolVolume[],
  actor: Actor,
  today = officeToday(),
): Promise<{ opened: string[]; kept: string[] }> {
  const rows = await database
    .select({
      number: riProtocols.number,
      presentedOn: riProtocols.presentedOn,
    })
    .from(riProtocols)
    .where(
      and(
        eq(riProtocols.tenantSlug, tenantSlug),
        eq(riProtocols.kind, "prenotacao"),
      ),
    );
  const opened: string[] = [];
  const kept: string[] = [];
  const sorted = [...volumes].sort((a, b) => a.first - b.first);
  for (const v of sorted) {
    const input = readBookInput(
      {
        book: 1,
        volume: v.volume,
        form: v.form,
        sheetCount: String(v.sheetCount || ""),
        firstItem: String(v.first),
        lastItem: v.last === null ? "" : String(v.last),
        openedOn: "",
      },
      today,
    );
    if (await volumeTaken(database, tenantSlug, input)) {
      kept.push(input.volume);
      continue;
    }
    const high = v.last ?? Number.MAX_SAFE_INTEGER;
    const dates = rows
      .filter((r) => r.number >= v.first && r.number <= high)
      .map((r) => r.presentedOn)
      .sort();
    const id = await openBookWith(
      database,
      tenantSlug,
      {
        ...input,
        openedOn: dates[0] ?? today,
        openingNotes:
          "Livro aberto pelo sistema a partir dos números de ordem; a data é a do primeiro título lançado nele. Confira com o termo de abertura do livro.",
      },
      actor,
    );
    if (v.last !== null) {
      await closeBookWith(
        database,
        tenantSlug,
        id,
        {
          closedOn: dates.at(-1) ?? dates[0] ?? today,
          lastSheet: null,
          lastItem: v.last,
          notes:
            "Encerrado pelo sistema na data do último título lançado no livro. Confira com o termo de encerramento do livro físico.",
        },
        actor,
      );
    }
    opened.push(input.volume);
  }
  return { opened, kept };
}

/** "1", "1-b", "Livro 1-B", "livro nº 1 - B" → "1-B"; anything else null. */
export function protocolVolumeOf(value: string): string | null {
  const v = value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/LIVRO|N[º°O]\.?|\s+/g, "")
    .replace(/^0+(?=\d)/, "");
  const m = /^1-?([A-Z0-9]{1,9})?$/.exec(v);
  if (!m) return null;
  return m[1] ? `1-${m[1]}` : "1";
}
