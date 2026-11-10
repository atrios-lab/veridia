import "server-only";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import {
  formatVerificationCode,
  SIGNATURE_LEGAL_BASIS,
} from "@/core/signature/policy.ts";

/**
 * The visible part of the signature, on every page before signing, as the
 * e-Notariado and the registries print it: a band along the right edge
 * saying the document is signed and where to check it, and the QR to the
 * verification page in the bottom corner. It names no signer, so a second
 * signature (added later, without touching these pages) keeps it true.
 * Optionally the manifest pages go at the end first.
 */
export async function stampForSignature(
  original: Buffer,
  options: {
    code: string;
    verifyUrl: string;
    manifest?: Buffer;
  },
): Promise<{ pdf: Buffer; pageCount: number }> {
  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const pageCount = doc.getPageCount();
  if (options.manifest) {
    const manifest = await PDFDocument.load(options.manifest);
    const pages = await doc.copyPages(manifest, manifest.getPageIndices());
    for (const page of pages) doc.addPage(page);
  }

  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const qrPng = await QRCode.toBuffer(options.verifyUrl, {
    margin: 0,
    width: 240,
    errorCorrectionLevel: "M",
  });
  const qr = await doc.embedPng(qrPng);
  const code = formatVerificationCode(options.code);
  // The site's address without the code: the code goes apart, readable.
  const site = options.verifyUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/[^/]*$/, "");
  const lines = [
    "Documento assinado digitalmente com certificado ICP-Brasil (PAdES).",
    `Validade jurídica: ${SIGNATURE_LEGAL_BASIS}.`,
    `Verifique em ${site} com o código ${code}, ou em validar.iti.gov.br. Assinantes, datas e certificados no manifesto.`,
  ];
  const ink = rgb(0.2, 0.2, 0.2);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    // As large as 6.5 pt while the longest line fits the page's height.
    const room = height - 160;
    const widest = Math.max(
      ...lines.map((line, index) =>
        (index === 0 ? bold : font).widthOfTextAtSize(line, 6.5),
      ),
    );
    const size = Math.min(6.5, (6.5 * room) / widest);
    // Two lines up the right margin, read bottom to top.
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: width - 14 - (lines.length - 1 - index) * (size + 2),
        y: 120,
        size,
        font: index === 0 ? bold : font,
        color: ink,
        rotate: degrees(90),
      });
    });
    const qrSize = 44;
    page.drawImage(qr, {
      x: width - qrSize - 24,
      y: 16,
      width: qrSize,
      height: qrSize,
    });
    page.drawText(code, {
      x: width - qrSize - 24,
      y: 8,
      size: 5.5,
      font: bold,
      color: ink,
    });
  }
  const pdf = Buffer.from(await doc.save({ useObjectStreams: false }));
  return { pdf, pageCount };
}
