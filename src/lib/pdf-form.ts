import "server-only";
import type {
  DeclaracaoDocument,
  DeclaracaoStamp,
  FormBlock,
  FormContent,
  FormField,
} from "@/core/request/declaracao.ts";
import { NEUTRALS } from "@/core/tenant/palette.ts";
import type { DocumentBrand } from "./document-brand.ts";
import {
  contentWidth,
  drawEyebrow,
  MARGIN,
  type Pdf,
  SEAL_SIZE,
} from "./pdf-primitives.ts";

/*
 * The Anexo I do Provimento CGJ/TJRN n. 7/2026 as a printed form, drawn from
 * the content `src/core/request/declaracao.ts` assembles: numbered cards
 * with a tinted header band, fields laid out in columns with a blank rule
 * to write on, real checkboxes, the two notices, the certification stamp
 * and a footer that says "Página X de Y". Nothing here decides what the
 * form says; it only decides where it goes on the page.
 *
 * Pagination is by hand: a bloco is never split across pages. Every piece is
 * measured before it is drawn (the same routine runs with `draw: false` and
 * returns a height), and a piece that does not fit under the current page's
 * content bottom opens a new page with the continuation header first.
 * PDFKit's own page breaks are switched off for these pages (bottom margin
 * set to 0) so a line of text near the bottom never sneaks a page in behind
 * this file's back.
 */

const RADIUS = 6;
/** Inset of a card's content from its border, sideways and up/down. */
const PAD = 11;
const PAD_Y = 7;
const BAND_HEIGHT = 21;
const BADGE_RADIUS = 7;
const BLOCK_GAP = 7;
const CONTENT_GAP = 5;
const COLUMN_GAP = 14;
const CHECK_SIZE = 9;
/** The rule above the footer: content stops here. */
const FOOTER_TOP_OFFSET = 84;
/** Where the flow starts on the first page, under this document's own
 * letterhead: shorter than the requerimento's (`HEADER_BOTTOM`), because
 * the form has nine cards to fit and the approved layout keeps the top
 * tight. */
const FORM_HEADER_BOTTOM = 110;
/** Where the flow starts on a continuation page, under its shorter header. */
const CONTINUATION_BOTTOM = 92;

const BODY_SIZE = 8;
const LABEL_SIZE = 5.9;
const VALUE_SIZE = 9;

interface Ctx {
  pdf: Pdf;
  brand: DocumentBrand;
  /** False while measuring: nothing is painted, only heights come back. */
  draw: boolean;
}

interface TextOptions {
  size: number;
  width: number;
  font?: string;
  color?: string;
  align?: "left" | "center" | "right" | "justify";
  lineGap?: number;
  characterSpacing?: number;
}

/** Places a run of text at (x, y), or only measures it, and returns its
 * height either way. Measuring and drawing go through the same font and
 * options so the two never disagree. */
function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  options: TextOptions,
): number {
  const { pdf } = ctx;
  pdf.font(options.font ?? "Helvetica").fontSize(options.size);
  const layout = {
    width: options.width,
    lineGap: options.lineGap ?? 1,
    characterSpacing: options.characterSpacing,
    align: options.align,
  };
  const height = pdf.heightOfString(value, layout);
  if (ctx.draw) {
    pdf.fillColor(options.color ?? NEUTRALS.text).text(value, x, y, layout);
  }
  return height;
}

function contentBottom(pdf: Pdf): number {
  return pdf.page.height - FOOTER_TOP_OFFSET - 6;
}

/* ------------------------------------------------------------------------ */
/* Letterhead and headers                                                     */
/* ------------------------------------------------------------------------ */

/**
 * The first page's letterhead: the office's seal and name on the left as in
 * every other document; on the right, where the requerimento puts the QR,
 * the Anexo I label and the "Nº do pedido" line (blank on the blank form).
 * No QR on this document: the approved layout does not carry one, and the
 * protocol lookup is not where the FCRCPN or the oficial takes this paper.
 */
function drawLetterhead(
  ctx: Ctx,
  document: DeclaracaoDocument,
  _qr: Buffer | undefined,
): void {
  const { pdf, brand } = ctx;
  const { palette } = brand;
  const top = 44;

  // A touch smaller than the requerimento's seal: this letterhead ends
  // sooner (`FORM_HEADER_BOTTOM`), and the seal has to sit above its rule.
  const sealSize = SEAL_SIZE - 10;
  let textLeft = MARGIN;
  if (brand.seal) {
    try {
      pdf.image(brand.seal, MARGIN, top, { fit: [sealSize, sealSize] });
      textLeft = MARGIN + sealSize + 16;
    } catch {
      // An unreadable image is a letterhead without a seal, never a failed
      // download. The office name beside it identifies the serventia.
    }
  }

  const rightWidth = 190;
  const rightLeft = pdf.page.width - MARGIN - rightWidth;
  const width = rightLeft - 16 - textLeft;

  const [name, subtitle, ...rest] = document.office;
  pdf
    .font("Times-Bold")
    .fontSize(15.5)
    .fillColor(palette.primary)
    .text(name ?? "", textLeft, top + 4, { width });
  if (subtitle) {
    pdf
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(palette.muted)
      .text(subtitle, textLeft, pdf.y + 3, { width });
  }
  pdf.font("Helvetica").fontSize(8).fillColor(palette.muted);
  for (const line of rest) {
    pdf.text(line, textLeft, pdf.y + 2.5, { width });
  }

  // Right column: the annex label in accent small caps, then "Nº do pedido"
  // with either the protocol or a rule to write it on.
  pdf
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor(palette.accent)
    .text(document.annex.toUpperCase(), rightLeft, top + 6, {
      width: rightWidth,
      align: "right",
      characterSpacing: 1,
    });
  const lineY = top + 30;
  const label = "Nº DO PEDIDO";
  pdf.font("Helvetica").fontSize(6.5).fillColor(palette.muted);
  const labelWidth = pdf.widthOfString(label, { characterSpacing: 0.6 });
  const valueLeft = rightLeft + labelWidth + 8;
  const valueWidth = rightLeft + rightWidth - valueLeft;
  pdf.text(label, rightLeft, lineY + 2, {
    width: labelWidth + 2,
    characterSpacing: 0.6,
    lineBreak: false,
  });
  if (document.protocolNumber) {
    pdf
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(NEUTRALS.text)
      .text(document.protocolNumber, valueLeft, lineY, {
        width: valueWidth,
        align: "left",
        lineBreak: false,
      });
  }
  pdf
    .rect(valueLeft, lineY + 12, valueWidth, 0.7)
    .fill(document.protocolNumber ? NEUTRALS.text : palette.border);

  pdf
    .rect(MARGIN, FORM_HEADER_BOTTOM - 10, contentWidth(pdf), 0.8)
    .fill(palette.border);
}

/** Pages two onward: a one-line reminder of what this paper is, the "Nº do
 * pedido" again so a loose page still finds its pedido, and the rule. */
function drawContinuationHeader(ctx: Ctx, document: DeclaracaoDocument): void {
  const { pdf, brand } = ctx;
  const { palette } = brand;
  const top = 40;

  let textLeft = MARGIN;
  if (brand.seal) {
    try {
      pdf.image(brand.seal, MARGIN, top, { fit: [28, 28] });
      textLeft = MARGIN + 28 + 12;
    } catch {
      // Same as the letterhead: no seal, no drama.
    }
  }

  const rightWidth = 170;
  const rightLeft = pdf.page.width - MARGIN - rightWidth;
  const width = rightLeft - 16 - textLeft;

  pdf
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(palette.primary)
    .text(document.continuationTitle, textLeft, top, { width });
  pdf
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(palette.muted)
    .text(document.continuationSubtitle, textLeft, pdf.y + 2, { width });

  const label = "Nº DO PEDIDO";
  pdf.font("Helvetica").fontSize(6.5).fillColor(palette.muted);
  const labelWidth = pdf.widthOfString(label, { characterSpacing: 0.6 });
  const valueLeft = rightLeft + labelWidth + 8;
  const valueWidth = rightLeft + rightWidth - valueLeft;
  pdf.text(label, rightLeft, top + 4, {
    width: labelWidth + 2,
    characterSpacing: 0.6,
    lineBreak: false,
  });
  if (document.protocolNumber) {
    pdf
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(NEUTRALS.text)
      .text(document.protocolNumber, valueLeft, top + 2, {
        width: valueWidth,
        lineBreak: false,
      });
  }
  pdf
    .rect(valueLeft, top + 14, valueWidth, 0.7)
    .fill(document.protocolNumber ? NEUTRALS.text : palette.border);

  pdf
    .rect(MARGIN, CONTINUATION_BOTTOM - 12, contentWidth(pdf), 0.8)
    .fill(palette.border);
}

/* ------------------------------------------------------------------------ */
/* Pieces of a card                                                           */
/* ------------------------------------------------------------------------ */

/** A 9pt square, and an X inside it when checked. Vector, not a glyph: the
 * base-14 fonts carry no ☒/☐, and "[X]" in Helvetica is what the previous
 * renderer had to settle for. */
function drawCheckbox(ctx: Ctx, x: number, y: number, checked: boolean): void {
  if (!ctx.draw) return;
  const { pdf } = ctx;
  pdf
    .lineWidth(0.7)
    .roundedRect(x, y, CHECK_SIZE, CHECK_SIZE, 1.5)
    .stroke(NEUTRALS.text);
  if (checked) {
    pdf
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(NEUTRALS.text)
      .text("X", x, y + 1, {
        width: CHECK_SIZE,
        align: "center",
        lineBreak: false,
      });
  }
}

/** One field: small caption, then the value on a rule or the rule alone. */
function drawField(
  ctx: Ctx,
  field: FormField,
  x: number,
  y: number,
  width: number,
): number {
  const { pdf, brand } = ctx;
  const labelHeight = text(ctx, field.label.toUpperCase(), x, y, {
    size: LABEL_SIZE,
    width,
    color: brand.palette.muted,
    characterSpacing: 0.5,
    lineGap: 0,
  });
  const valueTop = y + labelHeight + 1;
  let valueHeight = 10;
  if (field.value) {
    valueHeight = Math.max(
      10,
      text(ctx, field.value, x + 1, valueTop, {
        size: VALUE_SIZE,
        width: width - 2,
        color: NEUTRALS.text,
        lineGap: 0,
      }),
    );
  }
  const ruleY = valueTop + valueHeight + 1.5;
  if (ctx.draw) {
    pdf
      .rect(x, ruleY, width, 0.6)
      .fill(field.value ? NEUTRALS.textSoft : brand.palette.border);
  }
  return ruleY + 0.6 - y + 1.5;
}

/** A row of fields sharing the width by their `width` spans (three units
 * across; a field without one takes one unit). */
function drawFieldsRow(
  ctx: Ctx,
  columns: FormField[],
  x: number,
  y: number,
  width: number,
): number {
  const spans = columns.map((column) => column.width ?? 1);
  const total = spans.reduce((sum, span) => sum + span, 0);
  const usable = width - COLUMN_GAP * (columns.length - 1);
  let left = x;
  let height = 0;
  columns.forEach((column, index) => {
    const columnWidth = (usable * spans[index]) / total;
    height = Math.max(height, drawField(ctx, column, left, y, columnWidth));
    left += columnWidth + COLUMN_GAP;
  });
  return height;
}

function drawChecklist(
  ctx: Ctx,
  items: {
    checked: boolean;
    label: string;
    sub?: { checked: boolean; label: string }[];
  }[],
  x: number,
  y: number,
  width: number,
): number {
  const { brand } = ctx;
  let cursor = y;
  for (const item of items) {
    drawCheckbox(ctx, x, cursor + 1, item.checked);
    const labelHeight = text(ctx, item.label, x + CHECK_SIZE + 6, cursor, {
      size: BODY_SIZE,
      width: width - CHECK_SIZE - 6,
      color: NEUTRALS.text,
    });
    cursor += Math.max(labelHeight, CHECK_SIZE + 2) + 1.5;
    if (item.sub?.length) {
      // "TIPO:" and the options on one line, indented under the item.
      let left = x + CHECK_SIZE + 6;
      const tipo = "TIPO:";
      const tipoHeight = text(ctx, tipo, left, cursor + 1, {
        size: LABEL_SIZE,
        width: 30,
        color: brand.palette.muted,
        characterSpacing: 0.5,
      });
      left += 26;
      for (const sub of item.sub) {
        drawCheckbox(ctx, left, cursor, sub.checked);
        ctx.pdf.font("Helvetica").fontSize(BODY_SIZE - 0.5);
        const labelWidth = ctx.pdf.widthOfString(sub.label) + 2;
        text(ctx, sub.label, left + CHECK_SIZE + 4, cursor, {
          size: BODY_SIZE - 0.5,
          width: labelWidth + 4,
          color: NEUTRALS.textSoft,
        });
        left += CHECK_SIZE + 4 + labelWidth + 12;
      }
      cursor += Math.max(tipoHeight, CHECK_SIZE + 2) + 3;
    }
  }
  return cursor - y;
}

/** The boxed side panel of bloco 3 (Livro / Folha / Termo). */
function drawAside(
  ctx: Ctx,
  aside: { heading: string; fields: FormField[] },
  x: number,
  y: number,
  width: number,
): number {
  const { pdf, brand } = ctx;
  const inner = width - PAD * 2;
  // Measure first so the box can be painted under its content.
  const measure: Ctx = { ...ctx, draw: false };
  let height = PAD_Y;
  height += text(measure, aside.heading.toUpperCase(), 0, 0, {
    size: LABEL_SIZE + 0.3,
    width: inner,
    characterSpacing: 0.6,
  });
  height += 4;
  for (const field of aside.fields) {
    height += drawField(measure, field, 0, 0, inner) + 1;
  }
  height += PAD_Y - 3;

  if (ctx.draw) {
    pdf.roundedRect(x, y, width, height, RADIUS).fill(brand.palette.surface);
  }
  let cursor = y + PAD_Y;
  cursor += text(ctx, aside.heading.toUpperCase(), x + PAD, cursor, {
    size: LABEL_SIZE + 0.3,
    width: inner,
    color: brand.palette.accent,
    characterSpacing: 0.6,
    font: "Helvetica-Bold",
  });
  cursor += 4;
  for (const field of aside.fields) {
    cursor += drawField(ctx, field, x + PAD, cursor, inner) + 1;
  }
  return height;
}

function drawSignature(
  ctx: Ctx,
  signature: { label: string; value?: string },
  x: number,
  y: number,
  width: number,
): number {
  const { pdf, brand } = ctx;
  const ruleWidth = Math.min(width, 300);
  const ruleLeft = x + (width - ruleWidth) / 2;
  // Room to sign by hand above the rule: what the whole piece is for.
  let cursor = y + 18;
  if (ctx.draw) {
    pdf.rect(ruleLeft, cursor, ruleWidth, 0.8).fill(NEUTRALS.text);
  }
  cursor += 4;
  if (signature.value) {
    cursor += text(ctx, signature.value, ruleLeft, cursor, {
      size: BODY_SIZE,
      width: ruleWidth,
      align: "center",
      color: NEUTRALS.text,
    });
    cursor += 1;
  }
  cursor += text(ctx, signature.label, ruleLeft - 20, cursor, {
    size: LABEL_SIZE + 0.5,
    width: ruleWidth + 40,
    align: "center",
    color: brand.palette.muted,
  });
  return cursor - y + 2;
}

/** The dashed square where a fingerprint goes, with its note beside it. */
function drawFingerprint(
  ctx: Ctx,
  note: string,
  x: number,
  y: number,
  width: number,
): number {
  const { pdf, brand } = ctx;
  const box = 44;
  if (ctx.draw) {
    pdf
      .save()
      .lineWidth(0.7)
      .dash(2.5, { space: 2 })
      .roundedRect(x, y, box, box, 3)
      .stroke(brand.palette.muted)
      .undash()
      .restore();
  }
  const noteHeight = text(ctx, note, x + box + 12, y + 4, {
    size: BODY_SIZE - 1,
    width: width - box - 12,
    color: brand.palette.muted,
  });
  return Math.max(box, noteHeight + 4) + 2;
}

function drawParagraph(
  ctx: Ctx,
  paragraph: { text: string; emphasis?: boolean },
  x: number,
  y: number,
  width: number,
): number {
  return text(ctx, paragraph.text, x, y, {
    size: BODY_SIZE,
    width,
    font: paragraph.emphasis ? "Helvetica-Bold" : "Helvetica",
    color: paragraph.emphasis ? NEUTRALS.text : NEUTRALS.textSoft,
    align: "justify",
    lineGap: 1,
  });
}

/** The ciências, lettered a) through e) by position. */
function drawList(
  ctx: Ctx,
  items: string[],
  x: number,
  y: number,
  width: number,
): number {
  const indent = 16;
  let cursor = y;
  items.forEach((item, index) => {
    text(ctx, `${String.fromCharCode(97 + index)})`, x, cursor, {
      size: BODY_SIZE,
      width: indent,
      color: NEUTRALS.textSoft,
    });
    cursor +=
      text(ctx, item, x + indent, cursor, {
        size: BODY_SIZE,
        width: width - indent,
        color: NEUTRALS.textSoft,
        align: "justify",
        lineGap: 0.8,
      }) + 1;
  });
  return cursor - y;
}

function drawContent(
  ctx: Ctx,
  content: FormContent,
  x: number,
  y: number,
  width: number,
): number {
  switch (content.type) {
    case "fields":
      return drawFieldsRow(ctx, content.columns, x, y, width);
    case "checklist":
      return drawChecklist(ctx, content.items, x, y, width);
    case "paragraph":
      return drawParagraph(ctx, content, x, y, width);
    case "list":
      return drawList(ctx, content.items, x, y, width);
    case "signature":
      return drawSignature(ctx, content, x, y, width);
    case "fingerprint":
      return drawFingerprint(ctx, content.text, x, y, width);
    case "aside":
      return drawAside(ctx, content, x, y, width);
  }
}

/**
 * The body of a card. When an `aside` is among the contents, everything
 * before it goes in a left column with the aside boxed on the right, and
 * everything after it runs full width below both: bloco 3's checklist next
 * to its Livro/Folha/Termo box, with the "Descreva o ato" line underneath.
 */
function drawBlockBody(
  ctx: Ctx,
  block: FormBlock,
  x: number,
  y: number,
  width: number,
): number {
  const asideIndex = block.content.findIndex((c) => c.type === "aside");
  let cursor = y;

  const run = (items: FormContent[], left: number, w: number, top: number) => {
    let c = top;
    for (const item of items) {
      c += drawContent(ctx, item, left, c, w) + CONTENT_GAP;
    }
    return c - CONTENT_GAP;
  };

  if (asideIndex < 0) {
    return run(block.content, x, width, y) - y;
  }

  const asideWidth = Math.round(width * 0.34);
  const leftWidth = width - asideWidth - COLUMN_GAP;
  const leftBottom = run(block.content.slice(0, asideIndex), x, leftWidth, y);
  const aside = block.content[asideIndex];
  const asideHeight =
    aside.type === "aside"
      ? drawAside(ctx, aside, x + leftWidth + COLUMN_GAP, y, asideWidth)
      : 0;
  cursor = Math.max(leftBottom, y + asideHeight) + CONTENT_GAP;
  const rest = block.content.slice(asideIndex + 1);
  if (rest.length) cursor = run(rest, x, width, cursor);
  else cursor -= CONTENT_GAP;
  return cursor - y;
}

/** A numbered card: header band with the badge, heading and hint; body. */
function drawBlock(ctx: Ctx, block: FormBlock, y: number): number {
  const { pdf, brand } = ctx;
  const { palette } = brand;
  const x = MARGIN;
  const width = contentWidth(pdf);
  const inner = width - PAD * 2;

  const bodyHeight = drawBlockBody(
    { ...ctx, draw: false },
    block,
    x + PAD,
    0,
    inner,
  );
  const height = BAND_HEIGHT + PAD_Y + bodyHeight + PAD_Y;

  if (ctx.draw) {
    // Band with only its top corners rounded: the band, then the white body
    // painted over the band's rounded bottom, then the outline on top.
    pdf
      .roundedRect(x, y, width, BAND_HEIGHT + RADIUS, RADIUS)
      .fill(palette.surface);
    pdf
      .rect(x, y + BAND_HEIGHT, width, height - BAND_HEIGHT)
      .fill(NEUTRALS.card);
    pdf
      .lineWidth(0.8)
      .roundedRect(x, y, width, height, RADIUS)
      .stroke(palette.border);
    pdf.rect(x, y + BAND_HEIGHT, width, 0.6).fill(palette.border);

    const badgeX = x + PAD + BADGE_RADIUS;
    const badgeY = y + BAND_HEIGHT / 2;
    pdf.circle(badgeX, badgeY, BADGE_RADIUS).fill(palette.primary);
    pdf
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor(NEUTRALS.card)
      .text(String(block.number), badgeX - BADGE_RADIUS, badgeY - 3.8, {
        width: BADGE_RADIUS * 2,
        align: "center",
        lineBreak: false,
      });

    const headingLeft = badgeX + BADGE_RADIUS + 8;
    const hintWidth = block.hint ? 200 : 0;
    pdf
      .font("Times-Bold")
      .fontSize(10)
      .fillColor(NEUTRALS.text)
      .text(block.heading, headingLeft, y + 5.5, {
        width: width - (headingLeft - x) - hintWidth - PAD,
        lineBreak: false,
      });
    if (block.hint) {
      pdf
        .font("Helvetica-Bold")
        .fontSize(6.2)
        .fillColor(palette.accent)
        .text(block.hint.toUpperCase(), x + width - PAD - hintWidth, y + 7.5, {
          width: hintWidth,
          align: "right",
          characterSpacing: 0.7,
          lineBreak: false,
        });
    }
  }

  drawBlockBody(ctx, block, x + PAD, y + BAND_HEIGHT + PAD_Y, inner);
  return height;
}

/** A tinted notice with a small-caps heading (or a bold lead-in) and a
 * paragraph: "Antes de preencher" at the top, "Proteção de dados" between
 * blocos 5 and 6. */
function drawNotice(
  ctx: Ctx,
  notice: { heading: string; text: string },
  y: number,
  tone: "accent" | "surface",
): number {
  const { pdf, brand } = ctx;
  const { palette } = brand;
  const x = MARGIN;
  const width = contentWidth(pdf);
  const inner = width - PAD * 2;

  const measure: Ctx = { ...ctx, draw: false };
  const headingHeight = text(measure, notice.heading.toUpperCase(), 0, 0, {
    size: LABEL_SIZE + 0.8,
    width: inner,
    characterSpacing: 1,
    font: "Helvetica-Bold",
  });
  const bodyHeight = text(measure, notice.text, 0, 0, {
    size: BODY_SIZE - 0.3,
    width: inner,
    lineGap: 1.2,
  });
  const height = PAD_Y + headingHeight + 2 + bodyHeight + PAD_Y;

  if (ctx.draw) {
    pdf
      .roundedRect(x, y, width, height, RADIUS)
      .fill(tone === "accent" ? palette.accentSoft : palette.surface);
  }
  let cursor = y + PAD_Y;
  cursor += text(ctx, notice.heading.toUpperCase(), x + PAD, cursor, {
    size: LABEL_SIZE + 0.8,
    width: inner,
    color: tone === "accent" ? palette.accentInk : palette.primary,
    characterSpacing: 1,
    font: "Helvetica-Bold",
  });
  cursor += 2;
  text(ctx, notice.text, x + PAD, cursor, {
    size: BODY_SIZE - 0.3,
    width: inner,
    color: NEUTRALS.textSoft,
    lineGap: 1.2,
  });
  return height;
}

/** The certification stamp: a double-ruled box in the office's ink, apart
 * from the nine cards so it never reads as one of them. */
function drawStamp(ctx: Ctx, stamp: DeclaracaoStamp, y: number): number {
  const { pdf, brand } = ctx;
  const { palette } = brand;
  const x = MARGIN;
  const width = contentWidth(pdf);
  const inner = width - PAD * 2;
  const measure: Ctx = { ...ctx, draw: false };

  const factWidth = (inner - COLUMN_GAP * 3) / 4;
  const factsHeight =
    Math.max(
      ...stamp.facts.map(
        (fact) =>
          text(measure, fact.label.toUpperCase(), 0, 0, {
            size: LABEL_SIZE,
            width: factWidth,
            characterSpacing: 0.5,
          }) +
          2 +
          text(measure, fact.value, 0, 0, {
            size: BODY_SIZE,
            width: factWidth,
            font: "Helvetica-Bold",
          }),
      ),
    ) + 2;
  const paragraphsHeight = stamp.paragraphs.reduce(
    (sum, paragraph) =>
      sum +
      text(measure, paragraph, 0, 0, {
        size: BODY_SIZE - 1,
        width: inner,
        lineGap: 1.4,
        align: "justify",
      }) +
      4,
    0,
  );
  const headingHeight = 11;
  // Two lines: the hash on its own (sixty-four hex digits want the width),
  // then the IP on the left and the motto on the right.
  const trailerHeight = 24;
  const height =
    PAD_Y +
    headingHeight +
    6 +
    factsHeight +
    6 +
    paragraphsHeight +
    2 +
    trailerHeight +
    PAD_Y;

  if (ctx.draw) {
    pdf
      .lineWidth(1.2)
      .roundedRect(x, y, width, height, RADIUS)
      .stroke(palette.primary);
    pdf
      .lineWidth(0.5)
      .roundedRect(x + 2.5, y + 2.5, width - 5, height - 5, RADIUS - 2)
      .stroke(palette.primary);
  }

  let cursor = y + PAD_Y;
  // Heading with a small shield-like mark (a filled circle) on the left and
  // the badge on the right.
  const badgeWidth = 175;
  if (ctx.draw) {
    pdf.circle(x + PAD + 4, cursor + 4.5, 4).fill(palette.primary);
  }
  text(ctx, stamp.heading.toUpperCase(), x + PAD + 14, cursor, {
    size: 7.8,
    width: inner - 14 - badgeWidth,
    font: "Helvetica-Bold",
    color: palette.primary,
    characterSpacing: 1,
  });
  text(
    ctx,
    stamp.badge.toUpperCase(),
    x + width - PAD - badgeWidth,
    cursor + 1.5,
    {
      size: 5.6,
      width: badgeWidth,
      align: "right",
      color: palette.muted,
      characterSpacing: 0.4,
    },
  );
  cursor += headingHeight + 6;

  stamp.facts.forEach((fact, index) => {
    const left = x + PAD + index * (factWidth + COLUMN_GAP);
    const labelHeight = text(ctx, fact.label.toUpperCase(), left, cursor, {
      size: LABEL_SIZE,
      width: factWidth,
      color: palette.muted,
      characterSpacing: 0.5,
    });
    text(ctx, fact.value, left, cursor + labelHeight + 2, {
      size: BODY_SIZE,
      width: factWidth,
      font: "Helvetica-Bold",
      color: palette.primary,
    });
  });
  cursor += factsHeight + 6;

  for (const paragraph of stamp.paragraphs) {
    cursor +=
      text(ctx, paragraph, x + PAD, cursor, {
        size: BODY_SIZE - 1,
        width: inner,
        color: NEUTRALS.textSoft,
        lineGap: 1.4,
        align: "justify",
      }) + 4;
  }
  cursor += 2;

  // Trailer, line one: the hash (label, then the digits or a rule).
  const labelWidth = 62;
  const valueLeft = x + PAD + labelWidth;
  const valueWidth = inner - labelWidth;
  const drawLabel = (label: string, top: number) =>
    text(ctx, label, x + PAD, top, {
      size: LABEL_SIZE,
      width: labelWidth,
      color: palette.muted,
      characterSpacing: 0.5,
    });
  drawLabel("HASH SHA-256", cursor + 1.5);
  if (stamp.hash) {
    // Courier at this size fits the sixty-four hex digits in one line.
    text(ctx, stamp.hash, valueLeft, cursor + 1, {
      size: 6,
      width: valueWidth,
      font: "Courier",
      color: NEUTRALS.text,
    });
  } else if (ctx.draw) {
    pdf.rect(valueLeft, cursor + 8, valueWidth, 0.6).fill(palette.border);
  }
  cursor += 12;

  // Line two: the IP on the left, the motto on the right.
  const mottoWidth = 260;
  drawLabel("IP DO ACEITE", cursor + 1.5);
  if (stamp.ip) {
    text(ctx, stamp.ip, valueLeft, cursor + 1, {
      size: 6.5,
      width: valueWidth - mottoWidth - 10,
      font: "Courier",
      color: NEUTRALS.text,
    });
  } else if (ctx.draw) {
    pdf
      .rect(valueLeft, cursor + 8, valueWidth - mottoWidth - 10, 0.6)
      .fill(palette.border);
  }
  text(
    ctx,
    stamp.motto.toUpperCase(),
    x + width - PAD - mottoWidth,
    cursor + 1.5,
    {
      size: 6,
      width: mottoWidth,
      align: "right",
      font: "Helvetica-Bold",
      color: palette.primary,
      characterSpacing: 0.7,
    },
  );

  return height;
}

/* ------------------------------------------------------------------------ */
/* Footer                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Written once every page of the document exists (see
 * `drawFormDocumentBody`): the legal basis, the platform's line when there
 * is one, and "Página X de Y". Sits under the content bottom, inside the
 * bottom band the flow never enters.
 */
function drawFormFooter(
  ctx: Ctx,
  document: DeclaracaoDocument,
  page: number,
  total: number | undefined,
): void {
  const { pdf, brand } = ctx;
  const { palette } = brand;
  const x = MARGIN;
  const width = contentWidth(pdf);
  const top = pdf.page.height - FOOTER_TOP_OFFSET;
  const margin = pdf.page.margins.bottom;
  pdf.page.margins.bottom = 0;

  pdf.rect(x, top, width, 0.6).fill(palette.border);
  let cursor = top + 6;

  const [legal, ...others] = document.footer;
  pdf.font("Helvetica-Bold").fontSize(6.3).fillColor(NEUTRALS.textSoft);
  pdf.text("Base normativa: ", x, cursor, {
    width,
    continued: true,
    lineGap: 1.2,
  });
  pdf
    .font("Helvetica")
    .fillColor(palette.muted)
    .text(legal ?? "", { width, lineGap: 1.2 });
  cursor = pdf.y + 2;

  for (const line of others) {
    pdf
      .font("Helvetica-Bold")
      .fontSize(6.3)
      .fillColor(palette.primary)
      .text(line, x, cursor, { width, lineGap: 1.2 });
    cursor = pdf.y + 2;
  }

  const [office] = document.office;
  pdf
    .font("Helvetica")
    .fontSize(6.3)
    .fillColor(palette.muted)
    .text(`${office ?? ""} · ${document.title}`, x, cursor, {
      width: width - 90,
      lineBreak: false,
    });
  pdf.text(
    total === undefined ? `Página ${page}` : `Página ${page} de ${total}`,
    x + width - 90,
    cursor,
    { width: 90, align: "right", lineBreak: false },
  );

  pdf.page.margins.bottom = margin;
}

/* ------------------------------------------------------------------------ */
/* The document                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Draws one Anexo I form onto new pages of `pdf`, starting with its own
 * letterhead. Blocos, notices and the stamp are measured before they are
 * drawn and never split across pages. When the document was opened with
 * `bufferPages`, every page of this form gets its footer in a final pass
 * with "Página X de Y"; without buffering the footer is written as each
 * page opens, without the total.
 */
export function drawFormDocumentBody(
  pdf: Pdf,
  document: DeclaracaoDocument,
  brand: DocumentBrand,
  qr: Buffer | undefined,
): void {
  const ctx: Ctx = { pdf, brand, draw: true };
  const measure: Ctx = { pdf, brand, draw: false };
  const buffered = Boolean(
    (pdf as unknown as { options?: { bufferPages?: boolean } }).options
      ?.bufferPages,
  );

  const firstPage =
    pdf.bufferedPageRange().start + pdf.bufferedPageRange().count;
  let pageCount = 0;
  let y = 0;

  const openPage = (first: boolean) => {
    pdf.addPage();
    // This renderer paginates by hand; PDFKit must never add a page on its
    // own because a line came close to the bottom margin.
    pdf.page.margins.bottom = 0;
    pageCount += 1;
    if (first) {
      drawLetterhead(ctx, document, qr);
      y = FORM_HEADER_BOTTOM;
    } else {
      drawContinuationHeader(ctx, document);
      y = CONTINUATION_BOTTOM;
    }
    if (!buffered) drawFormFooter(ctx, document, pageCount, undefined);
  };

  const place = (height: number) => {
    if (y + height > contentBottom(pdf)) openPage(false);
  };

  openPage(true);

  // Title block.
  pdf.y = y;
  drawEyebrow(pdf, document.eyebrow, brand.palette.accent, contentWidth(pdf));
  pdf
    .font("Times-Bold")
    .fontSize(18)
    .fillColor(NEUTRALS.text)
    .text(document.title, MARGIN, pdf.y + 2, { width: contentWidth(pdf) });
  y = pdf.y + 5;

  // Notice.
  const noticeHeight = drawNotice(measure, document.notice, 0, "accent");
  place(noticeHeight);
  drawNotice(ctx, document.notice, y, "accent");
  y += noticeHeight + BLOCK_GAP;

  for (const block of document.blocks) {
    // The data-protection notice sits between blocos 5 and 6 (or 5 and 8
    // when 6 and 7 are absent): right after bloco 5, whatever follows.
    const height = drawBlock(measure, block, 0);
    place(height);
    drawBlock(ctx, block, y);
    y += height + BLOCK_GAP;

    if (block.number === 5) {
      const notice = {
        heading: "Proteção de dados",
        text: document.dataProtection,
      };
      const dpHeight = drawNotice(measure, notice, 0, "surface");
      place(dpHeight);
      drawNotice(ctx, notice, y, "surface");
      y += dpHeight + BLOCK_GAP;
    }
  }

  if (document.stamp) {
    const height = drawStamp(measure, document.stamp, 0);
    place(height + 6);
    drawStamp(ctx, document.stamp, y + 6);
    y += height + 6 + BLOCK_GAP;
  }

  if (buffered) {
    const last = firstPage + pageCount - 1;
    for (let index = 0; index < pageCount; index++) {
      pdf.switchToPage(firstPage + index);
      drawFormFooter(ctx, document, index + 1, pageCount);
    }
    pdf.switchToPage(last);
  }
}
