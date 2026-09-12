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
export const SEAL_SIZE = 62;
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

/** Letterspaced small caps, the accent voice of the letterhead. */
export function drawEyebrow(
  pdf: Pdf,
  text: string,
  color: string,
  width: number,
  x: number = MARGIN,
): void {
  pdf
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(color)
    .text(text.toUpperCase(), x, pdf.y, { width, characterSpacing: 1.4 });
}
