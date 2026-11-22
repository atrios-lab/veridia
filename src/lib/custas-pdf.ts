import "server-only";
import PDFDocument from "pdfkit";
import {
  brl,
  type FeeBlock,
  type FeeRow,
  type FeeTableData,
} from "@/core/fees/custas.ts";
import type { PdfLine } from "@/core/fees/custas-parse.ts";
import { FEE_TABLE_PALETTE } from "@/core/tenant/palette.ts";
import {
  ATRIOS_MARK_PATHS,
  ATRIOS_MARK_VIEWBOX,
} from "./assets/atrios-mark.ts";

/**
 * The lines of a PDF with where they sit (core/fees/custas-parse.ts reads a
 * tabela de custas from them): pieces of text on the same baseline, top to
 * bottom, each with its x and where it ends.
 */
export async function pdfLines(bytes: Uint8Array): Promise<PdfLine[]> {
  const { getDocumentProxy } = await import("unpdf");
  // A copy: pdf.js takes the buffer over (see guide-reading's pdfText).
  const pdf = await getDocumentProxy(bytes.slice());
  const lines: PdfLine[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number);
    const height = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();
    const rows: PdfLine[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [, , , , x = 0, baseline = 0] = item.transform as number[];
      const y = height - baseline;
      let row = rows.find((r) => Math.abs(r.y - y) < 2);
      if (!row) {
        row = { page: number, y, pieces: [] };
        rows.push(row);
      }
      row.pieces.push({ x, end: x + (item.width ?? 0), text: item.str });
    }
    rows.sort((a, b) => a.y - b.y);
    lines.push(...rows);
  }
  return lines;
}

// ------------------------------------------------------------- drawing

type Pdf = InstanceType<typeof PDFDocument>;

const NAVY = FEE_TABLE_PALETTE.navy;
const INK = FEE_TABLE_PALETTE.ink;
const MUTED = FEE_TABLE_PALETTE.muted;
const LINE = FEE_TABLE_PALETTE.line;
const SHADE = FEE_TABLE_PALETTE.shade;
const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = { left: 60, right: 60, top: 86, bottom: 48 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
/** The columns' share of the table, as the standard sets them. */
const COLUMNS = [
  { key: "code", label: "Código", weight: 0.75, align: "center" },
  { key: "description", label: "Discriminação", weight: 4.6, align: "left" },
  { key: "emolumentos", label: "Emolumentos", weight: 1.05, align: "right" },
  { key: "fdj", label: "FDJ", weight: 0.95, align: "right" },
  { key: "frmp", label: "FRMP", weight: 0.95, align: "right" },
  { key: "fcrcpn", label: "FCRCPN", weight: 0.95, align: "right" },
  { key: "iss", label: "ISS", weight: 0.85, align: "right" },
  { key: "funaf", label: "FUNAF", weight: 0.85, align: "right" },
  { key: "total", label: "Total", weight: 1.05, align: "right" },
] as const;
const WEIGHTS = COLUMNS.reduce((sum, c) => sum + c.weight, 0);
const WIDTHS = COLUMNS.map((c) => (c.weight / WEIGHTS) * CONTENT_WIDTH);
const FONT = 7.2;
const PAD = 3;

function drawMark(
  pdf: Pdf,
  x: number,
  y: number,
  width: number,
  color: string,
  opacity: number,
): void {
  const scale = width / ATRIOS_MARK_VIEWBOX.width;
  pdf.save();
  pdf.translate(x, y).scale(scale);
  pdf.translate(-ATRIOS_MARK_VIEWBOX.x, -ATRIOS_MARK_VIEWBOX.y);
  pdf.fillColor(color).fillOpacity(opacity);
  for (const d of ATRIOS_MARK_PATHS) pdf.path(d).fill("even-odd");
  pdf.restore();
}

function markHeight(width: number): number {
  return (width * ATRIOS_MARK_VIEWBOX.height) / ATRIOS_MARK_VIEWBOX.width;
}

function issLabel(data: FeeTableData): string {
  const rate = data.meta.issBasisPoints / 100;
  return `ISS (${rate.toLocaleString("pt-BR")}%)`;
}

function issNote(data: FeeTableData): string {
  return `Valores com ISS de ${(data.meta.issBasisPoints / 100).toLocaleString("pt-BR")}%`;
}

/** Header, watermark and footer of a content page. */
function decorate(pdf: Pdf, data: FeeTableData, page: number): void {
  const { meta } = data;
  const markW = 230;
  drawMark(
    pdf,
    PAGE.width / 2 - markW / 2,
    PAGE.height / 2 - markHeight(markW) / 2 + 10,
    markW,
    FEE_TABLE_PALETTE.watermark,
    0.06,
  );
  drawMark(pdf, MARGIN.left, 30, 20, NAVY, 1);
  pdf
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .fillColor(INK)
    .text(`${meta.title}: ${meta.subtitle}`, MARGIN.left + 27, 36, {
      lineBreak: false,
    });
  pdf
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor(MUTED)
    .text(
      `${meta.region} · ${issNote(data).replace(/^V/, "v")}`,
      MARGIN.left + 27,
      45,
      { lineBreak: false },
    );
  pdf
    .font("Helvetica")
    .fontSize(8)
    .fillColor(INK)
    .text(String(page), PAGE.width - MARGIN.right - 40, 32, {
      width: 40,
      align: "right",
      lineBreak: false,
    });
  pdf
    .moveTo(MARGIN.left, 60)
    .lineTo(PAGE.width - MARGIN.right, 60)
    .lineWidth(0.6)
    .strokeColor(FEE_TABLE_PALETTE.rule)
    .stroke();
  const footY = PAGE.height - 30;
  pdf
    .font("Helvetica")
    .fontSize(5.8)
    .fillColor(MUTED)
    .text(meta.footer, MARGIN.left, footY, {
      width: CONTENT_WIDTH - 140,
      lineBreak: false,
    });
  pdf.text(issNote(data), PAGE.width - MARGIN.right - 140, footY, {
    width: 140,
    align: "right",
    lineBreak: false,
  });
  pdf.fillColor(INK);
}

interface Layout {
  pdf: Pdf;
  data: FeeTableData;
  page: number;
  y: number;
  /** Where each level-1 and level-2 heading landed: for the summary. */
  toc: { level: number; text: string; page: number }[];
}

function newPage(l: Layout): void {
  l.pdf.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
  l.page += 1;
  decorate(l.pdf, l.data, l.page);
  l.y = MARGIN.top;
}

function room(l: Layout, height: number): void {
  if (l.y + height > PAGE.height - MARGIN.bottom) newPage(l);
}

function textHeight(
  pdf: Pdf,
  text: string,
  width: number,
  font: string,
  size: number,
): number {
  pdf.font(font).fontSize(size);
  return pdf.heightOfString(text, { width });
}

function headerRow(l: Layout): void {
  const { pdf } = l;
  const h = 16;
  let x = MARGIN.left;
  pdf.rect(MARGIN.left, l.y, CONTENT_WIDTH, h).fillColor(SHADE).fill();
  pdf.font("Helvetica-Bold").fontSize(FONT).fillColor(INK);
  COLUMNS.forEach((c, i) => {
    const w = WIDTHS[i] as number;
    const label = c.key === "iss" ? issLabel(l.data) : c.label;
    pdf.text(label, x + PAD, l.y + 5, {
      width: w - 2 * PAD,
      align: "center",
      lineBreak: false,
    });
    pdf.rect(x, l.y, w, h).lineWidth(0.5).strokeColor(LINE).stroke();
    x += w;
  });
  l.y += h;
}

function rowCells(row: FeeRow): string[] {
  const c = row.cents;
  return [
    row.code,
    row.description,
    brl(c.emolumentos),
    brl(c.fdj),
    brl(c.frmp),
    brl(c.fcrcpn),
    brl(c.iss),
    brl(c.funaf),
    brl(c.total),
  ];
}

function drawRow(l: Layout, row: FeeRow, inTable: { open: boolean }): void {
  const { pdf } = l;
  const cells = rowCells(row);
  const descW = (WIDTHS[1] as number) - 2 * PAD;
  const h = Math.max(
    15.5,
    textHeight(pdf, cells[1] as string, descW, "Helvetica", FONT) + 2 * PAD + 1,
  );
  if (l.y + h > PAGE.height - MARGIN.bottom || !inTable.open) {
    if (l.y + h > PAGE.height - MARGIN.bottom) newPage(l);
    headerRow(l);
    inTable.open = true;
  }
  let x = MARGIN.left;
  COLUMNS.forEach((c, i) => {
    const w = WIDTHS[i] as number;
    const value = cells[i] as string;
    const bold = c.key === "total";
    pdf
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(FONT)
      .fillColor(INK);
    const th =
      c.key === "description"
        ? textHeight(pdf, value, w - 2 * PAD, "Helvetica", FONT)
        : FONT + 1;
    pdf.text(value, x + PAD, l.y + (h - th) / 2 + 0.5, {
      width: w - 2 * PAD,
      align: c.align,
      lineBreak: c.key === "description",
    });
    pdf.rect(x, l.y, w, h).lineWidth(0.5).strokeColor(LINE).stroke();
    x += w;
  });
  l.y += h;
}

function drawGroup(l: Layout, text: string, inTable: { open: boolean }): void {
  const { pdf } = l;
  const h =
    textHeight(pdf, text, CONTENT_WIDTH - 2 * PAD, "Helvetica-Bold", FONT) +
    2 * PAD +
    1;
  // A caption never ends a page alone: it needs its first row under it.
  if (l.y + h + 13 > PAGE.height - MARGIN.bottom) newPage(l);
  if (!inTable.open) {
    headerRow(l);
    inTable.open = true;
  }
  pdf
    .rect(MARGIN.left, l.y, CONTENT_WIDTH, h)
    .fillColor(FEE_TABLE_PALETTE.groupShade)
    .fill();
  pdf
    .rect(MARGIN.left, l.y, CONTENT_WIDTH, h)
    .lineWidth(0.5)
    .strokeColor(LINE)
    .stroke();
  pdf
    .font("Helvetica-Bold")
    .fontSize(FONT)
    .fillColor(INK)
    .text(text, MARGIN.left + PAD, l.y + PAD + 0.5, {
      width: CONTENT_WIDTH - 2 * PAD,
    });
  l.y += h;
}

function drawHeading(l: Layout, level: 1 | 2 | 3, text: string): void {
  const size = level === 1 ? 10 : 9;
  const h = textHeight(l.pdf, text, CONTENT_WIDTH, "Helvetica-Bold", size);
  room(l, h + 60);
  l.y += level === 1 ? 6 : 8;
  if (level !== 3) l.toc.push({ level, text, page: l.page });
  l.pdf
    .font("Helvetica-Bold")
    .fontSize(size)
    .fillColor(INK)
    .text(text, MARGIN.left, l.y, { width: CONTENT_WIDTH });
  l.y += h + 8;
}

function drawNotes(l: Layout, items: string[]): void {
  const { pdf } = l;
  room(l, 40);
  l.y += 12;
  pdf
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(INK)
    .text("NOTAS EXPLICATIVAS", MARGIN.left + 8, l.y);
  l.y += 14;
  for (const item of items) {
    const h = textHeight(pdf, item, CONTENT_WIDTH - 16, "Helvetica", 7.2);
    room(l, h + 4);
    pdf
      .font("Helvetica")
      .fontSize(7.2)
      .fillColor(INK)
      .text(item, MARGIN.left + 8, l.y, {
        width: CONTENT_WIDTH - 16,
        align: "justify",
      });
    l.y += h + 4;
  }
  l.y += 6;
}

function drawCover(pdf: Pdf, data: FeeTableData): void {
  const { meta } = data;
  const cx = PAGE.width / 2;
  const bigW = 260;
  drawMark(pdf, cx - bigW / 2, 150, bigW, FEE_TABLE_PALETTE.watermark, 0.08);
  drawMark(pdf, cx - 24, 72, 48, NAVY, 1);
  const centered = (
    text: string,
    y: number,
    font: string,
    size: number,
    color = INK,
  ) => {
    pdf
      .font(font)
      .fontSize(size)
      .fillColor(color)
      .text(text, 60, y, {
        width: PAGE.width - 120,
        align: "center",
      });
  };
  centered(meta.issuer, 136, "Helvetica-Bold", 8);
  centered(meta.title, 198, "Helvetica-Bold", 12.5);
  centered(meta.subtitle, 216, "Helvetica-Bold", 12.5);
  centered(meta.source, 247, "Helvetica", 8.5);
  centered(meta.validity, 260, "Helvetica", 8.5);
  const box = { w: 130, h: 20 };
  pdf
    .rect(cx - box.w / 2, 292, box.w, box.h)
    .lineWidth(0.7)
    .strokeColor(LINE)
    .stroke();
  centered(issNote(data), 298, "Helvetica-Bold", 8);
  centered(meta.city, 372, "Helvetica-Bold", 8.5);
  centered(meta.year, 386, "Helvetica-Bold", 8.5);
}

function drawSummary(
  l: Layout,
  toc: Layout["toc"],
  presentationPage: number,
): void {
  const { pdf } = l;
  pdf
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(INK)
    .text("SUMÁRIO", MARGIN.left, l.y);
  l.y += 26;
  const entries = [
    { level: 1, text: "APRESENTAÇÃO", page: presentationPage },
    ...toc,
  ];
  for (const e of entries) {
    const size = e.level === 1 ? 8.5 : 7;
    const indent = e.level === 1 ? 0 : 18;
    if (e.level === 1) l.y += 6;
    room(l, size + 6);
    const pageText = String(e.page);
    pdf
      .font(e.level === 1 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(INK);
    const textW = pdf.widthOfString(e.text);
    const numW = pdf.widthOfString(pageText);
    const x = MARGIN.left + indent;
    const right = PAGE.width - MARGIN.right;
    pdf.text(e.text, x, l.y, { lineBreak: false });
    pdf.text(pageText, right - numW, l.y, { lineBreak: false });
    const dotW = pdf.widthOfString(".");
    const dots = Math.max(0, Math.floor((right - numW - x - textW - 6) / dotW));
    pdf.text(".".repeat(dots), x + textW + 3, l.y, { lineBreak: false });
    l.y += size + (e.level === 1 ? 5 : 3.5);
  }
}

function drawPresentation(l: Layout): void {
  const { pdf, data } = l;
  pdf
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(INK)
    .text("APRESENTAÇÃO", MARGIN.left, l.y);
  l.y += 26;
  for (const p of data.meta.presentation) {
    const h = textHeight(pdf, p, CONTENT_WIDTH, "Helvetica", 9);
    room(l, h + 6);
    pdf.font("Helvetica").fontSize(9).fillColor(INK).text(p, MARGIN.left, l.y, {
      width: CONTENT_WIDTH,
      align: "justify",
      indentAllLines: false,
      indent: 28,
      lineGap: 2,
    });
    l.y = pdf.y + 6;
  }
}

function drawBody(l: Layout): void {
  const inTable = { open: false };
  for (const block of l.data.blocks as FeeBlock[]) {
    if (block.kind === "heading") {
      if (block.level === 1 && l.toc.length > 0) newPage(l);
      inTable.open = false;
      drawHeading(l, block.level, block.text);
    } else if (block.kind === "group") {
      drawGroup(l, block.text, inTable);
    } else if (block.kind === "row") {
      drawRow(l, block.row, inTable);
    } else {
      inTable.open = false;
      drawNotes(l, block.items);
    }
  }
}

/** One pass: cover, summary (with the pages it is given), presentation,
 * tables. Returns where the headings landed. */
function render(
  pdf: Pdf,
  data: FeeTableData,
  toc: Layout["toc"] | null,
  summaryPages: number,
): { toc: Layout["toc"]; presentationPage: number } {
  pdf.addPage({ size: [PAGE.width, PAGE.height], margin: 0 });
  drawCover(pdf, data);
  const l: Layout = { pdf, data, page: 1, y: MARGIN.top, toc: [] };
  // The summary takes the pages it took on the counting pass.
  const summaryStart = 2;
  const presentationPage = summaryStart + summaryPages;
  newPage(l);
  if (toc) drawSummary(l, toc, presentationPage);
  while (l.page < presentationPage - 1) newPage(l);
  newPage(l);
  drawPresentation(l);
  newPage(l);
  drawBody(l);
  return { toc: l.toc, presentationPage };
}

/**
 * The table in the office's standard (decision of 22/11/2026: "emite a
 * tabela nesse padrão nosso"), landscape A4: cover, summary with pages,
 * presentation, the tables with their captions and notes, the running
 * header and the footer on every page. Two passes: the first counts where
 * each table lands, the second prints the summary with those pages.
 */
export async function renderFeeTablePdf(data: FeeTableData): Promise<Buffer> {
  const blank = () => new PDFDocument({ autoFirstPage: false, margin: 0 });
  // Pass 1: where the tables land, with a one-page summary.
  const first = render(blank(), data, null, 1);
  const summaryPages = Math.max(1, Math.ceil((first.toc.length + 1) / 30));
  // Pass 2: the same, with the summary's real size.
  const second = render(blank(), data, first.toc, summaryPages);
  const pdf = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    info: { Title: `${data.meta.title}: ${data.meta.subtitle}` },
  });
  const chunks: Buffer[] = [];
  pdf.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => pdf.on("end", () => resolve()));
  render(pdf, data, second.toc, summaryPages);
  pdf.end();
  await done;
  return Buffer.concat(chunks);
}
