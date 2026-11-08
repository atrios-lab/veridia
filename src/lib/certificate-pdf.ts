import "server-only";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { P12Signer } from "@signpdf/signer-p12";
import { SignPdf } from "@signpdf/signpdf";
import forge from "node-forge";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import {
  type CertificateFacts,
  certificateSentence,
} from "@/core/courses/certificate.ts";
import { EMAIL_PALETTE, NEUTRALS, PALETTES } from "@/core/tenant/palette.ts";
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

function formatCnpj(cnpj: string): string {
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

export interface CertificateDocument extends CertificateFacts {
  code: string;
  /** The public check's full address, also in the QR. */
  validationUrl: string;
  instructorName: string;
}

// The certificate goes to every office the same, so it wears the platform's
// neutrals and the bronze every palette shares, not one office's colours.
// PDFKit cannot read CSS: the colours come from the palette's TypeScript
// mirror, which palette.test.ts keeps in step with the stylesheet.
const INK = NEUTRALS.text;
const MUTED = NEUTRALS.faint;
const ACCENT = PALETTES["marinho-bronze"].accent;
const LINE = EMAIL_PALETTE.border;
const ALERT = NEUTRALS.alert;

function collect(pdf: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
}

/** The page, unsigned. `signer` only feeds the visible block. */
async function drawCertificate(
  doc: CertificateDocument,
  signer: SigningCertificate | null,
): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    info: {
      Title: `Certificado: ${doc.courseTitle}`,
      Author: signer?.holder.name ?? "Átrios",
      Subject: `Código de validação ${doc.code}`,
    },
  });
  const done = collect(pdf);
  const W = pdf.page.width;
  const H = pdf.page.height;

  // Frame.
  pdf
    .rect(24, 24, W - 48, H - 48)
    .lineWidth(1)
    .strokeColor(LINE)
    .stroke();
  pdf
    .rect(32, 32, W - 64, H - 64)
    .lineWidth(0.5)
    .strokeColor(LINE)
    .stroke();

  // Heading.
  pdf
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(ACCENT)
    .text("TREINAMENTO", 0, 78, {
      width: W,
      align: "center",
      characterSpacing: 3,
    });
  pdf
    .font("Times-Bold")
    .fontSize(40)
    .fillColor(INK)
    .text("Certificado", 0, 100, { width: W, align: "center" });
  pdf
    .font("Times-Italic")
    .fontSize(14)
    .fillColor(MUTED)
    .text("de conclusão de curso", 0, 146, { width: W, align: "center" });

  // The sentence.
  pdf
    .font("Times-Roman")
    .fontSize(16)
    .fillColor(INK)
    .text(certificateSentence(doc, "full"), 110, 205, {
      width: W - 220,
      align: "center",
      lineGap: 6,
    });

  // Instructor: the handwritten signature on the line, name and role
  // below the loop (the image's stroke at SIGNATURE_BASELINE of its
  // height sits exactly on the line).
  const lineY = 384;
  const lineX = 120;
  const lineW = 230;
  const imageH = 80;
  const imageW = (SIGNATURE_SIZE.width / SIGNATURE_SIZE.height) * imageH;
  pdf.image(
    Buffer.from(SIGNATURE_PNG_BASE64, "base64"),
    lineX + (lineW - imageW) / 2,
    lineY - imageH * SIGNATURE_BASELINE,
    { width: imageW, height: imageH },
  );
  pdf
    .moveTo(lineX, lineY)
    .lineTo(lineX + lineW, lineY)
    .lineWidth(0.8)
    .strokeColor(INK)
    .stroke();
  const nameY = lineY + imageH * (1 - SIGNATURE_BASELINE) + 4;
  pdf
    .font("Times-Bold")
    .fontSize(12)
    .fillColor(INK)
    .text(doc.instructorName, lineX, nameY, { width: lineW, align: "center" });
  pdf
    .font("Times-Roman")
    .fontSize(10.5)
    .fillColor(MUTED)
    .text("Instrutor", lineX, nameY + 15, { width: lineW, align: "center" });

  // The platform: the visible mark of the digital signature.
  const boxX = W - 120 - 250;
  const boxY = lineY - 34;
  pdf
    .roundedRect(boxX, boxY, 250, 76, 6)
    .lineWidth(0.8)
    .strokeColor(LINE)
    .stroke();
  if (signer) {
    pdf
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text("Assinado digitalmente por", boxX, boxY + 12, {
        width: 250,
        align: "center",
      });
    pdf
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .fillColor(INK)
      .text(signer.holder.name, boxX + 10, boxY + 25, {
        width: 230,
        align: "center",
      });
    pdf
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        `${signer.holder.cnpj ? `CNPJ ${formatCnpj(signer.holder.cnpj)} · ` : ""}Certificado ICP-Brasil`,
        boxX,
        boxY + 52,
        { width: 250, align: "center" },
      );
  } else {
    pdf
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(ALERT)
      .text("Documento de teste", boxX, boxY + 20, {
        width: 250,
        align: "center",
      });
    pdf
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        "Sem assinatura digital: não vale como certificado.",
        boxX + 10,
        boxY + 38,
        {
          width: 230,
          align: "center",
        },
      );
  }

  // Validation: QR and code.
  const qr = await QRCode.toBuffer(doc.validationUrl, {
    margin: 0,
    width: 240,
    color: { dark: INK, light: NEUTRALS.card },
  });
  const footY = H - 100;
  pdf.image(qr, 56, footY, { width: 56, height: 56 });
  pdf
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(INK)
    .text(`Código de validação: ${doc.code}`, 124, footY + 12);
  pdf
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(`Confira em ${doc.validationUrl}`, 124, footY + 27);

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
