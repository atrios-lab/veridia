import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type {
  RequerimentoCredentials,
  RequerimentoDocument,
  RequerimentoRow,
  RequerimentoSection,
} from "@/core/request/requerimento.ts";
import { NEUTRALS } from "@/core/tenant/palette.ts";
import type { DocumentBrand } from "./document-brand.ts";

const MARGIN = 64;
const SEAL_SIZE = 62;
const QR_SIZE = 58;
/** Where the flow starts, under the letterhead rule. */
const HEADER_BOTTOM = 148;
const LABEL_WIDTH = 138;
/** Below this much room left, a section heading starts on the next page. */
const HEADING_ORPHAN_GUARD = 90;

type Pdf = InstanceType<typeof PDFDocument>;

function contentWidth(pdf: Pdf): number {
  return pdf.page.width - MARGIN * 2;
}

function bottom(pdf: Pdf): number {
  return pdf.page.height - MARGIN;
}

/** Letterspaced small caps, the accent voice of the letterhead. */
function drawEyebrow(pdf: Pdf, text: string, color: string, width: number) {
  pdf
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(color)
    .text(text.toUpperCase(), MARGIN, pdf.y, { width, characterSpacing: 1.4 });
}

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
 * Draws a document the core assembled. The wording, the order and every value
 * come from `src/core/request/requerimento.ts`; this only places them on the
 * page, which is why the same function serves the service request form and the
 * data rights receipt. The colour comes from the tenant's theme, so two
 * offices' documents differ in palette and seal and in nothing else.
 */
export async function renderDocument(
  document: RequerimentoDocument,
  brand: DocumentBrand,
): Promise<Buffer> {
  // Drawn in the theme's ink on white so it belongs to the letterhead; QR
  // error correction has margin to spare for that contrast.
  const qr = brand.lookupUrl
    ? await QRCode.toBuffer(brand.lookupUrl, {
        margin: 0,
        width: QR_SIZE * 4,
        color: { dark: brand.palette.primary, light: NEUTRALS.card },
      })
    : undefined;

  // No first page from the constructor: the footer runs off `pageAdded`, and
  // it has to be attached before page one exists to land on page one.
  const pdf = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    autoFirstPage: false,
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

  pdf.end();
  return done;
}

/** What the monthly bulletin PDF draws. Money is centavos, formatted by the
 * caller with the same core the on-screen preview uses, so the file and the
 * preview never disagree on a number. */
export interface BulletinDocument {
  office: string[];
  title: string;
  period: string;
  preliminary: boolean;
  rows: {
    actsCount: string;
    grossRevenue: string;
    taxesPaid: string;
    expenses: string;
  };
  balance: string;
  footer: string;
}

/**
 * The monthly revenue bulletin, as its own drawing. It shares the letterhead
 * and footer machinery with `renderDocument` but not its body: a bulletin is
 * two figure blocks and a balance strip, not a flowing form, so it lays those
 * out directly. Same palette, same seal, same legal footer: one office,
 * whichever document it prints.
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

  // Everything below is placed with explicit Y coordinates, never `pdf.y`:
  // the two side-by-side cards each advance the cursor, so leaning on the
  // shared `pdf.y` is what made the columns collide. Here nothing reads it.
  const titleY = HEADER_BOTTOM;
  pdf
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor(palette.primary)
    .text(document.title, MARGIN, titleY, { width: width - 160 });

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

  const periodY = titleY + 30;
  pdf
    .font("Helvetica")
    .fontSize(10)
    .fillColor(NEUTRALS.textSoft)
    .text(`Período: ${document.period}`, MARGIN, periodY, { width });

  // Two bordered cards, side by side, matching the on-screen preview.
  const gap = 16;
  const colW = (width - gap) / 2;
  const cardsTop = periodY + 24;
  const cardH = 96;
  const rightX = MARGIN + colW + gap;

  /** A label on the left and its value on the right, inside a card. */
  const cardRow = (
    cardLeft: number,
    y: number,
    label: string,
    value: string,
    sublabel?: string,
  ) => {
    pdf
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(NEUTRALS.textSoft)
      .text(label, cardLeft + 14, y, { width: colW - 28 });
    if (sublabel) {
      pdf
        .font("Helvetica")
        .fontSize(7)
        .fillColor(palette.muted)
        .text(sublabel, cardLeft + 14, y + 12, { width: colW - 28 });
    }
    pdf
      .font("Helvetica-Bold")
      .fontSize(11.5)
      .fillColor(palette.primary)
      .text(value, cardLeft + 14, y, { width: colW - 28, align: "right" });
  };

  for (const [cardLeft, eyebrow] of [
    [MARGIN, "De onde veio"] as const,
    [rightX, "Para onde foi"] as const,
  ]) {
    pdf
      .roundedRect(cardLeft, cardsTop, colW, cardH, 10)
      .lineWidth(0.8)
      .stroke(palette.border);
    pdf
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(palette.accent)
      .text(eyebrow.toUpperCase(), cardLeft + 14, cardsTop + 14, {
        width: colW - 28,
        characterSpacing: 1.2,
      });
  }

  const rowOneY = cardsTop + 38;
  const rowTwoY = cardsTop + 64;
  cardRow(MARGIN, rowOneY, "Atos praticados", document.rows.actsCount);
  cardRow(MARGIN, rowTwoY, "Arrecadação", document.rows.grossRevenue);
  cardRow(
    rightX,
    rowOneY,
    "Tributos pagos",
    document.rows.taxesPaid,
    "FCRCPN, FRMP, FDJ, FUNAF, ISS",
  );
  cardRow(rightX, rowTwoY, "Despesas", document.rows.expenses);

  // Balance strip, full width, the office's ink.
  const stripY = cardsTop + cardH + 16;
  const stripH = 46;
  pdf.roundedRect(MARGIN, stripY, width, stripH, 8).fill(palette.primary);
  pdf
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(NEUTRALS.card)
    .text("Saldo final do mês", MARGIN + 18, stripY + 16, { width: width / 2 });
  pdf
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor(NEUTRALS.card)
    .text(document.balance, MARGIN, stripY + 14, {
      width: width - 18,
      align: "right",
    });

  pdf.end();
  return done;
}
