import "server-only";
import PDFDocument from "pdfkit";
import {
  type CertidaoField,
  type CertidaoForm,
  certidaoModel,
} from "@/core/rcpn/certidao.ts";
import type { RcpnKind } from "@/core/rcpn/record.ts";
import { writtenDate } from "@/core/scheduling/attendance.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { NEUTRALS } from "@/core/tenant/palette.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { brandFor } from "./document-brand.ts";
import { ABNT, DIGITAL_SIGNATURE_NOTE, isDigitalSigning } from "./pdf.ts";
import {
  drawCenteredIdentification,
  drawIdentificationFooter,
  identificationOf,
} from "./pdf-letterhead.ts";
import { MARGIN, type Pdf } from "./pdf-primitives.ts";

/**
 * The certidão of the Registro Civil, two ways.
 *
 * Printed, it goes on the security paper, which already carries the arms
 * (decision of 14/11/2026): no letterhead is drawn, and the top of the
 * sheet is left free. The measures are the office's own Provimento 182
 * model, made for that paper: top margin 964 twips (1.70 cm), then ten
 * blank lines of 10 pt and one of 5 pt before the title (about 4.3 cm),
 * sides 1020 twips (1.80 cm), bottom 454 twips (0.80 cm).
 *
 * Signed digitally, there is no paper: the letterhead with the arms and the
 * identification is drawn, as in every document of the panel.
 */

export interface CertidaoToDraw {
  kind: RcpnKind;
  form: CertidaoForm;
  fields: Record<string, string>;
  seal: string;
  sealKind: string;
  fees: string;
  signerName: string;
  signerTitle: string;
  /** The day it is dated: "YYYY-MM-DD". */
  issuedOn: IsoDate;
}

/** 1 cm in PDF points. */
const CM = 72 / 2.54;
/** The printed sheet, from the Provimento 182 model (see above). */
export const SECURITY_PAPER = {
  side: 1.8 * CM,
  bottom: 0.8 * CM,
  /** Where the title starts: 1.70 cm margin plus the blank lines. */
  titleTop: 1.7 * CM + 10 * 11.5 + 5.75,
} as const;

const GAP = 3;
const PAD = 3;
const LABEL_SIZE = 6.5;
const VALUE_SIZE = 9.5;

interface Layout {
  left: number;
  width: number;
  bottom: number;
  top: number;
}

/**
 * Every value is justified (decision of 14/11/2026: "justifique os textos e
 * lembre das normas ABNT"); a one-line value sits as it would anyway.
 */
const VALUE_TEXT = { align: "justify" as const };

function measure(pdf: Pdf, width: number, label: string, value: string) {
  pdf.font("Helvetica-Bold").fontSize(LABEL_SIZE);
  const l = pdf.heightOfString(label, { width: width - PAD * 2 });
  pdf.font("Helvetica").fontSize(VALUE_SIZE);
  const v = pdf.heightOfString(value || " ", {
    width: width - PAD * 2,
    ...VALUE_TEXT,
  });
  return { label: l, height: PAD + l + 2 + v + PAD };
}

function box(
  pdf: Pdf,
  x: number,
  y: number,
  width: number,
  height: number,
  field: CertidaoField,
  value: string,
  rule: string,
) {
  const { label } = measure(pdf, width, field.label, value);
  pdf.lineWidth(0.6).strokeColor(rule).rect(x, y, width, height).stroke();
  pdf
    .font("Helvetica-Bold")
    .fontSize(LABEL_SIZE)
    .fillColor(NEUTRALS.textSoft)
    .text(field.label, x + PAD, y + PAD, { width: width - PAD * 2 });
  pdf
    .font("Helvetica")
    .fontSize(VALUE_SIZE)
    .fillColor(NEUTRALS.text)
    .text(value || " ", x + PAD, y + PAD + label + 2, {
      width: width - PAD * 2,
      ...VALUE_TEXT,
    });
}

/**
 * The inteiro teor is a text, not a box: by ABNT NBR 14724, 12 pt, line
 * spacing 1.5, a 1.25 cm indent on each paragraph's first line, justified.
 * It runs over as many sheets as the registro takes.
 */
function drawTeor(
  pdf: Pdf,
  left: number,
  width: number,
  field: CertidaoField,
  value: string,
  rule: string,
) {
  pdf.rect(left, pdf.y, width, 0.6).fill(rule);
  pdf.y += 3;
  pdf
    .font("Helvetica-Bold")
    .fontSize(LABEL_SIZE)
    .fillColor(NEUTRALS.textSoft)
    .text(field.label, left, pdf.y, { width });
  pdf.y += 4;
  pdf
    .font("Helvetica")
    .fontSize(ABNT.fontSize)
    .fillColor(NEUTRALS.text)
    .text(value || " ", left, pdf.y, {
      width,
      align: "justify",
      lineGap: ABNT.lineGap,
      indent: ABNT.indent,
    });
  pdf.y += 4;
  pdf.rect(left, pdf.y, width, 0.6).fill(rule);
  pdf.y += GAP + 2;
}

/** The model's rows: fields with the same `row`, side by side. */
function rowsOf(fields: CertidaoField[]): CertidaoField[][] {
  const rows: CertidaoField[][] = [];
  for (const field of fields) {
    const last = rows.at(-1);
    const head = last?.[0];
    if (
      last &&
      head &&
      field.row !== undefined &&
      head.row === field.row &&
      !field.multiline
    ) {
      last.push(field);
    } else {
      rows.push([field]);
    }
  }
  return rows;
}

export async function renderCertidao(
  tenant: Tenant,
  certidao: CertidaoToDraw,
): Promise<Buffer> {
  const brand = await brandFor(tenant);
  const identification = identificationOf(brand, [tenant.name]);
  const model = certidaoModel(certidao.kind, certidao.form);
  const digital = isDigitalSigning();
  const rule = NEUTRALS.text;
  const matricula = certidao.fields.matricula ?? "";

  const pdf = new PDFDocument({
    size: "A4",
    margins: digital
      ? { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
      : {
          top: SECURITY_PAPER.titleTop,
          bottom: SECURITY_PAPER.bottom,
          left: SECURITY_PAPER.side,
          right: SECURITY_PAPER.side,
        },
    autoFirstPage: false,
    info: {
      Title: model.title.toLowerCase().replace(/^./, (c) => c.toUpperCase()),
    },
  });
  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    pdf.on("end", () => resolve(Buffer.concat(chunks))),
  );

  const layout = (): Layout =>
    digital
      ? {
          left: MARGIN,
          width: pdf.page.width - MARGIN * 2,
          bottom: pdf.page.height - MARGIN,
          top: 0,
        }
      : {
          left: SECURITY_PAPER.side,
          width: pdf.page.width - SECURITY_PAPER.side * 2,
          bottom: pdf.page.height - SECURITY_PAPER.bottom - 10,
          top: SECURITY_PAPER.titleTop,
        };

  // Each sheet: the letterhead (digital) or the free top of the paper. On
  // `pageAdded`, so the sheets a long inteiro teor flows onto get it too.
  pdf.on("pageAdded", () => {
    const { left, width } = layout();
    if (digital) {
      const y = drawCenteredIdentification(pdf, identification, {
        top: 34,
        arms: 38,
        heading: 10,
        small: 8,
        sideRoom: 30,
      });
      pdf.rect(left, y, width, 0.6).fill(brand.palette.border);
      drawIdentificationFooter(
        pdf,
        identification,
        matricula ? `Matrícula ${matricula}` : "",
        { rule: brand.palette.border, text: NEUTRALS.textSoft },
      );
      // Text that flows onto the next sheet starts under the letterhead.
      pdf.options.margins = {
        top: y + 12,
        bottom: MARGIN,
        left: MARGIN,
        right: MARGIN,
      };
      pdf.y = y + 12;
    } else {
      pdf.y = SECURITY_PAPER.titleTop;
    }
  });
  const newPage = () => {
    pdf.addPage();
  };

  newPage();
  const { left, width } = layout();
  pdf
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(NEUTRALS.text)
    .text(model.title, left, pdf.y, { width, align: "center" });
  pdf.y += 8;

  for (const row of rowsOf(model.fields)) {
    const only = row[0];
    if (row.length === 1 && only?.key === "teor") {
      drawTeor(pdf, left, width, only, certidao.fields.teor ?? "", rule);
      continue;
    }
    const total = row.reduce((sum, f) => sum + (f.span ?? 1), 0);
    const room = width - GAP * (row.length - 1);
    const widths = row.map((f) => (room * (f.span ?? 1)) / total);
    const values = row.map((f) => certidao.fields[f.key] ?? "");
    const height = Math.max(
      ...row.map(
        (f, i) =>
          measure(pdf, widths[i] ?? width, f.label, values[i] ?? "").height,
      ),
    );
    if (pdf.y + height > layout().bottom) newPage();
    const y = pdf.y;
    let x = left;
    row.forEach((f, i) => {
      const w = widths[i] ?? width;
      box(pdf, x, y, w, height, f, values[i] ?? "", rule);
      x += w + GAP;
    });
    pdf.y = y + height + GAP;
  }

  // The office, as the model closes: CNS, name, the officer, the address.
  const office = [
    `CNS nº ${tenant.cns}`,
    tenant.name,
    "Oficial de Registro Civil",
    [tenant.address, `${tenant.location.city}/${tenant.location.state}`]
      .filter(Boolean)
      .join(" - "),
  ];
  const sealLines = certidao.seal
    ? [
        ...(tenant.location.state === "RN" ? ["Poder Judiciário do RN"] : []),
        "Selo Digital de Fiscalização",
        [certidao.sealKind, certidao.seal].filter(Boolean).join(" "),
        "Confira em: https://selodigital.tjrn.jus.br",
      ]
    : [];
  // What the closing takes, measured, so it never splits from the text.
  pdf.font("Helvetica").fontSize(8);
  const lineOf8 = pdf.currentLineHeight(true);
  const feesHeight = certidao.fees
    ? pdf.heightOfString(certidao.fees, { width, align: "justify" }) + 4
    : 0;
  const sealHeight = sealLines.length > 0 ? sealLines.length * 10 + 8 + 14 : 0;
  const closing =
    4 +
    office.length * lineOf8 +
    feesHeight +
    sealHeight +
    4 +
    2 * 12 +
    (digital ? 8 + 3 * 11 : 28 + 3) +
    2 * 11;
  if (pdf.y + closing > layout().bottom) newPage();

  pdf.y += 4;
  pdf.font("Helvetica").fontSize(8).fillColor(NEUTRALS.text);
  for (const line of office) pdf.text(line, left, pdf.y, { width });
  if (certidao.fees) {
    pdf.y += 4;
    pdf.text(certidao.fees, left, pdf.y, { width, align: "justify" });
  }

  if (sealLines.length > 0) {
    pdf.y += 8;
    const top = pdf.y;
    const sealWidth = 250;
    const x = left + (width - sealWidth) / 2;
    const sealHeight = sealLines.length * 10 + 8;
    pdf
      .lineWidth(0.8)
      .strokeColor(NEUTRALS.text)
      .rect(x, top, sealWidth, sealHeight)
      .stroke();
    let y = top + 4;
    const code = sealLines.length - 2;
    sealLines.forEach((text, index) => {
      pdf
        .font(index === code ? "Helvetica-Bold" : "Helvetica")
        .fontSize(index === code ? 8.5 : 7.5)
        .fillColor(NEUTRALS.text)
        .text(text, x, y, { width: sealWidth, align: "center" });
      y += 10;
    });
    pdf.y = top + sealHeight + 6;
  }

  pdf.y += 4;
  pdf
    .font("Helvetica")
    .fontSize(10)
    .fillColor(NEUTRALS.text)
    .text("O conteúdo da certidão é verdadeiro. Dou fé.", left, pdf.y, {
      width,
      align: "center",
    });
  pdf.text(
    `${tenant.location.city}, ${writtenDate(certidao.issuedOn)}.`,
    left,
    pdf.y + 2,
    { width, align: "center" },
  );

  if (digital) {
    pdf.y += 8;
    pdf
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .fillColor(NEUTRALS.textSoft)
      .text(DIGITAL_SIGNATURE_NOTE, left + 20, pdf.y, {
        width: width - 40,
        align: "center",
      });
  } else {
    pdf.y += 28;
    const line = 240;
    pdf.rect(left + (width - line) / 2, pdf.y, line, 0.8).fill(NEUTRALS.text);
    pdf.y += 3;
  }
  const signer = [certidao.signerName, certidao.signerTitle]
    .filter(Boolean)
    .join(", ");
  pdf
    .font("Helvetica")
    .fontSize(9)
    .fillColor(NEUTRALS.text)
    .text(
      signer || "Assinatura do Oficial / Substituto / Escrevente",
      left,
      pdf.y + 2,
      { width, align: "center" },
    );
  pdf
    .fontSize(7.5)
    .fillColor(NEUTRALS.textSoft)
    .text("Sinal Público em CRC e CENSEC", left, pdf.y + 2, {
      width,
      align: "center",
    });

  pdf.end();
  return done;
}
