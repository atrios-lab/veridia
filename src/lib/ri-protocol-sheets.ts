import "server-only";
import { and, eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { volumeLetter, volumeName } from "@/core/ri/books.ts";
import {
  DEFAULT_PAGING,
  faceLabel,
  type Pagination,
  type PagingSettings,
  paginate,
  pagingOf,
  SHEET_LAYOUT,
  type SheetClosing,
  type SheetEntry,
  type Side,
} from "@/core/ri/protocol-sheets.ts";
import { officialName } from "@/core/tenant/identification.ts";
import { NEUTRALS } from "@/core/tenant/palette.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { riBooks, riProtocols } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { DIGITAL_SIGNATURE_NOTE, isDigitalSigning } from "./pdf.ts";
import { type Actor, RiError } from "./ri.ts";
import {
  BookTooLarge,
  bookWith,
  historyOf,
  listBooksWith,
  MAX_PROTOCOL_LINES,
} from "./ri-books.ts";
import { closedDaysWith } from "./ri-protocol-days.ts";
import { officeToday } from "./ri-protocols.ts";
import type { PrintChoice } from "./ri-signers.ts";

/**
 * The folhas of the Livro 1 printed from the system (book in folhas or
 * hybrid): where each título and each termo diário falls, and the PDF of
 * the faces, in the columns of the book the office used.
 */

const brDay = (iso: string) => iso.split("-").reverse().join("/");

/** The termo of the day, as the stamp of the book said it (art. 261). */
export function dayTermText(day: string, count: number, place: string): string {
  const what =
    count === 0
      ? "sem movimento"
      : `protocolando ${count} ${count === 1 ? "título" : "títulos"}`;
  return `Termo de encerramento. Declaro encerrado o expediente de hoje, ${what}. ${place}, ${brDay(day)}.`;
}

export interface BookSheets {
  /** The volume: "1", "1-B"… */
  volume: string;
  paging: PagingSettings;
  pagination: Pagination;
  /**
   * The folhas are the book's own (its "a partir do nº" is set). When not,
   * the faces print in the book's model with "Folha ____" for the hand.
   */
  numbered: boolean;
}

/**
 * The layout of a Livro 1, always with its folhas numbered (decision of
 * 28/11/2026): the whole volume from folha 1 (anverso and verso, as the
 * physical books were), each título on the folha the import gave when it
 * did, and the part the system writes from the folha set in "Folhas do
 * livro". Past the folhas foreseen, it goes on to the last one used.
 */
export async function bookSheetsWith(
  database: Database,
  tenant: Tenant,
  id: string,
): Promise<BookSheets | null> {
  const book = await bookWith(database, tenant.slug, id);
  if (!book || book.book !== 1 || book.deletedAt) return null;
  const configured = pagingOf(book.paging);
  const rows = await database
    .select()
    .from(riProtocols)
    .where(
      and(
        eq(riProtocols.tenantSlug, tenant.slug),
        eq(riProtocols.kind, "prenotacao"),
      ),
    );
  const low = book.firstItem ?? 1;
  const high = book.lastItem ?? Number.MAX_SAFE_INTEGER;
  const own = rows.filter((r) => r.number >= low && r.number <= high);
  const from = own.reduce(
    (n, r) => Math.min(n, r.number),
    configured.fromItem ?? Number.MAX_SAFE_INTEGER,
  );
  // The whole volume from folha 1; the part set in "Folhas do livro"
  // starts where it was set.
  const paging: PagingSettings = {
    ...configured,
    fromItem: from === Number.MAX_SAFE_INTEGER ? low : from,
    fromSheet: 1,
    fromSide: "frente",
  };
  const startHint = configured.fromItem
    ? `${configured.fromSheet}${configured.fromSide === "verso" ? "-v" : ""}`
    : null;
  const perDay = new Map<string, number>();
  for (const r of rows) {
    perDay.set(r.presentedOn, (perDay.get(r.presentedOn) ?? 0) + 1);
  }
  const entries: SheetEntry[] = own.map((r) => ({
    number: r.number,
    presentedOn: r.presentedOn,
    presenter: r.presenterName,
    titleKind: r.titleKind,
    acts: r.actsSummary,
    voided: Boolean(r.voidedAt),
    sheet:
      r.sheetLabel ??
      (configured.fromItem && r.number === configured.fromItem
        ? startHint
        : null),
  }));
  const first =
    entries.reduce<string | null>(
      (d, e) => (d === null || e.presentedOn < d ? e.presentedOn : d),
      null,
    ) ?? book.openedOn;
  const last = book.closedOn ?? officeToday();
  const place = `${tenant.location.city}/${tenant.location.state}`;
  const closings: SheetClosing[] = [];
  // Every closed day, those of the physical book too: its stamp said the
  // same ("Declaro encerrado o expediente de hoje").
  for (const [day] of await closedDaysWith(database, tenant.slug)) {
    if (day < first || day > last) continue;
    closings.push({ day, text: dayTermText(day, perDay.get(day) ?? 0, place) });
  }
  return {
    volume: book.volume,
    numbered: true,
    paging: configured.fromItem ? configured : paging,
    pagination: paginate(entries, closings, paging),
  };
}

/** Saves where the folhas begin; the previous values go to the history. */
export async function setBookPagingWith(
  database: Database,
  tenantSlug: string,
  id: string,
  raw: Record<string, unknown>,
  actor: Actor,
): Promise<void> {
  const book = await bookWith(database, tenantSlug, id);
  if (!book || book.deletedAt) throw new RiError("Livro não encontrado.");
  if (book.book !== 1) {
    throw new RiError("A contagem de folhas é do Livro 1 (Protocolo).");
  }
  const paging = pagingOf(raw);
  if (!paging.fromItem) {
    throw new RiError(
      "Diga a partir de qual número de ordem o sistema imprime as folhas.",
    );
  }
  if (book.sheetCount && paging.fromSheet > book.sheetCount) {
    throw new RiError(
      `A folha ${paging.fromSheet} passa do número de folhas do livro (${book.sheetCount}).`,
    );
  }
  await database
    .update(riBooks)
    .set({
      paging,
      updatedAt: new Date(),
      history: [
        ...historyOf(book),
        {
          at: new Date().toISOString(),
          by: actor.id,
          what: `definiu as folhas: a partir do nº ${paging.fromItem}, na folha ${faceLabel(paging.fromSheet, paging.fromSide)}`,
          before: { paging: book.paging },
        },
      ],
    })
    .where(eq(riBooks.id, book.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.book-paging",
    targetType: "ri-book",
    targetId: book.id,
  });
}

// ------------------------------------------------------------------ PDF

type Pdf = InstanceType<typeof PDFDocument>;

const PAGE = { width: 595.28, height: 841.89 };
const LEFT = 32;
const TABLE_TOP = 92;
const HEAD_H = 26;
const BODY_TOP = TABLE_TOP + HEAD_H;
const LINE_H = 16.4;
const INK = NEUTRALS.text;
const SOFT = NEUTRALS.faint;

const columnX = (() => {
  const xs: number[] = [];
  let x = LEFT;
  for (const c of SHEET_LAYOUT.columns) {
    xs.push(x);
    x += c.width;
  }
  xs.push(x);
  return xs;
})();
const RIGHT = columnX.at(-1) ?? PAGE.width - LEFT;

/** Writes one line inside a width, smaller when it would not fit. */
function fitText(
  pdf: Pdf,
  text: string,
  x: number,
  y: number,
  width: number,
  size = 8.5,
  font = "Helvetica",
) {
  let s = size;
  pdf.font(font).fontSize(s);
  while (s > 5 && pdf.widthOfString(text) > width) {
    s -= 0.25;
    pdf.fontSize(s);
  }
  pdf.fillColor(INK).text(text, x, y, { width, lineBreak: false });
}

function drawFace(
  pdf: Pdf,
  tenant: Tenant,
  sheets: BookSheets,
  sheet: number,
  side: Side,
  choice: PrintChoice | null,
) {
  // The rubrica in the upper right corner, as on the physical book.
  if (choice?.rubric && choice.signer?.rubricImage) {
    pdf.image(Buffer.from(choice.signer.rubricImage), RIGHT - 70, 4, {
      fit: [70, 20],
      align: "right",
    });
  }
  const { volume, pagination } = sheets;
  const items = pagination.items.filter(
    (i) => i.sheet === sheet && i.side === side,
  );
  const years = items
    .map((i) =>
      i.kind === "entry"
        ? i.entry.presentedOn
        : i.kind === "termo"
          ? i.closing.day
          : "",
    )
    .filter(Boolean)
    .map((d) => d.slice(0, 4));
  const year = [...new Set(years)].join("/");
  // Heading, as the printed book: Livro Nº, Registro de Imóveis, Ano.
  pdf.font("Helvetica").fontSize(11).fillColor(INK);
  pdf.text("Livro nº 1", LEFT, 26, { lineBreak: false });
  if (volumeLetter(volume)) {
    pdf.fontSize(9).text(`Letra ${volumeLetter(volume)}`, LEFT, 42, {
      lineBreak: false,
    });
  }
  pdf
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("REGISTRO DE IMÓVEIS", LEFT, 28, {
      width: RIGHT - LEFT,
      align: "center",
      characterSpacing: 2,
    });
  pdf
    .font("Helvetica")
    .fontSize(9)
    .text("PROTOCOLO", LEFT, 46, {
      width: RIGHT - LEFT,
      align: "center",
      characterSpacing: 3,
    });
  pdf
    .fontSize(11)
    .text(
      sheets.numbered ? `Folha ${faceLabel(sheet, side)}` : "Folha ________",
      LEFT,
      26,
      {
        width: RIGHT - LEFT,
        align: "right",
      },
    );
  pdf.text(`ANO: ${year}`, LEFT, 42, { width: RIGHT - LEFT, align: "right" });
  pdf
    .fontSize(7)
    .fillColor(SOFT)
    .text(`${officialName(tenant)} · CNS ${tenant.cns}`, LEFT, 62, {
      width: RIGHT - LEFT,
      align: "center",
    });
  // The table: heading row, ruled lines, column rules.
  const per = SHEET_LAYOUT.linesPerSide;
  const bottom = BODY_TOP + per * LINE_H;
  pdf.lineWidth(1.2).strokeColor(INK);
  pdf.rect(LEFT, TABLE_TOP, RIGHT - LEFT, bottom - TABLE_TOP).stroke();
  pdf.moveTo(LEFT, BODY_TOP).lineTo(RIGHT, BODY_TOP).stroke();
  for (const [i, c] of SHEET_LAYOUT.columns.entries()) {
    const x = columnX[i] ?? LEFT;
    pdf
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(INK)
      .text(c.label, x + 2, TABLE_TOP + 5, {
        width: c.width - 4,
        align: "center",
      });
    if (i > 0) {
      pdf.lineWidth(0.6).moveTo(x, TABLE_TOP).lineTo(x, bottom).stroke();
    }
  }
  pdf.lineWidth(0.3).strokeColor(SOFT);
  for (let l = 1; l < per; l++) {
    const y = BODY_TOP + l * LINE_H;
    pdf.moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
  }
  const lineY = (line: number) => BODY_TOP + line * LINE_H + 4.5;
  for (const item of items) {
    const top = BODY_TOP + item.line * LINE_H;
    const end = top + item.lines * LINE_H;
    if (item.kind === "entry") {
      for (const [i, c] of SHEET_LAYOUT.columns.entries()) {
        const x = (columnX[i] ?? LEFT) + 2;
        const lines = item.cells[c.key].slice(
          item.offset,
          item.offset + item.lines,
        );
        for (const [n, text] of lines.entries()) {
          fitText(pdf, text, x, lineY(item.line + n), c.width - 4);
        }
      }
      // The dividing line between one número and the next (art. 260).
      pdf
        .lineWidth(0.9)
        .strokeColor(INK)
        .moveTo(LEFT, end)
        .lineTo(RIGHT, end)
        .stroke();
    } else if (item.kind === "termo") {
      // The termo across NOME DO APRESENTANTE and Natureza formal do título.
      const x = (columnX[2] ?? LEFT) + 3;
      const width = (columnX[4] ?? RIGHT) - x - 3;
      // Like the stamp of the book: a box over the lines, then its text.
      pdf
        .lineWidth(0.8)
        .fillColor(NEUTRALS.card)
        .strokeColor(INK)
        .rect(x - 1, top + 2, width + 2, item.lines * LINE_H - 4)
        .fillAndStroke();
      // "Ass.:" with who signs, chosen at the print: the signature image
      // (or the rubrica), the name and the function.
      const who = choice?.signer
        ? `${choice.signer.name}${choice.signer.title ? `, ${choice.signer.title}` : ""}`
        : "";
      const mark =
        (choice?.signature && choice.signer?.signatureImage) ||
        (choice?.rubric && choice.signer?.rubricImage) ||
        null;
      const signLine = mark
        ? `Ass.:                              ${who}`
        : isDigitalSigning() && !who
          ? DIGITAL_SIGNATURE_NOTE
          : `Ass.: ______________________ ${who}`;
      const lines = [...item.text, signLine].slice(
        item.offset,
        item.offset + item.lines,
      );
      const signRow = item.text.length - item.offset;
      if (mark && signRow >= 0 && signRow < item.lines) {
        pdf.image(Buffer.from(mark), x + 26, lineY(item.line + signRow) - 6, {
          fit: [110, LINE_H + 2],
        });
      }
      for (const [n, text] of lines.entries()) {
        fitText(
          pdf,
          text,
          x + 2,
          lineY(item.line + n),
          width - 4,
          8.5,
          n === 0 && item.offset === 0 ? "Helvetica-Bold" : "Helvetica",
        );
      }
    } else {
      // The space left on the face is cancelled with a line.
      pdf
        .lineWidth(0.8)
        .strokeColor(INK)
        .moveTo(LEFT + 4, top + 3)
        .lineTo(RIGHT - 4, end - 3)
        .stroke();
    }
  }
  pdf
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor(SOFT)
    .text(
      `${volumeName(volume)} (Protocolo) ${sheets.numbered ? ` · folha ${faceLabel(sheet, side)}` : ""} · Lei nº 6.015/1973, arts. 175 e 184 · impresso pelo sistema em ${brDay(officeToday())}`,
      LEFT,
      bottom + 8,
      { width: RIGHT - LEFT, align: "center", lineBreak: false },
    );
}

/**
 * The PDF of the faces asked for (all, a range of folhas, or the faces
 * with títulos or termos of a period), to print for the physical book.
 */
export async function bookSheetsPdf(
  tenant: Tenant,
  sheets: BookSheets,
  filter: {
    fromSheet?: number;
    toSheet?: number;
    fromDay?: string;
    toDay?: string;
  } = {},
  choice: PrintChoice | null = null,
): Promise<Uint8Array | null> {
  const { pagination } = sheets;
  const dayOf = (i: Pagination["items"][number]) =>
    i.kind === "entry"
      ? i.entry.presentedOn
      : i.kind === "termo"
        ? i.closing.day
        : null;
  const faces = pagination.faces.filter((f) => {
    if (filter.fromSheet && f.sheet < filter.fromSheet) return false;
    if (filter.toSheet && f.sheet > filter.toSheet) return false;
    if (!filter.fromDay && !filter.toDay) return true;
    return pagination.items.some((i) => {
      const day = dayOf(i);
      return (
        day !== null &&
        i.sheet === f.sheet &&
        i.side === f.side &&
        (!filter.fromDay || day >= filter.fromDay) &&
        (!filter.toDay || day <= filter.toDay)
      );
    });
  });
  if (!faces.length) return null;
  const pdf = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
  const chunks: Buffer[] = [];
  pdf.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => pdf.on("end", resolve));
  for (const f of faces) {
    pdf.addPage({ size: "A4", margin: 0 });
    drawFace(pdf, tenant, sheets, f.sheet, f.side, choice);
  }
  pdf.end();
  await done;
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * The Livro 1 of a period in the model of the book (decision of
 * 27/11/2026): the "Protocolo do dia" and the book printed by period. Where
 * the book has its folhas set, the faces are the book's own; otherwise the
 * same model with "Folha ____" to be numbered by hand.
 */
export async function protocolPeriodPdfFor(
  database: Database,
  tenant: Tenant,
  input: { bookId?: string; from: string; to: string },
  choice: PrintChoice | null = null,
): Promise<Uint8Array> {
  const books = (await listBooksWith(database, tenant.slug)).filter(
    (b) => b.book === 1 && !b.deletedAt,
  );
  const book = input.bookId
    ? books.find((b) => b.id === input.bookId)
    : (books.find(
        (b) =>
          b.openedOn <= input.from && (!b.closedOn || b.closedOn >= input.from),
      ) ?? books.find((b) => !b.closedOn));
  if (book) {
    const own = await bookSheetsWith(database, tenant, book.id);
    if (own) {
      const pdf = await bookSheetsPdf(
        tenant,
        own,
        { fromDay: input.from, toDay: input.to },
        choice,
      );
      if (pdf) return pdf;
    }
  }
  const low = book?.firstItem ?? 1;
  const high = book?.lastItem ?? Number.MAX_SAFE_INTEGER;
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
  ).filter((r) => r.presentedOn >= input.from && r.presentedOn <= input.to);
  const perDay = new Map<string, number>();
  for (const r of rows) {
    perDay.set(r.presentedOn, (perDay.get(r.presentedOn) ?? 0) + 1);
  }
  const entries: SheetEntry[] = rows
    .filter((r) => r.number >= low && r.number <= high)
    .map((r) => ({
      number: r.number,
      presentedOn: r.presentedOn,
      presenter: r.presenterName,
      titleKind: r.titleKind,
      acts: r.actsSummary,
      voided: Boolean(r.voidedAt),
    }));
  if (entries.length > MAX_PROTOCOL_LINES) {
    throw new BookTooLarge(
      `São ${entries.length} títulos nesse período; escolha um período com até ${MAX_PROTOCOL_LINES}.`,
    );
  }
  const place = `${tenant.location.city}/${tenant.location.state}`;
  const closings: SheetClosing[] = [];
  for (const [day, row] of await closedDaysWith(database, tenant.slug)) {
    if (day < input.from || day > input.to) continue;
    closings.push({
      day,
      text:
        row.kind === "livro-fisico"
          ? `Dia ${brDay(day)} escriturado no livro físico do Protocolo; o termo de encerramento consta do próprio livro.`
          : dayTermText(day, perDay.get(day) ?? 0, place),
    });
  }
  const sheets: BookSheets = {
    volume: book?.volume ?? "1",
    numbered: false,
    paging: { ...DEFAULT_PAGING, fromItem: null },
    pagination: paginate(entries, closings, DEFAULT_PAGING),
  };
  // A period with nothing still prints one face, with its heading.
  return (await bookSheetsPdf(tenant, sheets, {}, choice)) as Uint8Array;
}
