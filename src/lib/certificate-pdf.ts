import "server-only";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { P12Signer } from "@signpdf/signer-p12";
import { SignPdf } from "@signpdf/signpdf";
import forge from "node-forge";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { CertificateFacts } from "@/core/courses/certificate.ts";
import { formatCpf } from "@/core/request/form.ts";
import {
  ATRIOS_MARK_PATHS,
  ATRIOS_MARK_VIEWBOX,
} from "./assets/atrios-mark.ts";
import {
  GROTESK_BOLD_TTF_BASE64,
  PLEX_MONO_MEDIUM_TTF_BASE64,
  PLEX_SANS_SEMIBOLD_TTF_BASE64,
  PLEX_SANS_TTF_BASE64,
} from "./assets/fonts.ts";
import {
  SIGNATURE_BASELINE,
  SIGNATURE_PNG_BASE64,
  SIGNATURE_SIZE,
} from "./assets/signature.ts";

// The course certificate as a PDF: drawn with pdfkit, then signed by the
// platform with its ICP-Brasil A1 certificate (PAdES, adbe.pkcs7.detached),
// so any PDF reader shows who signed and that nothing changed since.
//
// Generated at every download from the snapshot stored at issue: no PDF
// with a full CPF is ever kept in the store. The instructor's handwritten
// signature is an image on the page; what makes the document authentic is
// the digital signature.

/** The platform's signing certificate, read from the deploy's secrets. */
export interface SigningCertificate {
  p12: Buffer;
  passphrase: string;
  /** Read from the certificate itself, so the visible block never says
   * something the signature does not. */
  holder: { name: string; cnpj: string | null; validUntil: Date };
}

/**
 * The holder as an ICP-Brasil e-CNPJ names it: the subject's CN reads
 * "RAZÃO SOCIAL:00000000000000". A certificate that does not follow that
 * pattern keeps the whole CN as the name and no CNPJ.
 */
export function readSigningCertificate(
  p12: Buffer,
  passphrase: string,
): SigningCertificate {
  const asn1 = forge.asn1.fromDer(p12.toString("binary"));
  const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, passphrase);
  const bags = pkcs12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ];
  // The signer's own certificate is the one that is no CA.
  const certs = (bags ?? [])
    .map((bag) => bag.cert)
    .filter((cert): cert is forge.pki.Certificate => Boolean(cert));
  const own =
    certs.find((cert) => {
      const constraints = cert.getExtension("basicConstraints") as
        | { cA?: boolean }
        | undefined;
      return !constraints?.cA;
    }) ?? certs[0];
  if (!own) throw new Error("certificado A1 sem certificado do titular");
  const cn = String(own.subject.getField("CN")?.value ?? "");
  const match = /^(.*?):(\d{14})$/.exec(cn);
  return {
    p12,
    passphrase,
    holder: {
      name: (match ? match[1] : cn).trim(),
      cnpj: match ? match[2] : null,
      validUntil: own.validity.notAfter,
    },
  };
}

/** From `CERT_A1_PFX_BASE64` and `CERT_A1_PASSWORD`; null when unset. */
export function signingCertificateFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SigningCertificate | null {
  const base64 = env.CERT_A1_PFX_BASE64;
  const passphrase = env.CERT_A1_PASSWORD;
  if (!base64 || passphrase === undefined) return null;
  return readSigningCertificate(Buffer.from(base64, "base64"), passphrase);
}

/** One line of the syllabus on the back page, in course order. */
export interface SyllabusItem {
  /** "Apresentação", "Aula 1"…, "Encerramento" (see itemLabels). */
  label: string;
  title: string;
  description: string;
}

export interface CertificateDocument extends CertificateFacts {
  code: string;
  /** The public check's full address, also in the QR. */
  validationUrl: string;
  instructorName: string;
  /** The course's videos, for the back page; none, and there is no back. */
  syllabus?: readonly SyllabusItem[];
  /** The assessment's minimum share of right answers, for the back page. */
  passingScore?: number;
}

// The look of the Átrios site (site-atrios): a dark band with a blue glow
// and a fine grid on top, the brand blues for emphasis, Space Grotesk for
// titles, IBM Plex for text. The same for every office, so no office's
// palette. Measures are in PDF points on A4 landscape (841.89 × 595.28).
const INK = "#0b0f17";
const GREY = "#4b5563";
const RULE = "#d6dce8";
const BLUE = "#2563eb";
const BLUE_DEEP = "#1d4ed8";
const BLUE_LIGHT = "#60a5fa";
const BLUE_GLOW = "#3b82f6";
const BAND = "#07080b";
const ALERT = "#b42318";

const MARGIN_LEFT = 63;
const MARGIN_RIGHT = 57;

type Pdf = InstanceType<typeof PDFDocument>;

function collect(pdf: Pdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
}

function registerFonts(pdf: Pdf): void {
  pdf.registerFont("grotesk", Buffer.from(GROTESK_BOLD_TTF_BASE64, "base64"));
  pdf.registerFont("sans", Buffer.from(PLEX_SANS_TTF_BASE64, "base64"));
  pdf.registerFont(
    "sans-semibold",
    Buffer.from(PLEX_SANS_SEMIBOLD_TTF_BASE64, "base64"),
  );
  pdf.registerFont("mono", Buffer.from(PLEX_MONO_MEDIUM_TTF_BASE64, "base64"));
}

/** The Átrios mark, `width` wide, its box's top left at (x, y). */
function drawMark(
  pdf: Pdf,
  x: number,
  y: number,
  width: number,
  color: string,
  opacity = 1,
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

/**
 * The faint seal behind the text: two pairs of rings, the training's name
 * running round between them and the mark in the middle. `size` is its
 * diameter; drawn on a 600-unit box like the design it came from.
 */
function drawSeal(pdf: Pdf, x: number, y: number, size: number): void {
  const k = size / 600;
  const cx = x + 300 * k;
  const cy = y + 300 * k;
  pdf.save();
  pdf.strokeColor(BLUE).fillColor(BLUE).opacity(0.05);
  for (const [r, w] of [
    [290, 10],
    [262, 2],
    [204, 2],
    [190, 8],
  ] as const) {
    pdf
      .circle(cx, cy, r * k)
      .lineWidth(w * k)
      .stroke();
  }
  // The name round the ring, clockwise from the left, baseline on the
  // circle, each letter turned to the tangent.
  const text =
    "TREINAMENTO · PROTEÇÃO DE DADOS · TREINAMENTO · PROTEÇÃO DE DADOS ·";
  const radius = 232 * k;
  const fontSize = 34 * k;
  const spacing = 14 * k;
  pdf.font("grotesk").fontSize(fontSize);
  // The text is longer than the ring: like SVG's textPath, it stops where
  // the circle closes instead of running over its own start.
  const circumference = 2 * Math.PI * radius;
  let arc = 0;
  for (const ch of text) {
    const w = pdf.widthOfString(ch);
    if (arc + w > circumference) break;
    const angle = Math.PI + (arc + w / 2) / radius;
    pdf.save();
    pdf.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    pdf.rotate(((angle + Math.PI / 2) * 180) / Math.PI);
    pdf.text(ch, -w / 2, 0, { lineBreak: false, baseline: "alphabetic" });
    pdf.restore();
    arc += w + spacing;
  }
  pdf.restore();
  const markW = 0.7 * 400 * k * (ATRIOS_MARK_VIEWBOX.width / 400);
  drawMark(pdf, cx - markW / 2, cy - markHeight(markW) / 2, markW, BLUE, 0.05);
}

/**
 * The dark band on top of a page, as the site's hero: near black, a blue
 * glow, a fine grid, the mark large and faint, and a blue rule underneath.
 * Returns nothing; the caller writes its own title over it.
 */
function drawBand(pdf: Pdf, height: number, logoWidth: number): void {
  const W = pdf.page.width;
  pdf.save();
  pdf.rect(0, 0, W, height).clip();
  pdf.rect(0, 0, W, height).fill(BAND);
  const glow = pdf.radialGradient(
    W * 0.28,
    height * 0.2,
    0,
    W * 0.28,
    height * 0.2,
    W * 0.42,
  );
  glow.stop(0, BLUE_GLOW, 0.26).stop(1, BLUE_GLOW, 0);
  pdf.rect(0, 0, W, height).fill(glow);
  const glow2 = pdf.radialGradient(
    W * 0.92,
    height * 1.1,
    0,
    W * 0.92,
    height * 1.1,
    W * 0.3,
  );
  glow2.stop(0, BLUE_GLOW, 0.18).stop(1, BLUE_GLOW, 0);
  pdf.rect(0, 0, W, height).fill(glow2);
  pdf.strokeColor("#ffffff").strokeOpacity(0.035).lineWidth(0.75);
  for (let gx = 33; gx < W; gx += 33)
    pdf.moveTo(gx, 0).lineTo(gx, height).stroke();
  for (let gy = 33; gy < height; gy += 33)
    pdf.moveTo(0, gy).lineTo(W, gy).stroke();
  pdf.restore();
  drawMark(pdf, W - 112 - height * 1.12, -30, height * 1.12, "#ffffff", 0.07);
  const rule = pdf.linearGradient(0, 0, W, 0);
  rule.stop(0, BLUE).stop(0.45, BLUE_LIGHT).stop(0.85, BLUE_LIGHT, 0);
  pdf.rect(0, height - 2.25, W, 2.25).fill(rule);
  drawMark(
    pdf,
    W - MARGIN_RIGHT - logoWidth,
    (height - markHeight(logoWidth)) / 2,
    logoWidth,
    "#ffffff",
  );
}

/** The small mono line above a band's title, with a short rule before it. */
function drawEyebrow(pdf: Pdf, text: string, x: number, y: number): void {
  pdf
    .moveTo(x, y + 3.5)
    .lineTo(x + 21, y + 3.5)
    .lineWidth(0.75)
    .strokeColor(BLUE_LIGHT)
    .stroke();
  pdf
    .font("mono")
    .fontSize(8.25)
    .fillColor(BLUE_LIGHT)
    .text(text.toLocaleUpperCase("pt-BR"), x + 30, y, {
      characterSpacing: 2,
      lineBreak: false,
    });
}

/** 7 de novembro de 2026, in the RN clock every office keeps. */
function longDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCnpj(cnpj: string): string {
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

/** A pill: "2 horas", "100% de aproveitamento". Returns its width. */
function drawChip(pdf: Pdf, text: string, x: number, y: number): number {
  pdf.font("sans-semibold").fontSize(9.4);
  const w = pdf.widthOfString(text) + 9 + 4.5 + 5 + 9;
  pdf.roundedRect(x, y, w, 21, 10.5).fill("#eaf1ff");
  pdf.circle(x + 9 + 2.25, y + 10.5, 2.25).fill(BLUE);
  pdf.fillColor(BLUE_DEEP).text(text, x + 9 + 4.5 + 5, y + 5.6, {
    lineBreak: false,
  });
  return w;
}

async function drawFront(
  pdf: Pdf,
  doc: CertificateDocument,
  signer: SigningCertificate | null,
): Promise<void> {
  const W = pdf.page.width;
  const H = pdf.page.height;

  drawSeal(pdf, -142.5, 187.5, 450);
  const backW = 300;
  drawMark(
    pdf,
    W + 52.5 - backW,
    H + 187.5 - markHeight(backW),
    backW,
    BLUE,
    0.045,
  );

  const bandH = 159;
  drawBand(pdf, bandH, 69);
  drawEyebrow(
    pdf,
    "Treinamento · Átrios Tecnologia e Consultoria",
    MARGIN_LEFT,
    51,
  );
  pdf
    .font("grotesk")
    .fontSize(37.5)
    .fillColor("#ffffff")
    .text("Certificado de ", MARGIN_LEFT, 70, {
      continued: true,
      characterSpacing: -0.6,
      lineBreak: false,
    })
    .fillColor(BLUE_LIGHT)
    .text("conclusão", { characterSpacing: -0.6, lineBreak: false });

  // Who, and what they finished.
  const x = MARGIN_LEFT;
  const width = 480;
  pdf
    .font("sans")
    .fontSize(11.25)
    .fillColor(GREY)
    .text("Certificamos que", x, 196.5, { width });
  pdf
    .font("grotesk")
    .fontSize(27)
    .fillColor(INK)
    .text(doc.fullName, x, pdf.y + 4, { width, lineGap: 1 });
  pdf
    .font("sans")
    .fontSize(10.1)
    .fillColor(GREY)
    .text(`CPF ${formatCpf(doc.cpf)} · ${doc.roleTitle}`, x, pdf.y + 6, {
      width,
      lineGap: 4,
    })
    .text(doc.tenantName, x, pdf.y, { width, lineGap: 4 });
  pdf
    .font("sans")
    .fontSize(11.25)
    .fillColor(GREY)
    .text("concluiu o curso", x, pdf.y + 14, { width });
  pdf
    .font("grotesk")
    .fontSize(19.5)
    .fillColor(INK)
    .text(doc.courseTitle, x, pdf.y + 2, { width });
  const chipsY = pdf.y + 9;
  const hours =
    doc.workloadHours === 1 ? "1 hora" : `${doc.workloadHours} horas`;
  const first = drawChip(pdf, hours, x, chipsY);
  drawChip(pdf, `${doc.score}% de aproveitamento`, x + first + 6, chipsY);

  // The instructor: the name under the line, the handwritten signature on
  // the line with its loop running over the name, as one signs by hand.
  const colW = 187.5;
  const colX = W - MARGIN_RIGHT - colW;
  const lineY = 259.5;
  pdf
    .moveTo(colX, lineY)
    .lineTo(colX + colW, lineY)
    .lineWidth(0.75)
    .strokeColor("#9aa3b2")
    .stroke();
  pdf
    .font("grotesk")
    .fontSize(11.25)
    .fillColor(INK)
    .text(doc.instructorName, colX, lineY + 10.5, {
      width: colW,
      align: "center",
    });
  pdf
    .font("sans")
    .fontSize(9.4)
    .fillColor(GREY)
    .text("Instrutor", colX, pdf.y + 1, { width: colW, align: "center" });
  const imageH = 87;
  const imageW = (SIGNATURE_SIZE.width / SIGNATURE_SIZE.height) * imageH;
  pdf.image(
    Buffer.from(SIGNATURE_PNG_BASE64, "base64"),
    colX + (colW - imageW) / 2,
    lineY - imageH * SIGNATURE_BASELINE,
    { width: imageW, height: imageH },
  );

  // The platform: the visible mark of the digital signature.
  const digY = 352.5;
  if (signer) {
    pdf
      .font("sans")
      .fontSize(8.6)
      .fillColor(GREY)
      .text("Documento assinado digitalmente por", colX, digY, {
        width: colW,
        align: "center",
        lineGap: 4,
      });
    pdf
      .font("sans-semibold")
      .fillColor(INK)
      .text(signer.holder.name, colX, pdf.y, {
        width: colW,
        align: "center",
        lineGap: 4,
      });
    pdf.font("sans").fillColor(GREY);
    if (signer.holder.cnpj) {
      pdf.text(`CNPJ ${formatCnpj(signer.holder.cnpj)}`, colX, pdf.y, {
        width: colW,
        align: "center",
        lineGap: 4,
      });
    }
    pdf.text("Certificado digital ICP-Brasil", colX, pdf.y, {
      width: colW,
      align: "center",
    });
  } else {
    pdf
      .font("sans-semibold")
      .fontSize(10)
      .fillColor(ALERT)
      .text("Documento de teste", colX, digY, { width: colW, align: "center" });
    pdf
      .font("sans")
      .fontSize(8.6)
      .fillColor(GREY)
      .text(
        "Sem assinatura digital: não vale como certificado.",
        colX,
        pdf.y + 4,
        { width: colW, align: "center" },
      );
  }

  // Validation: QR, date and code.
  const qrSize = 58.5;
  const qrY = H - 36 - qrSize;
  pdf
    .moveTo(MARGIN_LEFT, qrY - 15)
    .lineTo(W - MARGIN_RIGHT, qrY - 15)
    .lineWidth(0.75)
    .strokeColor(RULE)
    .stroke();
  const qr = await QRCode.toBuffer(doc.validationUrl, {
    margin: 0,
    width: 240,
    color: { dark: INK, light: "#ffffff" },
  });
  pdf.image(qr, MARGIN_LEFT, qrY, { width: qrSize, height: qrSize });
  const textX = MARGIN_LEFT + qrSize + 15;
  pdf
    .font("sans")
    .fontSize(9)
    .fillColor(GREY)
    .text(
      `Emitido em ${longDate(doc.issuedAt)} · Código de validação `,
      textX,
      qrY + 14,
      { continued: true, lineBreak: false },
    )
    .font("mono")
    .fillColor(BLUE_DEEP)
    .text(doc.code, { characterSpacing: 0.4, lineBreak: false });
  pdf
    .font("sans")
    .fontSize(9)
    .fillColor(GREY)
    .text(
      `Para conferir, aponte a câmera para o QR ou acesse ${doc.validationUrl.replace(/^https?:\/\//, "")}`,
      textX,
      qrY + 30,
      { lineBreak: false },
    );
}

/** A description as one plain line of prose: the first paragraph, no
 * Markdown emphasis (the panel's descriptions may carry some). */
function plainDescription(text: string): string {
  const first = text.split(/\n\s*\n/)[0] ?? "";
  return first
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function drawBack(pdf: Pdf, doc: CertificateDocument): void {
  const W = pdf.page.width;
  const H = pdf.page.height;
  const syllabus = doc.syllabus ?? [];

  const bandH = 111;
  drawBand(pdf, bandH, 42);
  const hours =
    doc.workloadHours === 1 ? "1 hora" : `${doc.workloadHours} horas`;
  drawEyebrow(
    pdf,
    `${doc.courseTitle} · ${hours} · instrutor ${doc.instructorName}`,
    MARGIN_LEFT,
    34,
  );
  pdf
    .font("grotesk")
    .fontSize(25.5)
    .fillColor("#ffffff")
    .text("Conteúdo programático", MARGIN_LEFT, 52, {
      characterSpacing: -0.4,
      lineBreak: false,
    });

  let lesson = 0;
  const items = syllabus.map((item) => ({
    key: item.label.startsWith("Aula")
      ? String(++lesson).padStart(2, "0")
      : "—",
    title: item.title,
    description: plainDescription(item.description),
  }));
  items.push({
    key: "—",
    title: "Avaliação final",
    description:
      doc.passingScore !== undefined
        ? `Questões de múltipla escolha; aprovação com ${doc.passingScore}% de acertos.`
        : "Questões de múltipla escolha sobre as aulas.",
  });

  // Two columns, the first holding the larger half, as a printed programme.
  const gap = 42;
  const colW = (W - MARGIN_LEFT - MARGIN_RIGHT - gap) / 2;
  const keyW = 22.5 + 10.5;
  const textW = colW - keyW;
  const top = 147;
  const perColumn = Math.ceil(items.length / 2);
  items.forEach((item, i) => {
    const col = i < perColumn ? 0 : 1;
    if (i === 0 || i === perColumn) pdf.y = top;
    const x = MARGIN_LEFT + col * (colW + gap);
    const y = pdf.y;
    pdf
      .moveTo(x, y)
      .lineTo(x + colW, y)
      .lineWidth(0.75)
      .strokeColor("#e6eaf1")
      .stroke();
    pdf
      .font("mono")
      .fontSize(9.75)
      .fillColor(BLUE)
      .text(item.key, x, y + 7.5, { lineBreak: false });
    pdf
      .font("grotesk")
      .fontSize(10.9)
      .fillColor(INK)
      .text(item.title, x + keyW, y + 6.75, { width: textW });
    if (item.description) {
      pdf
        .font("sans")
        .fontSize(9)
        .fillColor(GREY)
        .text(item.description, x + keyW, pdf.y + 1.5, {
          width: textW,
          height: 26,
          ellipsis: true,
          lineGap: 1.5,
        });
    }
    pdf.y += 6.75;
  });

  const footY = H - 36 - 12;
  pdf
    .moveTo(MARGIN_LEFT, footY - 12)
    .lineTo(W - MARGIN_RIGHT, footY - 12)
    .lineWidth(0.75)
    .strokeColor(RULE)
    .stroke();
  pdf
    .font("sans")
    .fontSize(9)
    .fillColor(GREY)
    .text("Certificado ", MARGIN_LEFT, footY, {
      continued: true,
      lineBreak: false,
    })
    .font("mono")
    .fillColor(BLUE_DEEP)
    .text(doc.code, { continued: true, lineBreak: false })
    .font("sans")
    .fillColor(GREY)
    .text(` · ${doc.fullName}`, { lineBreak: false });
  const host = doc.validationUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/[^/]*$/, "");
  pdf
    .font("sans")
    .fontSize(9)
    .fillColor(GREY)
    .text(host, MARGIN_LEFT, footY, {
      width: W - MARGIN_LEFT - MARGIN_RIGHT,
      align: "right",
      lineBreak: false,
    });
}

/** The pages, unsigned. `signer` only feeds the visible block. */
async function drawCertificate(
  doc: CertificateDocument,
  signer: SigningCertificate | null,
): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    autoFirstPage: true,
    info: {
      Title: `Certificado: ${doc.courseTitle}`,
      Author: signer?.holder.name ?? "Átrios",
      Subject: `Código de validação ${doc.code}`,
    },
  });
  const done = collect(pdf);
  registerFonts(pdf);
  await drawFront(pdf, doc, signer);
  if (doc.syllabus && doc.syllabus.length > 0) {
    pdf.addPage({ size: "A4", layout: "landscape", margin: 0 });
    drawBack(pdf, doc);
  }
  pdf.end();
  return done;
}

export class SigningUnavailableError extends Error {}

/**
 * The certificate PDF. With a signing certificate, signed (PAdES). Without
 * one, a test document marked as such, and only outside production: in
 * production an unsigned certificate is never handed out.
 */
export async function renderCertificatePdf(
  doc: CertificateDocument,
  signer: SigningCertificate | null,
  options: { production: boolean },
): Promise<Buffer> {
  if (!signer && options.production) {
    throw new SigningUnavailableError(
      "CERT_A1_PFX_BASE64 e CERT_A1_PASSWORD não configurados em produção",
    );
  }
  const unsigned = await drawCertificate(doc, signer);
  if (!signer) return unsigned;
  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer: unsigned,
    reason: "Certificado de conclusão de curso",
    contactInfo: "",
    name: signer.holder.name,
    location: "Brasil",
    // An ICP-Brasil chain is longer than the default room for it.
    signatureLength: 16384,
  });
  return new SignPdf().sign(
    withPlaceholder,
    new P12Signer(signer.p12, { passphrase: signer.passphrase }),
  );
}
