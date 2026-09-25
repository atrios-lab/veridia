import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { DeclaracaoDocument } from "@/core/request/declaracao.ts";
import type {
  RequerimentoCredentials,
  RequerimentoDocument,
  RequerimentoField,
  RequerimentoRow,
  RequerimentoSection,
} from "@/core/request/requerimento.ts";
import { NEUTRALS } from "@/core/tenant/palette.ts";
import type { DocumentBrand } from "./document-brand.ts";
import { drawFormDocumentBody } from "./pdf-form.ts";
import {
  bottom,
  contentWidth,
  drawEyebrow,
  HEADER_BOTTOM,
  MARGIN,
  type Pdf,
  QR_SIZE,
  SEAL_SIZE,
} from "./pdf-primitives.ts";

const LABEL_WIDTH = 138;
/** Below this much room left, a section heading starts on the next page. */
const HEADING_ORPHAN_GUARD = 90;

/**
 * The letterhead: white paper, the office's seal on the left, the QR to the
 * protocol lookup on the right, a hairline rule underneath. The colour comes
 * in through type, not through a band of ink.
 */
function drawLetterhead(
  pdf: Pdf,
  document: RequerimentoDocument,
  brand: DocumentBrand,
  qr: Buffer | undefined,
): void {
  const { palette } = brand;
  const top = 44;

  let textLeft = MARGIN;
  if (brand.seal) {
    try {
      pdf.image(brand.seal, MARGIN, top, {
        fit: [SEAL_SIZE, SEAL_SIZE],
      });
      textLeft = MARGIN + SEAL_SIZE + 18;
    } catch {
      // An unreadable image is a letterhead without a seal, never a failed
      // download. The office name beside it identifies the serventia.
    }
  }

  const [name, subtitle, ...rest] = document.office;
  const qrLeft = pdf.page.width - MARGIN - QR_SIZE;
  const width = qrLeft - 16 - textLeft;
  pdf
    .font("Helvetica-Bold")
    .fontSize(15.5)
    .fillColor(palette.primary)
    .text(name ?? "", textLeft, top + 4, { width });
  if (subtitle) {
    pdf
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(palette.muted)
      .text(subtitle.toUpperCase(), textLeft, pdf.y + 3, {
        width,
        characterSpacing: 0.6,
      });
  }
  pdf.font("Helvetica").fontSize(8).fillColor(palette.muted);
  for (const line of rest) {
    pdf.text(line, textLeft, pdf.y + 2.5, { width });
  }

  if (qr) {
    pdf.image(qr, qrLeft, top, { width: QR_SIZE });
    pdf
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor(palette.muted)
      .text(
        (brand.lookupUrl ?? "").replace(/^https?:\/\//, ""),
        qrLeft - 30,
        top + QR_SIZE + 5,
        { width: QR_SIZE + 60, align: "center" },
      );
  }

  pdf
    .rect(MARGIN, HEADER_BOTTOM - 24, contentWidth(pdf), 0.8)
    .fill(palette.border);
}

/** Repeated on every page, in the bottom margin so no flow text collides. */
function drawFooter(pdf: Pdf, footer: string, brand: DocumentBrand): void {
  const y = pdf.page.height - MARGIN + 22;
  // PDFKit refuses to place flow text past the bottom margin and would add a
  // page instead. Lifting the margin for the two draws below is the way in.
  const margin = pdf.page.margins.bottom;
  pdf.page.margins.bottom = 0;
  pdf
    .rect(MARGIN, y - 10, contentWidth(pdf), 0.6)
    .fill(brand.palette.border)
    .font("Helvetica")
    .fontSize(7)
    .fillColor(brand.palette.muted)
    .text(footer, MARGIN, y, { width: contentWidth(pdf) });
  pdf.page.margins.bottom = margin;
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
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(brand.palette.muted)
    .text(row.label, MARGIN, top + 1, { width: LABEL_WIDTH - 14 });
  const afterLabel = pdf.y;

  pdf.y = top;
  pdf
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(NEUTRALS.text)
    .text(row.value, MARGIN + LABEL_WIDTH, top, {
      width: contentWidth(pdf) - LABEL_WIDTH,
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
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(brand.palette.muted)
    .text(field.label.toUpperCase(), MARGIN, pdf.y, {
      width: contentWidth(pdf),
      characterSpacing: 0.4,
    });
  if (field.value) {
    pdf
      .font("Helvetica")
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
  drawEyebrow(pdf, section.heading, brand.palette.accent, contentWidth(pdf));
  pdf.moveDown(0.7);

  const rows = section.rows ?? [];
  rows.forEach((row, index) => {
    drawRow(pdf, row, brand, index === rows.length - 1);
  });

  for (const field of section.fields ?? []) {
    drawField(pdf, field, brand);
  }

  for (const paragraph of section.paragraphs ?? []) {
    pdf
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(NEUTRALS.textSoft)
      .text(paragraph, MARGIN, pdf.y, {
        width: contentWidth(pdf),
        align: "justify",
        lineGap: 1.5,
      });
    pdf.moveDown(0.5);
  }
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
    .font("Helvetica-Bold")
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
      .font("Helvetica")
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
    .font("Helvetica")
    .fontSize(9.5)
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
  drawLetterhead(pdf, document, brand, qr);

  pdf.y = HEADER_BOTTOM;
  drawEyebrow(pdf, document.eyebrow, brand.palette.accent, contentWidth(pdf));
  pdf
    .font("Helvetica-Bold")
    .fontSize(21)
    .fillColor(NEUTRALS.text)
    .text(document.title, MARGIN, pdf.y + 4, { width: contentWidth(pdf) });
  pdf
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(NEUTRALS.textSoft)
    .text(document.subtitle, MARGIN, pdf.y + 5, { width: contentWidth(pdf) });

  for (const section of document.sections) drawSection(pdf, section, brand);

  if (document.credentials) {
    drawCredentials(pdf, document.credentials, brand);
  }

  if (document.signee) {
    // The signature is anchored at the foot of the page: everything between
    // the last section and the rule is room to sign by hand, which is the
    // point. Too little of it, and the block gets a page (mostly) to itself.
    pdf.font("Helvetica").fontSize(9);
    const noteHeight = document.signature.reduce(
      (sum, line) =>
        sum + pdf.heightOfString(line, { width: contentWidth(pdf) - 80 }),
      0,
    );
    const blockHeight = 28 + noteHeight;
    if (bottom(pdf) - blockHeight - pdf.y < 48) pdf.addPage();
    pdf.y = bottom(pdf) - blockHeight;

    const ruleWidth = 280;
    const ruleLeft = MARGIN + (contentWidth(pdf) - ruleWidth) / 2;
    pdf.rect(ruleLeft, pdf.y, ruleWidth, 0.8).fill(NEUTRALS.text);
    pdf
      .font("Helvetica")
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

  pdf.font("Helvetica").fontSize(9).fillColor(brand.palette.muted);
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
 * offices' documents differ in palette and seal and in nothing else.
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

  pdf.on("pageAdded", () => {
    if (!forms) drawFooter(pdf, currentFooter, brand);
    pdf.x = MARGIN;
    pdf.y = MARGIN;
  });

  for (const document of documents) {
    if (document.kind === "declaracao") {
      drawFormDocumentBody(pdf, document, brand, qr);
    } else {
      currentFooter = document.footer;
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
 * so it lays those out directly. Same palette, same seal, same legal footer:
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
    drawFooter(pdf, document.footer, brand);
    pdf.x = MARGIN;
    pdf.y = MARGIN;
  });

  pdf.addPage();
  drawLetterhead(
    pdf,
    // The letterhead only reads `office`; the rest is unused for a bulletin.
    { office: document.office } as RequerimentoDocument,
    brand,
    undefined,
  );

  const width = contentWidth(pdf);

  // Everything below is placed with explicit Y coordinates, advanced by hand:
  // label and amount are two draws on the same line, and leaning on the
  // shared `pdf.y` between them is what made columns collide before.
  // The title gives up room to the tag only when there is one, and the
  // period sits below wherever the title actually ends: "Dezembro de 2025"
  // beside the tag wraps, and a fixed offset drew the period over its second
  // line.
  const titleY = HEADER_BOTTOM;
  pdf
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor(palette.primary)
    .text(document.title, MARGIN, titleY, {
      width: document.preliminary ? width - 160 : width,
    });
  const titleBottom = pdf.y;

  if (document.preliminary) {
    const tag = "Dados preliminares";
    pdf.font("Helvetica-Bold").fontSize(8.5);
    const tw = pdf.widthOfString(tag) + 20;
    const tagX = pdf.page.width - MARGIN - tw;
    pdf.roundedRect(tagX, titleY + 2, tw, 20, 10).fill(palette.accentSoft);
    pdf
      .fillColor(palette.accent)
      .text(tag, tagX, titleY + 8, { width: tw, align: "center" });
  }

  const periodY = Math.max(titleY + 30, titleBottom + 6);
  pdf
    .font("Helvetica")
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
      .font(options.strong ? "Helvetica-Bold" : "Helvetica")
      .fontSize(options.strong ? 10 : 9.5)
      .fillColor(options.strong ? palette.primary : NEUTRALS.textSoft)
      .text(label, left, y, { width: labelWidth });
    const labelBottom = pdf.y;
    pdf
      .font(options.strong ? "Helvetica-Bold" : "Helvetica")
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
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(palette.accent)
        .text(eyebrow.toUpperCase(), MARGIN + inset, y, {
          width: width - inset * 2,
          characterSpacing: 1.2,
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
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(NEUTRALS.card)
      .text(document.balance.label, MARGIN + 18, y + 17, {
        width: width - 200,
      });
    pdf
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(NEUTRALS.card)
      .text(document.balance.amount, MARGIN, y + 15, {
        width: width - 18,
        align: "right",
      });
    y += stripH + 14;
  }

  pdf
    .font("Helvetica")
    .fontSize(8)
    .fillColor(palette.muted)
    .text(document.note, MARGIN, y, { width });

  pdf.end();
  return done;
}
