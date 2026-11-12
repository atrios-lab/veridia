import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { DeclaracaoDocument } from "@/core/request/declaracao.ts";
import type {
  RequerimentoCredentials,
  RequerimentoDocument,
  RequerimentoField,
  RequerimentoRow,
  RequerimentoSection,
  RequerimentoTable,
} from "@/core/request/requerimento.ts";
import { NEUTRALS } from "@/core/tenant/palette.ts";
import type { DocumentBrand } from "./document-brand.ts";
import { drawFormDocumentBody } from "./pdf-form.ts";
import {
  drawCenteredIdentification,
  drawIdentificationFooter,
  identificationOf,
} from "./pdf-letterhead.ts";
import {
  bottom,
  contentWidth,
  drawEyebrow,
  HEADER_BOTTOM,
  MARGIN,
  type Pdf,
  QR_SIZE,
} from "./pdf-primitives.ts";

const LABEL_WIDTH = 138;

/**
 * The body text of a document, by ABNT NBR 14724: 12 pt, line spacing 1.5
 * (Times at 12 pt sets about 13.8 pt per line; 4.2 more makes 18) and a
 * 1.25 cm (35.4 pt) indent on each paragraph's first line.
 */
export const ABNT = { fontSize: 12, lineGap: 4.2, indent: 35.4 } as const;
/** Below this much room left, a section heading starts on the next page. */
const HEADING_ORPHAN_GUARD = 90;

/**
 * The letterhead, as the office's own certidões draw it and the Código de
 * Normas asks (Provimento CGJ/TJRN 156/2016, art. 2º): the national arms,
 * the centred identification and, in smaller type, the holder and the
 * attributions when the office prints them. No logotype (§ 1º). The QR to
 * the protocol lookup keeps the top right corner. Returns where the flow
 * starts, under the rule.
 */
function drawLetterhead(
  pdf: Pdf,
  document: Pick<RequerimentoDocument, "office">,
  brand: DocumentBrand,
  qr: Buffer | undefined,
): number {
  const { palette } = brand;
  const top = 34;

  const ruleY = drawCenteredIdentification(
    pdf,
    identificationOf(brand, document.office),
    { top, arms: 46, heading: 10.5, small: 8, sideRoom: QR_SIZE + 14 },
  );

  if (qr) {
    const qrLeft = pdf.page.width - MARGIN - QR_SIZE;
    pdf.image(qr, qrLeft, top, { width: QR_SIZE });
    pdf
      .font("Times-Roman")
      .fontSize(6.5)
      .fillColor(palette.muted)
      .text(
        (brand.lookupUrl ?? "").replace(/^https?:\/\//, ""),
        qrLeft - 30,
        top + QR_SIZE + 5,
        { width: QR_SIZE + 60, align: "center" },
      );
  }

  const y = Math.max(ruleY, HEADER_BOTTOM - 28);
  pdf.rect(MARGIN, y, contentWidth(pdf), 0.8).fill(palette.border);
  return y + 18;
}

/**
 * Documents drawn to be signed digitally (decision of 12/11/2026): the
 * assinador asks for the PDF with `assinatura=digital` (see `signHref`), and
 * the paper then carries, in place of the line to sign by hand, a note that
 * it is signed digitally, as the band in the margin shows. Printed to sign
 * by hand, the same document keeps its line.
 */
const signing = new AsyncLocalStorage<"digital">();

export const DIGITAL_SIGNATURE_NOTE =
  "Documento assinado digitalmente com certificado ICP-Brasil, nos termos do art. 10, § 1º, da Medida Provisória nº 2.200-2/2001, dispensada a assinatura de próprio punho. A identificação do signatário e o código de verificação de autenticidade constam da margem lateral.";

/** Draws what `run` renders as documents to be signed digitally. */
export function forDigitalSignature<T>(run: () => Promise<T>): Promise<T> {
  return signing.run("digital", run);
}

/**
 * A PDF route's rendering, in the digital version when the request asks for
 * it (`?assinatura=digital`, added by "Assinar digitalmente").
 */
export function renderingFor<T>(
  request: Request,
  run: () => Promise<T>,
): Promise<T> {
  return new URL(request.url).searchParams.get("assinatura") === "digital"
    ? forDigitalSignature(run)
    : run();
}

function drawDigitalSignatureNote(pdf: Pdf, brand: DocumentBrand): void {
  const width = contentWidth(pdf) - 40;
  pdf.font("Times-Italic").fontSize(10);
  const height = pdf.heightOfString(DIGITAL_SIGNATURE_NOTE, { width });
  pdf.moveDown(1.6);
  if (pdf.y + height + 16 > bottom(pdf)) pdf.addPage();
  const top = pdf.y;
  pdf.rect(MARGIN + 30, top, width, 0.6).fill(brand.palette.border);
  pdf
    .font("Times-Italic")
    .fontSize(10)
    .fillColor(NEUTRALS.textSoft)
    .text(DIGITAL_SIGNATURE_NOTE, MARGIN + 20, top + 8, {
      width,
      align: "center",
    });
}

/** Repeated on every page, in the bottom margin so no flow text collides:
 * the office's address and contacts, then the document's own line. */
function drawFooter(
  pdf: Pdf,
  footer: string,
  brand: DocumentBrand,
  office: readonly string[] = [],
): void {
  drawIdentificationFooter(pdf, identificationOf(brand, office), footer, {
    rule: brand.palette.border,
    text: brand.palette.muted,
  });
}

/** Label and value in two aligned columns, not "Label: value" in prose. */
function drawRow(
  pdf: Pdf,
  row: RequerimentoRow,
  brand: DocumentBrand,
  last: boolean,
): void {
  const top = pdf.y;
  pdf
    .font("Times-Roman")
    .fontSize(10.5)
    .fillColor(brand.palette.muted)
    .text(row.label, MARGIN, top + 1, { width: LABEL_WIDTH - 14 });
  const afterLabel = pdf.y;

  pdf.y = top;
  pdf
    .font("Times-Roman")
    .fontSize(11.5)
    .fillColor(NEUTRALS.text)
    .text(row.value, MARGIN + LABEL_WIDTH, top, {
      width: contentWidth(pdf) - LABEL_WIDTH,
      // A value that wraps (a description, an address) reads justified;
      // one line stays as it is, since the last line is never stretched.
      align: "justify",
    });
  pdf.y = Math.max(afterLabel, pdf.y);

  if (!last) {
    pdf
      .rect(
        MARGIN + LABEL_WIDTH,
        pdf.y + 4,
        contentWidth(pdf) - LABEL_WIDTH,
        0.5,
      )
      .fill(brand.palette.border);
    pdf.y += 9;
  }
}

/**
 * One field of a form the person fills by hand: a small caption, then either
 * the value the pedido already carries (printed on the line) or nothing
 * (leaving a blank rule for the paper). Unlike `drawRow`, label and value
 * stack instead of sitting side by side, because a name or an address does
 * not fit `LABEL_WIDTH` and does not need to: this is a form, not a summary.
 */
function drawField(
  pdf: Pdf,
  field: RequerimentoField,
  brand: DocumentBrand,
): void {
  if (pdf.y > bottom(pdf) - 40) pdf.addPage();
  pdf
    .font("Times-Roman")
    .fontSize(7.5)
    .fillColor(brand.palette.muted)
    .text(field.label.toUpperCase(), MARGIN, pdf.y, {
      width: contentWidth(pdf),
      characterSpacing: 0.4,
    });
  if (field.value) {
    pdf
      .font("Times-Roman")
      .fontSize(10)
      .fillColor(NEUTRALS.text)
      .text(field.value, MARGIN, pdf.y + 1, { width: contentWidth(pdf) });
  } else {
    // Nothing collected: the line itself is the invitation to fill it in by
    // hand, the way the printed Anexo I does.
    pdf.y += 13;
  }
  pdf
    .rect(MARGIN, pdf.y + 3, contentWidth(pdf), 0.6)
    .fill(brand.palette.border);
  pdf.y += 12;
}

function drawSection(
  pdf: Pdf,
  section: RequerimentoSection,
  brand: DocumentBrand,
): void {
  pdf.moveDown(1.5);
  if (pdf.y > bottom(pdf) - HEADING_ORPHAN_GUARD) pdf.addPage();
  drawEyebrow(pdf, section.heading, NEUTRALS.text, contentWidth(pdf));
  pdf.moveDown(0.7);

  const rows = section.rows ?? [];
  rows.forEach((row, index) => {
    drawRow(pdf, row, brand, index === rows.length - 1);
  });

  for (const field of section.fields ?? []) {
    drawField(pdf, field, brand);
  }

  // ABNT (NBR 14724, decision of 11/11/2026): justified, 12 pt, 1.5 line
  // spacing and the first line indented 1.25 cm.
  for (const paragraph of section.paragraphs ?? []) {
    pdf
      .font("Times-Roman")
      .fontSize(ABNT.fontSize)
      .fillColor(NEUTRALS.text)
      .text(paragraph, MARGIN, pdf.y, {
        width: contentWidth(pdf),
        align: "justify",
        lineGap: ABNT.lineGap,
        indent: ABNT.indent,
      });
    pdf.moveDown(0.4);
  }

  if (section.table) drawTable(pdf, section.table, brand);

  if (section.highlight) drawHighlight(pdf, section.highlight, brand);
}

/**
 * A table in the flow: the header row tinted, repeated on each new page the
 * rows run onto, rules between rows, the total in bold (decision of
 * 11/11/2026: the papel de segurança's spreadsheet goes inside the ofício).
 */
function drawTable(
  pdf: Pdf,
  table: RequerimentoTable,
  brand: DocumentBrand,
): void {
  const width = contentWidth(pdf);
  const weights = table.columns.map((c) => c.weight ?? 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / sum) * width);
  const pad = 3.5;
  const size = 9;
  // The header in smaller type: "Inutilizadas" fits a narrow column whole.
  const headerSize = 7.5;

  const heightOf = (cells: string[], bold: boolean, fontSize = size) => {
    pdf.font(bold ? "Times-Bold" : "Times-Roman").fontSize(fontSize);
    return (
      Math.max(
        ...cells.map((cell, i) =>
          pdf.heightOfString(cell || " ", {
            width: (widths[i] ?? 0) - pad * 2,
          }),
        ),
      ) +
      pad * 2
    );
  };

  const drawCells = (
    cells: string[],
    top: number,
    height: number,
    options: { bold?: boolean; fill?: string; color?: string; size?: number },
  ) => {
    if (options.fill) pdf.rect(MARGIN, top, width, height).fill(options.fill);
    let x = MARGIN;
    cells.forEach((cell, i) => {
      const w = widths[i] ?? 0;
      pdf
        .font(options.bold ? "Times-Bold" : "Times-Roman")
        .fontSize(options.size ?? size)
        .fillColor(options.color ?? NEUTRALS.text)
        .text(cell, x + pad, top + pad, {
          width: w - pad * 2,
          align: table.columns[i]?.align ?? "left",
        });
      x += w;
    });
    pdf.rect(MARGIN, top + height, width, 0.5).fill(brand.palette.border);
  };

  const header = table.columns.map((c) => c.label);
  const headerHeight = heightOf(header, true, headerSize);
  const drawHeader = () => {
    const top = pdf.y;
    drawCells(header, top, headerHeight, {
      bold: true,
      fill: brand.palette.tint,
      color: brand.palette.primary,
      size: headerSize,
    });
    pdf.y = top + headerHeight;
  };

  pdf.moveDown(0.4);
  if (pdf.y + headerHeight * 2 > bottom(pdf)) pdf.addPage();
  drawHeader();

  if (table.rows.length === 0 && table.empty) {
    pdf
      .font("Times-Italic")
      .fontSize(size)
      .fillColor(NEUTRALS.textSoft)
      .text(table.empty, MARGIN + pad, pdf.y + pad, { width: width - pad * 2 });
    pdf.y += pad;
  }

  const lines = [
    ...table.rows.map((cells) => ({ cells, bold: false })),
    ...(table.total ? [{ cells: table.total, bold: true }] : []),
  ];
  for (const line of lines) {
    const height = heightOf(line.cells, line.bold);
    if (pdf.y + height > bottom(pdf)) {
      pdf.addPage();
      drawHeader();
    }
    const top = pdf.y;
    drawCells(line.cells, top, height, { bold: line.bold });
    pdf.y = top + height;
  }
  pdf.x = MARGIN;
  pdf.moveDown(0.6);
}

/** A paragraph in a tinted box with the theme's bar on its left. */
function drawHighlight(pdf: Pdf, text: string, brand: DocumentBrand): void {
  const pad = 10;
  const width = contentWidth(pdf) - pad * 2 - 4;
  pdf.font("Times-Roman").fontSize(11.5);
  const height = pdf.heightOfString(text, { width, lineGap: 2 }) + pad * 2;
  pdf.moveDown(0.4);
  if (pdf.y + height > bottom(pdf)) pdf.addPage();
  const top = pdf.y;
  pdf.rect(MARGIN, top, contentWidth(pdf), height).fill(brand.palette.tint);
  pdf.rect(MARGIN, top, 4, height).fill(brand.palette.primary);
  pdf
    .font("Times-Roman")
    .fontSize(11.5)
    .fillColor(NEUTRALS.text)
    .text(text, MARGIN + 4 + pad, top + pad, {
      width,
      align: "justify",
      lineGap: 2,
    });
  pdf.y = top + height;
  pdf.moveDown(0.4);
}

/**
 * The highlighted card carrying protocol and key. It belongs to the access
 * receipt, a file of its own, so it is drawn in the flow of the page rather
 * than pushed onto one: in that document it is the content, not an appendix.
 */
function drawCredentials(
  pdf: Pdf,
  credentials: RequerimentoCredentials,
  brand: DocumentBrand,
): void {
  const { palette } = brand;

  const width = contentWidth(pdf);
  const top = pdf.y + 26;
  const height = 74 + credentials.rows.length * 46;

  pdf
    .roundedRect(MARGIN, top, width, height, 10)
    .fillAndStroke(palette.accentSoft, palette.accent);

  pdf
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(palette.primary)
    .text(credentials.heading.toUpperCase(), MARGIN, top + 30, {
      width,
      align: "center",
      characterSpacing: 0.8,
    });

  pdf.y = top + 66;
  for (const row of credentials.rows) {
    pdf
      .font("Times-Roman")
      .fontSize(8)
      .fillColor(palette.muted)
      .text(row.label.toUpperCase(), MARGIN, pdf.y, {
        width,
        align: "center",
        characterSpacing: 0.5,
      });
    // Courier: the key mixes digits, letters and hyphens, and it gets copied
    // by hand off this page.
    pdf
      .font("Courier-Bold")
      .fontSize(17)
      .fillColor(palette.primary)
      .text(row.value, MARGIN, pdf.y + 3, { width, align: "center" });
    pdf.moveDown(0.8);
  }

  pdf.y = top + height + 26;
  pdf
    .font("Times-Roman")
    .fontSize(10.5)
    .fillColor(NEUTRALS.textSoft)
    .text(credentials.note, MARGIN + 24, pdf.y, {
      width: width - 48,
      align: "justify",
      lineGap: 1.5,
    });
}

/**
 * Draws one document's body onto whichever page is current, starting a new
 * page for its own letterhead first. Split out of `renderDocument` so
 * `renderDocuments` can lay out several requerimentos (one per beneficiário
 * da gratuidade, say) in a single PDF, each with its own letterhead, footer
 * and signature block, without duplicating any of this layout code.
 */
function drawDocumentBody(
  pdf: Pdf,
  document: RequerimentoDocument,
  brand: DocumentBrand,
  qr: Buffer | undefined,
): void {
  pdf.addPage();
  pdf.y = drawLetterhead(pdf, document, brand, qr);

  // The title centred under the letterhead, as the office's papers set it
  // ("CERTIDÃO DE REGISTRO/ÔNUS"); the kind of act above it, the protocol
  // and date below.
  const width = contentWidth(pdf);
  // The kind of document, set large enough to read at a glance (decision
  // of 12/11/2026: at 10.5 pt it was lost above the title).
  pdf
    .font("Times-Bold")
    .fontSize(13)
    .fillColor(NEUTRALS.text)
    .text(document.eyebrow.toLocaleUpperCase("pt-BR"), MARGIN, pdf.y, {
      width,
      align: "center",
      characterSpacing: 1.1,
    });
  pdf
    .font("Times-Bold")
    .fontSize(17)
    .fillColor(NEUTRALS.text)
    .text(document.title.toLocaleUpperCase("pt-BR"), MARGIN, pdf.y + 6, {
      width,
      align: "center",
    });
  pdf
    .font("Times-Roman")
    .fontSize(11)
    .fillColor(NEUTRALS.textSoft)
    .text(document.subtitle, MARGIN, pdf.y + 4, { width, align: "center" });

  for (const section of document.sections) drawSection(pdf, section, brand);

  if (document.credentials) {
    drawCredentials(pdf, document.credentials, brand);
  }

  // The signature block's height, measured before anything is drawn: the
  // date travels with it, so a page break never leaves the signature alone.
  pdf.font("Times-Roman").fontSize(9);
  const noteHeight = document.signature.reduce(
    (sum, line) =>
      sum + pdf.heightOfString(line, { width: contentWidth(pdf) - 80 }),
    0,
  );
  const blockHeight = 28 + noteHeight;
  // Going to be signed digitally: no line to sign by hand, a note instead.
  const digital =
    signing.getStore() === "digital" &&
    Boolean(document.signee || document.signature.length);
  const byHand = Boolean(document.signee) && !digital;

  if (document.dateLine) {
    // Centred, as the office dates its papers, between the text and the
    // signature.
    pdf.font("Times-Roman").fontSize(11);
    const dateHeight = pdf.heightOfString(document.dateLine, {
      width: contentWidth(pdf),
    });
    pdf.moveDown(1.2);
    const room = bottom(pdf) - pdf.y - dateHeight;
    if (
      byHand
        ? room - blockHeight < 48
        : room < HEADING_ORPHAN_GUARD - dateHeight
    ) {
      pdf.addPage();
    }
    // Set again: a new page draws its footer and leaves another font behind.
    pdf
      .font("Times-Roman")
      .fontSize(11)
      .fillColor(NEUTRALS.text)
      .text(document.dateLine, MARGIN, pdf.y, {
        width: contentWidth(pdf),
        align: "center",
      });
  }

  if (digital) {
    drawDigitalSignatureNote(pdf, brand);
    return;
  }

  if (document.signee) {
    // The signature is anchored at the foot of the page: everything between
    // the last section and the rule is room to sign by hand, which is the
    // point. Too little of it, and the block gets a page (mostly) to itself.
    if (bottom(pdf) - blockHeight - pdf.y < 48) pdf.addPage();
    pdf.y = bottom(pdf) - blockHeight;

    const ruleWidth = 280;
    const ruleLeft = MARGIN + (contentWidth(pdf) - ruleWidth) / 2;
    pdf.rect(ruleLeft, pdf.y, ruleWidth, 0.8).fill(NEUTRALS.text);
    pdf
      .font("Times-Roman")
      .fontSize(10)
      .fillColor(NEUTRALS.text)
      .text(document.signee, MARGIN, pdf.y + 6, {
        width: contentWidth(pdf),
        align: "center",
      });
    pdf.moveDown(0.6);
  } else if (document.signature.length) {
    pdf.moveDown(2);
    if (pdf.y > bottom(pdf) - HEADING_ORPHAN_GUARD) pdf.addPage();
  }

  pdf.font("Times-Roman").fontSize(9).fillColor(brand.palette.muted);
  for (const line of document.signature) {
    pdf.text(line, MARGIN + 40, pdf.y, {
      width: contentWidth(pdf) - 80,
      align: "center",
    });
  }
}

/**
 * Draws a document the core assembled. The wording, the order and every value
 * come from `src/core/request/requerimento.ts`; this only places them on the
 * page, which is why the same function serves the service request form and the
 * data rights receipt. The colour comes from the tenant's theme, so two
 * offices' documents differ in palette and identification and in nothing else.
 */
export async function renderDocument(
  document: RequerimentoDocument | DeclaracaoDocument,
  brand: DocumentBrand,
): Promise<Buffer> {
  return renderDocuments([document], brand);
}

/** The QR to the protocol lookup, drawn in the theme's ink on white so it
 * belongs to the letterhead; QR error correction has margin to spare for
 * that contrast. Undefined when the brand carries no lookup URL. */
export async function renderQr(
  brand: DocumentBrand,
): Promise<Buffer | undefined> {
  return brand.lookupUrl
    ? QRCode.toBuffer(brand.lookupUrl, {
        margin: 0,
        width: QR_SIZE * 4,
        color: { dark: brand.palette.primary, light: NEUTRALS.card },
      })
    : undefined;
}

/**
 * Several documents, one PDF: each gets its own letterhead, footer and
 * signature block, on its own page onward: the habilitação de casamento's
 * declaração de hipossuficiência is one per nubente (Provimento CGJ/TJRN
 * n. 7/2026, art. 4º), and the couple signs and returns a single file, not
 * two.
 *
 * Two kinds of document arrive here, told apart by `kind`. A
 * `RequerimentoDocument` (the requerimento, the access receipt, the LGPD
 * receipt) is drawn by `drawDocumentBody` below with its footer written
 * as each page is added, exactly as before. A `DeclaracaoDocument` (the
 * Anexo I form) is drawn by `drawFormDocumentBody` (`pdf-form.ts`), and its
 * footer says "Página X de Y": Y is only known after the whole document is
 * drawn, so those pages are buffered and their footers written in a final
 * pass. A file is one kind or the other; the routes never mix them.
 */
/**
 * Runs `draw` and puts the font, size and colour back as they were: what
 * pdfkit draws on `pageAdded` happens in the middle of a paragraph that
 * overflowed, and that paragraph carries on in the current type.
 */
function keepingType(pdf: PDFKit.PDFDocument, draw: () => void): void {
  const state = pdf as unknown as {
    _font: unknown;
    _fontSize: number;
    _fillColor: unknown;
  };
  const saved = {
    font: state._font,
    size: state._fontSize,
    fill: state._fillColor,
  };
  draw();
  state._font = saved.font;
  state._fontSize = saved.size;
  state._fillColor = saved.fill;
}

export async function renderDocuments(
  documents: (RequerimentoDocument | DeclaracaoDocument)[],
  brand: DocumentBrand,
): Promise<Buffer> {
  const qr = await renderQr(brand);
  const forms = documents.every((document) => document.kind === "declaracao");

  // No first page from the constructor: the footer runs off `pageAdded`, and
  // it has to be attached before page one exists to land on page one. Each
  // document's own footer text travels through a closure updated right
  // before its `addPage`, so a page added mid-document (an overflowing
  // section) still gets that document's footer, not the next one's.
  const pdf = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    autoFirstPage: false,
    // Only the form needs to revisit its pages (see above). Off for the
    // other documents: buffering changes nothing visible for them and
    // holds every page in memory until `end()`.
    bufferPages: forms,
    // The viewer names the tab after this, and falls back to the last
    // segment of the URL without it: a declaração used to show up as
    // "requerimento". The first document's title covers a multi-document
    // file too, since every document in one is the same kind.
    info: { Title: documents[0]?.title ?? "" },
  });
  let currentFooter = "";
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
  });

  let currentOffice: readonly string[] = [];
  // A book's numbered sheets (CN art. 186): the next number to print.
  let currentSheet: { next: number; label: string } | null = null;
  pdf.on("pageAdded", () => {
    // A paragraph that overflows goes on, on the new page, in the type it
    // was set in: the footer drawn here must not leave its 9 pt behind.
    if (!forms)
      keepingType(pdf, () =>
        drawFooter(pdf, currentFooter, brand, currentOffice),
      );
    if (currentSheet) {
      const sheet = currentSheet;
      keepingType(pdf, () => {
        pdf
          .font("Times-Bold")
          .fontSize(9)
          .fillColor(brand.palette.muted)
          .text(`${sheet.label} ${sheet.next}`, MARGIN, 16, {
            width: pdf.page.width - MARGIN * 2,
            align: "right",
            lineBreak: false,
          });
      });
      sheet.next += 1;
    }
    pdf.x = MARGIN;
    pdf.y = MARGIN;
  });

  for (const document of documents) {
    if (document.kind === "declaracao") {
      drawFormDocumentBody(pdf, document, brand, qr);
    } else {
      currentFooter = document.footer;
      currentOffice = document.office;
      currentSheet = document.sheet
        ? { next: document.sheet.first, label: document.sheet.label }
        : null;
      drawDocumentBody(pdf, document, brand, qr);
    }
  }

  pdf.end();
  return done;
}

/** What the monthly bulletin PDF draws, already formatted by the caller
 * from the same `BulletinView` the on-screen preview renders, so the file and
 * the preview never disagree on a number. The private figures are null when
 * the office does not publish them: the PDF then simply has no such rows. */
export interface BulletinDocument {
  office: string[];
  title: string;
  period: string;
  preliminary: boolean;
  actsCount: string;
  grossRevenue: string | null;
  rubrics: {
    title: string;
    subtotal: string;
    funds: { label: string; amount: string }[];
  }[];
  /** Null for a bulletin from before the funds, which has `taxes` instead. */
  fundsTotal: string | null;
  iss: { label: string; amount: string } | null;
  /** The old single taxes total; null for a current bulletin. */
  taxes: { label: string; amount: string } | null;
  expenses: string | null;
  balance: { label: string; amount: string } | null;
  /** The rule it answers to, or, for an old one, that it predates it. */
  note: string;
  footer: string;
}

/**
 * The monthly revenue bulletin, as its own drawing. It shares the letterhead
 * and footer machinery with `renderDocument` but not its body: a bulletin is
 * a few blocks of label and amount and a balance strip, not a flowing form,
 * so it lays those out directly. Same palette, same letterhead, same footer:
 * one office, whichever document it prints.
 */
export async function renderBulletin(
  document: BulletinDocument,
  brand: DocumentBrand,
): Promise<Buffer> {
  const { palette } = brand;
  const pdf = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    autoFirstPage: false,
    info: { Title: document.title },
  });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
  });
  pdf.on("pageAdded", () => {
    keepingType(pdf, () =>
      drawFooter(pdf, document.footer, brand, document.office),
    );
    pdf.x = MARGIN;
    pdf.y = MARGIN;
  });

  pdf.addPage();
  const flowTop = drawLetterhead(pdf, document, brand, undefined);

  const width = contentWidth(pdf);

  // Everything below is placed with explicit Y coordinates, advanced by hand:
  // label and amount are two draws on the same line, and leaning on the
  // shared `pdf.y` between them is what made columns collide before.
  // The title gives up room to the tag only when there is one, and the
  // period sits below wherever the title actually ends: "Dezembro de 2025"
  // beside the tag wraps, and a fixed offset drew the period over its second
  // line.
  const titleY = flowTop;
  pdf
    .font("Times-Bold")
    .fontSize(19)
    .fillColor(palette.primary)
    .text(document.title, MARGIN, titleY, {
      width: document.preliminary ? width - 160 : width,
    });
  const titleBottom = pdf.y;

  if (document.preliminary) {
    const tag = "Dados preliminares";
    pdf.font("Times-Bold").fontSize(8.5);
    const tw = pdf.widthOfString(tag) + 20;
    const tagX = pdf.page.width - MARGIN - tw;
    pdf.roundedRect(tagX, titleY + 2, tw, 20, 10).fill(palette.accentSoft);
    pdf
      .fillColor(palette.accent)
      .text(tag, tagX, titleY + 8, { width: tw, align: "center" });
  }

  const periodY = Math.max(titleY + 30, titleBottom + 6);
  pdf
    .font("Times-Roman")
    .fontSize(10)
    .fillColor(NEUTRALS.textSoft)
    .text(`Período: ${document.period}`, MARGIN, periodY, { width });

  let y = periodY + 28;
  const inset = 14;

  /** A label on the left and its amount on the right, on one line. */
  const line = (
    label: string,
    amount: string,
    options: { strong?: boolean; indent?: boolean } = {},
  ) => {
    const left = MARGIN + inset + (options.indent ? 14 : 0);
    const labelWidth = width - inset * 2 - (options.indent ? 14 : 0) - 110;
    pdf
      .font(options.strong ? "Times-Bold" : "Times-Roman")
      .fontSize(options.strong ? 10 : 9.5)
      .fillColor(options.strong ? palette.primary : NEUTRALS.textSoft)
      .text(label, left, y, { width: labelWidth });
    const labelBottom = pdf.y;
    pdf
      .font(options.strong ? "Times-Bold" : "Times-Roman")
      .fontSize(options.strong ? 11 : 10)
      .fillColor(options.strong ? palette.primary : NEUTRALS.text)
      .text(amount, MARGIN + inset, y, {
        width: width - inset * 2,
        align: "right",
      });
    y = Math.max(labelBottom, y + 14) + 5;
  };

  /** A bordered block around whatever `draw` lays out. */
  const block = (draw: () => void, eyebrow?: string) => {
    const top = y;
    y += 12;
    if (eyebrow) {
      pdf
        .font("Times-Bold")
        .fontSize(10.5)
        .fillColor(NEUTRALS.text)
        .text(eyebrow.toUpperCase(), MARGIN + inset, y, {
          width: width - inset * 2,
          characterSpacing: 0.6,
        });
      y += 18;
    }
    draw();
    y += 6;
    pdf
      .roundedRect(MARGIN, top, width, y - top, 10)
      .lineWidth(0.8)
      .stroke(palette.border);
    y += 12;
  };

  block(() => {
    line("Atos praticados", document.actsCount, { strong: true });
    if (document.grossRevenue) {
      line("Arrecadação", document.grossRevenue, { strong: true });
    }
  });

  const { fundsTotal, iss, taxes } = document;
  if (fundsTotal) {
    block(() => {
      for (const rubric of document.rubrics) {
        line(rubric.title, rubric.subtotal, { strong: true });
        for (const fund of rubric.funds) {
          line(fund.label, fund.amount, { indent: true });
        }
        y += 4;
      }
      pdf.rect(MARGIN + inset, y, width - inset * 2, 0.6).fill(palette.border);
      y += 8;
      line("Total recolhido aos fundos", fundsTotal, { strong: true });
    }, "Recolhido aos fundos");
  }

  block(() => {
    if (taxes) line(taxes.label, taxes.amount, { strong: true });
    if (iss) line(iss.label, iss.amount, { strong: true });
    if (document.expenses) {
      line("Despesas", document.expenses, { strong: true });
    }
  });

  if (document.balance) {
    // Balance strip, full width, the office's ink.
    const stripH = 46;
    pdf.roundedRect(MARGIN, y, width, stripH, 8).fill(palette.primary);
    pdf
      .font("Times-Bold")
      .fontSize(11)
      .fillColor(NEUTRALS.card)
      .text(document.balance.label, MARGIN + 18, y + 17, {
        width: width - 200,
      });
    pdf
      .font("Times-Bold")
      .fontSize(16)
      .fillColor(NEUTRALS.card)
      .text(document.balance.amount, MARGIN, y + 15, {
        width: width - 18,
        align: "right",
      });
    y += stripH + 14;
  }

  pdf
    .font("Times-Roman")
    .fontSize(8)
    .fillColor(palette.muted)
    .text(document.note, MARGIN, y, { width });

  pdf.end();
  return done;
}
