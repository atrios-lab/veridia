import "server-only";
import {
  type PDFDocument as Doc,
  degrees,
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import QRCode from "qrcode";
import {
  formatVerificationCode,
  SIGNATURE_LEGAL_BASIS,
} from "@/core/signature/policy.ts";

/**
 * The visible part of the signature, as the e-Notariado and the registries
 * print it: a band along the right edge saying the document is signed and
 * where to check it, and the QR to the verification page in the bottom
 * corner.
 *
 * Drawn where the reader sees it: inside the page's crop box and turned
 * with the page's /Rotate, so a scanned or rotated PDF (a CNH, a phone
 * scan) shows it on the right edge as it is read, not off the page.
 */

const INK = rgb(0.2, 0.2, 0.2);

/**
 * The lines of the band, bottom to top along the margin (decision of
 * 11/11/2026): who signed, by the certificate holder's full name, and
 * when; the office in capitals, as registered on the platform; the legal
 * basis; where to check. The first two in bold.
 */
export function bandLines(input: {
  code: string;
  verifyUrl: string;
  signer: { name: string; at: string };
  office: string;
}): string[] {
  const code = formatVerificationCode(input.code);
  // The site's address without the code: the code goes apart, readable.
  const site = input.verifyUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/[^/]*$/, "");
  return [
    `Assinado digitalmente por ${input.signer.name.trim()}, em ${input.signer.at}, com certificado ICP-Brasil (PAdES).`,
    input.office.trim().toLocaleUpperCase("pt-BR"),
    `Validade jurídica: ${SIGNATURE_LEGAL_BASIS}.`,
    `Verifique em ${site} com o código ${code}, ou em validar.iti.gov.br. Assinaturas e certificados no manifesto.`,
  ];
}

/** How many of the band's first lines are bold. */
const BOLD_LINES = 2;

export async function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    margin: 0,
    width: 240,
    errorCorrectionLevel: "M",
  });
}

/** The page as the reader sees it: crop box, turned by /Rotate. */
export interface PageView {
  box: { x: number; y: number; width: number; height: number };
  rotation: number;
}

export function viewOf(page: PDFPage): PageView {
  const box = page.getCropBox();
  const rotation = (((page.getRotation().angle % 360) + 360) % 360) as number;
  return { box, rotation: rotation - (rotation % 90) };
}

/**
 * From where the reader sees a point (origin at the bottom left of the
 * page as shown) to the PDF's own coordinates.
 */
export function toUser(
  view: PageView,
  vx: number,
  vy: number,
): { x: number; y: number } {
  const { x, y, width, height } = view.box;
  switch (view.rotation) {
    case 90:
      return { x: x + width - vy, y: y + vx };
    case 180:
      return { x: x + width - vx, y: y + height - vy };
    case 270:
      return { x: x + vy, y: y + height - vx };
    default:
      return { x: x + vx, y: y + vy };
  }
}

/** The page's size as shown. */
export function shownSize(view: PageView): { width: number; height: number } {
  return view.rotation === 90 || view.rotation === 270
    ? { width: view.box.height, height: view.box.width }
    : { width: view.box.width, height: view.box.height };
}

const QR_SIZE = 44;

/**
 * Draws the band and the QR on `target` at the place they have on `page`
 * (the same page, or a blank one used as a signature's appearance).
 */
export function drawBand(
  target: PDFPage,
  view: PageView,
  parts: {
    lines: string[];
    code: string;
    qr: PDFImage;
    font: PDFFont;
    bold: PDFFont;
  },
): void {
  const { width, height } = shownSize(view);
  // As large as 6.5 pt while the longest line fits the page's height.
  const room = height - 160;
  const widest = Math.max(
    ...parts.lines.map((line, index) =>
      (index < BOLD_LINES ? parts.bold : parts.font).widthOfTextAtSize(
        line,
        6.5,
      ),
    ),
  );
  const size = Math.min(6.5, (6.5 * room) / widest);
  // Up the right margin, read bottom to top.
  parts.lines.forEach((line, index) => {
    const at = toUser(
      view,
      width - 14 - (parts.lines.length - 1 - index) * (size + 2),
      120,
    );
    target.drawText(line, {
      ...at,
      size,
      font: index < BOLD_LINES ? parts.bold : parts.font,
      color: INK,
      rotate: degrees(90 + view.rotation),
    });
  });
  const qrAt = toUser(view, width - QR_SIZE - 24, 16);
  target.drawImage(parts.qr, {
    ...qrAt,
    width: QR_SIZE,
    height: QR_SIZE,
    rotate: degrees(view.rotation),
  });
  target.drawText(formatVerificationCode(parts.code), {
    ...toUser(view, width - QR_SIZE - 24, 8),
    size: 5.5,
    font: parts.bold,
    color: INK,
    rotate: degrees(view.rotation),
  });
}

/**
 * Where the band and the QR land, in the PDF's coordinates: the rectangle
 * of a signature's visible appearance.
 */
export function bandRect(view: PageView): [number, number, number, number] {
  const { width, height } = shownSize(view);
  const corners = [
    toUser(view, width - QR_SIZE - 30, 2),
    toUser(view, width - 2, height - 30),
  ];
  return [
    Math.min(corners[0].x, corners[1].x),
    Math.min(corners[0].y, corners[1].y),
    Math.max(corners[0].x, corners[1].x),
    Math.max(corners[0].y, corners[1].y),
  ];
}

async function fontsFor(doc: Doc) {
  return {
    font: await doc.embedFont(StandardFonts.TimesRoman),
    bold: await doc.embedFont(StandardFonts.TimesRomanBold),
  };
}

/**
 * The band on every page before signing, the manifest pages at the end
 * first when given. It names the signer (the certificate holder's full
 * name) and the office; a later co-signature, added without touching these
 * pages, is listed in the manifest and in the PDF's signature panel.
 */
export async function stampForSignature(
  original: Buffer,
  options: {
    code: string;
    verifyUrl: string;
    signer: { name: string; at: string };
    office: string;
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
  const { font, bold } = await fontsFor(doc);
  const qr = await doc.embedPng(await qrPng(options.verifyUrl));
  const lines = bandLines(options);
  for (const page of doc.getPages()) {
    drawBand(page, viewOf(page), {
      lines,
      code: options.code,
      qr,
      font,
      bold,
    });
  }
  const pdf = Buffer.from(await doc.save({ useObjectStreams: false }));
  return { pdf, pageCount };
}

/**
 * The band of one signature, drawn on a blank page the size of `page`: the
 * visible appearance of a signature added to a PDF that was already signed
 * elsewhere, whose pages cannot change without breaking that signature.
 */
export async function bandAppearancePage(
  page: PDFPage,
  input: {
    code: string;
    verifyUrl: string;
    signer: { name: string; at: string };
    office: string;
  },
): Promise<{ doc: Doc; page: PDFPage; view: PageView }> {
  const view = viewOf(page);
  const media = page.getMediaBox();
  const doc = await PDFDocument.create();
  // Same coordinates as the original page: what is drawn here at (x, y)
  // lands at (x, y) there.
  const blank = doc.addPage([media.x + media.width, media.y + media.height]);
  const { font, bold } = await fontsFor(doc);
  drawBand(blank, view, {
    lines: bandLines(input),
    code: input.code,
    qr: await doc.embedPng(await qrPng(input.verifyUrl)),
    font,
    bold,
  });
  return { doc, page: blank, view };
}
