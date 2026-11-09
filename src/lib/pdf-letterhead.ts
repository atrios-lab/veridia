import "server-only";
import type { OfficeIdentification } from "@/core/tenant/identification.ts";
import { NEUTRALS } from "@/core/tenant/palette.ts";
import {
  BRASAO_PNG_BASE64,
  BRASAO_SIZE,
} from "./assets/brasao-da-republica-png.ts";
import type { DocumentBrand } from "./document-brand.ts";
import { contentWidth, MARGIN, type Pdf } from "./pdf-primitives.ts";

/**
 * The identification every paper the platform prints for a serventia
 * carries (Provimento CGJ/TJRN 156/2016, art. 2º; see
 * core/tenant/identification.ts): the national arms, the centred capitals,
 * the optional holder and attributions in smaller type, and the address at
 * the foot. No logotype: § 1º bars it. Shared by `pdf.ts` and `pdf-form.ts`
 * so every document reads the same.
 */

/**
 * What to print when the caller built the brand by hand (tests, previews):
 * the document's own office lines, under the same national heading.
 */
export function identificationOf(
  brand: DocumentBrand,
  office: readonly string[],
): OfficeIdentification {
  if (brand.identification) return brand.identification;
  const [name] = office;
  return {
    header: [
      "REPÚBLICA FEDERATIVA DO BRASIL",
      ...(name ? [name.toLocaleUpperCase("pt-BR")] : []),
    ],
    footer: [],
    missingJurisdiction: true,
  };
}

/** Decoded once per server instance: every document draws the same arms. */
let brasao: Buffer | undefined;

/** The coat of arms of the Republic, `height` points tall. */
export function drawBrasao(
  pdf: Pdf,
  x: number,
  y: number,
  height: number,
): void {
  brasao ??= Buffer.from(BRASAO_PNG_BASE64, "base64");
  pdf.image(brasao, x, y, { height, width: brasaoWidth(height) });
}

export function brasaoWidth(height: number): number {
  return (height * BRASAO_SIZE.width) / BRASAO_SIZE.height;
}

export interface LetterheadSizes {
  /** Top of the arms. */
  top: number;
  arms: number;
  heading: number;
  small: number;
  /** Room kept free on each side (the QR sits on the right). */
  sideRoom: number;
}

/**
 * The centred letterhead, as the office's certidões draw it. Returns where
 * the hairline rule under it goes.
 */
export function drawCenteredIdentification(
  pdf: Pdf,
  identification: OfficeIdentification,
  sizes: LetterheadSizes,
): number {
  const armsWidth = brasaoWidth(sizes.arms);
  drawBrasao(pdf, (pdf.page.width - armsWidth) / 2, sizes.top, sizes.arms);

  const x = MARGIN + sizes.sideRoom;
  const width = contentWidth(pdf) - sizes.sideRoom * 2;
  pdf.y = sizes.top + sizes.arms + 5;
  pdf.font("Times-Bold").fontSize(sizes.heading).fillColor(NEUTRALS.text);
  for (const line of identification.header) {
    pdf.text(line, x, pdf.y, { width, align: "center", lineGap: 0.5 });
  }
  // § 1º: "em menor destaque e logo abaixo da identificação".
  pdf.font("Times-Roman").fontSize(sizes.small).fillColor(NEUTRALS.textSoft);
  for (const line of [identification.holder, identification.attributions]) {
    if (line) pdf.text(line, x, pdf.y + 1.5, { width, align: "center" });
  }
  return pdf.y + 6;
}

/**
 * The foot of the page: the address and contacts, centred, as on the
 * office's papers; then the document's own line (protocol, legal note).
 * Drawn in the bottom margin, which flow text never enters.
 */
export function drawIdentificationFooter(
  pdf: Pdf,
  identification: OfficeIdentification,
  documentLine: string,
  color: { rule: string; text: string },
): void {
  const width = contentWidth(pdf);
  const top = pdf.page.height - MARGIN + 8;
  // PDFKit refuses to place flow text past the bottom margin and would add a
  // page instead. Lifting the margin for the draws below is the way in.
  const margin = pdf.page.margins.bottom;
  pdf.page.margins.bottom = 0;
  pdf.rect(MARGIN, top, width, 0.6).fill(color.rule);
  pdf.y = top + 4;
  pdf.font("Times-Roman").fontSize(7.5).fillColor(NEUTRALS.textSoft);
  for (const line of identification.footer) {
    pdf.text(line, MARGIN, pdf.y, { width, align: "center" });
  }
  if (documentLine) {
    pdf
      .font("Helvetica")
      .fontSize(6)
      .fillColor(color.text)
      .text(documentLine, MARGIN, pdf.y + 2, { width, align: "center" });
  }
  pdf.page.margins.bottom = margin;
}
