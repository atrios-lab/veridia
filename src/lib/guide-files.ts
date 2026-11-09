import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { buildGuideDocument } from "@/core/guides/document.ts";
import type { GuideSettings } from "@/core/guides/schema.ts";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { officeIdentification } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import {
  BRASAO_PNG_BASE64,
  BRASAO_SIZE,
} from "./assets/brasao-da-republica-png.ts";
import { brandFor } from "./document-brand.ts";
import { renderDocument, renderDocuments } from "./pdf.ts";
import type { StoredGuide } from "./tax-guides.ts";
import { OFFICE_TIME_ZONE } from "./tenant.ts";

function guideDocumentFor(
  tenant: Tenant,
  settings: GuideSettings,
  stored: StoredGuide,
): RequerimentoDocument {
  return buildGuideDocument(tenant, {
    guide: stored.guide,
    settings,
    year: stored.year,
    sequence: stored.sequence,
    // Dated the day it was issued, so a reprint is the same paper.
    issuedOn: toIsoDate(stored.createdAt, OFFICE_TIME_ZONE),
  });
}

/** The guia as a PDF on the office's letterhead, like every other paper. */
export async function renderGuidePdf(
  tenant: Tenant,
  settings: GuideSettings,
  stored: StoredGuide,
): Promise<Buffer> {
  return renderDocument(
    guideDocumentFor(tenant, settings, stored),
    await brandFor(tenant),
  );
}

/**
 * Every guia of a year in one PDF, in number order: what the office files
 * in its own archive before the platform's year of keeping is up.
 */
export async function renderGuidesPdf(
  tenant: Tenant,
  settings: GuideSettings,
  stored: StoredGuide[],
): Promise<Buffer> {
  return renderDocuments(
    stored.map((one) => guideDocumentFor(tenant, settings, one)),
    await brandFor(tenant),
  );
}

const FONT = "Times New Roman";
const run = (text: string, options: { bold?: boolean; size?: number } = {}) =>
  new TextRun({
    text,
    font: FONT,
    size: options.size ?? 24,
    bold: options.bold,
  });

/**
 * The same guia as a Word file the office can still edit before signing,
 * as its own guias were kept: the arms and the identification in the
 * header (Provimento CGJ/TJRN 156/2016, art. 2º), the address in the footer,
 * the body in Times New Roman 12.
 */
export async function renderGuideDocx(
  tenant: Tenant,
  settings: GuideSettings,
  stored: StoredGuide,
): Promise<Buffer> {
  const document = guideDocumentFor(tenant, settings, stored);
  const id = officeIdentification(tenant);
  const armsHeight = 64;

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "png",
            data: Buffer.from(BRASAO_PNG_BASE64, "base64"),
            transformation: {
              width: Math.round(
                (armsHeight * BRASAO_SIZE.width) / BRASAO_SIZE.height,
              ),
              height: armsHeight,
            },
          }),
        ],
      }),
      ...id.header.map(
        (line) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(line, { bold: true, size: 22 })],
          }),
      ),
      ...[id.holder, id.attributions].filter(Boolean).map(
        (line) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(line as string, { size: 16 })],
          }),
      ),
      new Paragraph({
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: "999999",
            space: 4,
          },
        },
        children: [],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        border: {
          top: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: "999999",
            space: 4,
          },
        },
        children: [],
      }),
      ...id.footer.map(
        (line) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(line, { size: 16 })],
          }),
      ),
    ],
  });

  const body: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        run(document.title.toLocaleUpperCase("pt-BR"), {
          bold: true,
          size: 28,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [run(document.subtitle, { size: 20 })],
    }),
  ];
  for (const section of document.sections) {
    body.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          run(section.heading.toLocaleUpperCase("pt-BR"), {
            bold: true,
            size: 20,
          }),
        ],
      }),
    );
    for (const row of section.rows ?? []) {
      body.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [run(`${row.label}: `, { bold: true }), run(row.value)],
        }),
      );
    }
    for (const paragraph of section.paragraphs ?? []) {
      body.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120, line: 320 },
          children: [run(paragraph)],
        }),
      );
    }
  }
  if (document.signee) {
    body.push(
      new Paragraph({ spacing: { before: 720 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run("_____________________________________________")],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [run(document.signee, { bold: true })],
      }),
      ...document.signature.map(
        (line) =>
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(line, { size: 20 })],
          }),
      ),
    );
  }

  const file = new Document({
    creator: document.office[0] ?? "",
    title: document.title,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: body,
      },
    ],
  });
  return Packer.toBuffer(file);
}
