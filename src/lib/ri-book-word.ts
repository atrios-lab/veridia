import "server-only";
import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import sharp from "sharp";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import type { FichaPage, TableBook } from "./ri-book-model.ts";

/**
 * The book in Word (decision of 26/11/2026): the same termos, columns and
 * fichas as the PDF, for the office to adjust, paste the selo or sign as
 * it likes. Times New Roman, as the panel's other documents in Word.
 */

export type WordBlock =
  | { kind: "term"; document: RequerimentoDocument }
  | { kind: "table"; book: TableBook }
  | { kind: "fichas"; fichas: FichaPage[] }
  | { kind: "image"; tiff: Buffer; label: string };

const FONT = "Times New Roman";
const run = (text: string, o: { bold?: boolean; size?: number } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 22, bold: o.bold });
const center = (text: string, bold = false, size = 24) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [run(text, { bold, size })],
  });
const para = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [run(text)],
  });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function term(doc: RequerimentoDocument): Paragraph[] {
  return [
    center(doc.title.toUpperCase(), true, 26),
    ...doc.sections.flatMap((s) => [
      ...(s.heading
        ? [new Paragraph({ children: [run(s.heading, { bold: true })] })]
        : []),
      ...(s.paragraphs ?? []).map(para),
    ]),
    ...(doc.dateLine ? [center(doc.dateLine, false, 22)] : []),
    ...(doc.signee
      ? [
          new Paragraph({ spacing: { before: 720 }, children: [] }),
          center("_____________________________________________", false, 22),
          center(doc.signee, true, 22),
          ...doc.signature.map((l) => center(l, false, 20)),
        ]
      : []),
  ];
}

function table(book: TableBook): (Paragraph | Table)[] {
  const cell = (text: string, bold = false, span = 1) =>
    new TableCell({
      columnSpan: span,
      children: [new Paragraph({ children: [run(text, { bold, size: 18 })] })],
    });
  return [
    center("REGISTRO DE IMÓVEIS", true, 26),
    center(book.title, true, 24),
    new Paragraph({
      children: [run(`Livro nº ${book.volume}        ${book.year}`)],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: book.columns.map((c) => cell(c.label, true)),
        }),
        ...book.rows.map(
          (r) =>
            new TableRow({
              children:
                "across" in r
                  ? [cell(r.across, Boolean(r.bold), book.columns.length)]
                  : r.cells.map((c) => cell(c)),
            }),
        ),
      ],
    }),
  ];
}

async function fichas(list: FichaPage[]): Promise<Paragraph[]> {
  const out: Paragraph[] = [];
  for (const [i, f] of list.entries()) {
    if (i > 0) out.push(pageBreak());
    out.push(
      center("REGISTRO DE IMÓVEIS", true, 26),
      center("REGISTRO GERAL", true, 24),
      new Paragraph({
        children: [
          run(
            `Livro nº ${f.volume}    Ficha ${String(f.sheet).padStart(3, "0")}    ${f.cnm}`,
          ),
        ],
      }),
      new Paragraph({
        children: [
          run(
            `MATRÍCULA Nº ${f.matricula.toLocaleString("pt-BR")}    Data: ${f.date}`,
            {
              bold: true,
            },
          ),
        ],
      }),
      new Paragraph({
        children: [run("IDENTIFICAÇÃO DO IMÓVEL:", { bold: true })],
      }),
      para(f.identification || "não consta"),
      new Paragraph({
        children: [
          run("NOME, DOMICÍLIO E NACIONALIDADE DO PROPRIETÁRIO:", {
            bold: true,
          }),
        ],
      }),
      para(f.owner || "não consta"),
      new Paragraph({
        children: [run("NÚMERO DO REGISTRO ANTERIOR:", { bold: true })],
      }),
      para(f.previous || "não consta"),
    );
    for (const a of f.acts) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120 },
          children: [run(`${a.label} `, { bold: true }), run(a.text)],
        }),
      );
      if (a.seal || a.sealImage) {
        out.push(
          new Paragraph({
            children: [
              ...(a.sealImage
                ? [
                    new ImageRun({
                      type: "png",
                      data: Buffer.from(a.sealImage),
                      transformation: { width: 140, height: 60 },
                    }),
                    run("  "),
                  ]
                : []),
              ...(a.seal ? [run(`Selo: ${a.seal}`, { size: 20 })] : []),
            ],
          }),
        );
      }
    }
  }
  return out;
}

async function image(tiff: Buffer, label: string): Promise<Paragraph[]> {
  const meta = await sharp(tiff).metadata();
  const pages = meta.pages ?? 1;
  const out: Paragraph[] = [center(label, true, 22)];
  for (let p = 0; p < pages; p++) {
    const png = await sharp(tiff, { page: p }).png().toBuffer();
    const m = await sharp(png).metadata();
    const width = 595;
    const height = Math.round(((m.height ?? 1) / (m.width ?? 1)) * width);
    if (p > 0) out.push(pageBreak());
    out.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: "png",
            data: png,
            transformation: { width, height },
          }),
        ],
      }),
    );
  }
  return out;
}

export async function bookToWord(
  title: string,
  blocks: readonly WordBlock[],
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  for (const [i, b] of blocks.entries()) {
    if (i > 0) children.push(pageBreak());
    if (b.kind === "term") children.push(...term(b.document));
    else if (b.kind === "table") children.push(...table(b.book));
    else if (b.kind === "fichas") children.push(...(await fichas(b.fichas)));
    else children.push(...(await image(b.tiff, b.label)));
  }
  const doc = new Document({
    creator: "Registro de Imóveis",
    title,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
