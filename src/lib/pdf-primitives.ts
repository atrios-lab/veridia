import "server-only";
import type PDFDocument from "pdfkit";

/**
 * The page geometry and the two or three strokes every PDF this system draws
 * shares, whichever renderer draws the body: `pdf.ts` (requerimento,
 * receipts, bulletin) and `pdf-form.ts` (the Anexo I form). Here rather than
 * in `pdf.ts` so the form renderer can use them without importing the
 * module that imports it back.
 */
export const MARGIN = 64;
export const QR_SIZE = 58;
/** Where the flow starts, under the letterhead rule. */
export const HEADER_BOTTOM = 148;

export type Pdf = InstanceType<typeof PDFDocument>;

export function contentWidth(pdf: Pdf): number {
  return pdf.page.width - MARGIN * 2;
}

export function bottom(pdf: Pdf): number {
  return pdf.page.height - MARGIN;
}

/** A section heading: bold capitals in black, a size above the body, in
 * the letterhead's own face, so a heading reads as one (the office asked
 * for black, not the theme's gold, and for more weight). */
export function drawEyebrow(
  pdf: Pdf,
  text: string,
  color: string,
  width: number,
  x: number = MARGIN,
  size = 11,
): void {
  pdf
    .font("Times-Bold")
    .fontSize(size)
    .fillColor(color)
    .text(text.toUpperCase(), x, pdf.y, {
      width,
      characterSpacing: size > 11 ? 1 : 0.4,
    });
}
