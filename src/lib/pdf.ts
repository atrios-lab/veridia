import "server-only";
import PDFDocument from "pdfkit";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";

const MARGIN = 56;

/**
 * Draws a document the core assembled. The wording, the order and every value
 * come from `src/core/request/requerimento.ts`; this only places them on the
 * page, which is why the same function serves the service request form and the
 * data rights receipt.
 */
export function renderDocument(
  document: RequerimentoDocument,
): Promise<Buffer> {
  const pdf = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
  });

  pdf.font("Helvetica-Bold").fontSize(15).text(document.title);
  pdf.moveDown(0.4);
  pdf.font("Helvetica").fontSize(9.5);
  for (const line of document.office) pdf.text(line);

  for (const section of document.sections) {
    pdf.moveDown(1);
    pdf.font("Helvetica-Bold").fontSize(11).text(section.heading);
    pdf.moveDown(0.3);
    pdf.font("Helvetica").fontSize(10);
    for (const row of section.rows ?? []) {
      pdf.text(`${row.label}: ${row.value}`);
    }
    for (const paragraph of section.paragraphs ?? []) {
      pdf.text(paragraph, { align: "justify" });
      pdf.moveDown(0.2);
    }
  }

  pdf.moveDown(1.5);
  pdf.font("Helvetica").fontSize(10);
  for (const line of document.signature) pdf.text(line, { align: "center" });

  pdf.moveDown(1.5);
  pdf
    .font("Helvetica")
    .fontSize(7.5)
    .text(document.footer, { align: "center" });

  pdf.end();
  return done;
}
