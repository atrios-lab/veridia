import "server-only";
import PDFDocument from "pdfkit";

/**
 * The books of the Registro de Imóveis drawn as the models annexed to the
 * Lei nº 6.015/1973 (decision of 26/11/2026: "os livros devem seguir o
 * padrão da lei nos anexos, e não nesse modelo como ofício"). The models
 * are for paper up to 0,40 × 0,55 m (art. 3º, § 1º); here they are drawn on
 * A4 with the same header and the same columns.
 *
 * - Livro 1, Protocolo: Nº de ordem · Data · Nome do apresentante ·
 *   Natureza formal do título · Anotações;
 * - Livro 2, Registro Geral: the ficha (Livro nº 2, Fl., Matrícula nº,
 *   Data, Identificação do imóvel, Nome, domicílio e nacionalidade do
 *   proprietário, Número do registro anterior) and the atos;
 * - Livro 3, Registro Auxiliar: Nº de ordem · Data · Registro · Ref. aos
 *   demais livros · Averbações;
 * - Livro 4, Indicador Real: Nº de ordem · Identificação do imóvel ·
 *   Referência aos demais livros · Anotações;
 * - Livro 5, Indicador Pessoal: Nº de ordem · Pessoas · Referência aos
 *   demais livros · Anotações.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;
const WIDTH = A4[0] - 2 * MARGIN;
const BOTTOM = A4[1] - MARGIN - 14;

export interface TableColumn {
  label: string;
  /** Share of the width; they add up to 1. */
  width: number;
}

/** A row of the table, or a line across it (the closing of a day). */
export type TableRow = { cells: string[] } | { across: string; bold?: boolean };

export interface TableBook {
  /** "PROTOCOLO", "REGISTRO AUXILIAR"… */
  title: string;
  book: number;
  volume: string;
  /** "ANO: 2026" at the top right. */
  year: string;
  columns: TableColumn[];
  rows: TableRow[];
  /** At the foot of every page. */
  footer: string;
}

export interface FichaPage {
  volume: string;
  /** The number of the ficha (folha) in the book. */
  sheet: number;
  matricula: number;
  date: string;
  identification: string;
  owner: string;
  previous: string;
  acts: { label: string; text: string }[];
  /** "CNM 094615.2.0000001-07", top right of every page (CNN, art. 331). */
  cnm: string;
  footer: string;
}

function header(
  pdf: PDFKit.PDFDocument,
  title: string,
  left: string,
  right: string,
): number {
  let y = MARGIN;
  pdf.font("Times-Bold").fontSize(13);
  pdf.text("REGISTRO DE IMÓVEIS", MARGIN, y, { width: WIDTH, align: "center" });
  y += 17;
  pdf.text(title, MARGIN, y, { width: WIDTH, align: "center" });
  y += 22;
  pdf.font("Times-Roman").fontSize(10.5);
  pdf.text(left, MARGIN, y, { width: WIDTH / 2 });
  pdf.text(right, MARGIN + WIDTH / 2, y, { width: WIDTH / 2, align: "right" });
  return y + 18;
}

function foot(pdf: PDFKit.PDFDocument, text: string, page: number) {
  pdf.font("Times-Roman").fontSize(7.5).fillColor("gray");
  pdf.text(`${text} · página ${page}`, MARGIN, A4[1] - MARGIN + 6, {
    width: WIDTH,
    align: "center",
    lineBreak: false,
  });
  pdf.fillColor("black");
}

function done(pdf: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.end();
  });
}

/** The table books (1, 3, 4 and 5), the columns of the model. */
export async function drawTableBook(book: TableBook): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: A4,
    margin: MARGIN,
    autoFirstPage: false,
  });
  const widths = book.columns.map((c) => c.width * WIDTH);
  const xs = widths.map((_, i) =>
    widths.slice(0, i).reduce((a, b) => a + b, MARGIN),
  );
  let page = 0;
  let y = 0;
  const columnHeader = () => {
    pdf.font("Times-Bold").fontSize(8.5);
    const h =
      Math.max(
        ...book.columns.map((c, i) =>
          pdf.heightOfString(c.label, { width: (widths[i] ?? 0) - 6 }),
        ),
      ) + 8;
    book.columns.forEach((c, i) => {
      pdf.rect(xs[i] ?? MARGIN, y, widths[i] ?? 0, h).stroke();
      pdf.text(c.label, (xs[i] ?? MARGIN) + 3, y + 4, {
        width: (widths[i] ?? 0) - 6,
        align: "center",
      });
    });
    y += h;
  };
  const newPage = () => {
    pdf.addPage();
    page++;
    y = header(pdf, book.title, `Livro nº ${book.volume}`, book.year);
    columnHeader();
    foot(pdf, book.footer, page);
  };
  newPage();
  for (const row of book.rows) {
    pdf.font("Times-Roman").fontSize(9);
    if ("across" in row) {
      pdf.font(row.bold ? "Times-Bold" : "Times-Italic").fontSize(9);
      const h = pdf.heightOfString(row.across, { width: WIDTH - 8 }) + 8;
      if (y + h > BOTTOM) newPage();
      pdf.rect(MARGIN, y, WIDTH, h).stroke();
      pdf.text(row.across, MARGIN + 4, y + 4, { width: WIDTH - 8 });
      y += h;
      continue;
    }
    const h =
      Math.max(
        12,
        ...row.cells.map((cell, i) =>
          pdf.heightOfString(cell || " ", { width: (widths[i] ?? 0) - 6 }),
        ),
      ) + 8;
    if (y + h > BOTTOM) newPage();
    pdf.font("Times-Roman").fontSize(9);
    row.cells.forEach((cell, i) => {
      pdf.rect(xs[i] ?? MARGIN, y, widths[i] ?? 0, h).stroke();
      pdf.text(cell, (xs[i] ?? MARGIN) + 3, y + 4, {
        width: (widths[i] ?? 0) - 6,
      });
    });
    y += h;
  }
  if (book.rows.length === 0) {
    pdf.font("Times-Italic").fontSize(9);
    pdf.text("Sem lançamentos no período.", MARGIN, y + 8, { width: WIDTH });
  }
  return done(pdf);
}

/** The fichas of the Livro 2, each as the model of the law. */
export async function drawFichas(
  fichas: readonly FichaPage[],
  signer?: {
    name: string;
    title: string;
    image?: Uint8Array;
    place: string;
  } | null,
): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: A4,
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN + 16 },
    autoFirstPage: false,
  });
  let page = 0;
  let current: FichaPage | null = null;
  let continued = false;
  // Every page of a ficha opens with the header of the model, also when
  // a long ato flows onto the next page by itself.
  pdf.on("pageAdded", () => {
    const f = current;
    if (!f) return;
    page++;
    let y = header(
      pdf,
      "REGISTRO GERAL",
      `Livro nº ${f.volume}`,
      `Fl.: ${f.sheet}${continued ? " (continuação)" : ""}`,
    );
    if (f.cnm) {
      pdf.font("Times-Roman").fontSize(8.5);
      pdf.text(f.cnm, MARGIN, MARGIN - 14, { width: WIDTH, align: "right" });
    }
    pdf.font("Times-Bold").fontSize(10.5);
    pdf.text(`MATRÍCULA Nº ${f.matricula.toLocaleString("pt-BR")}`, MARGIN, y, {
      width: WIDTH / 2,
    });
    pdf.text(`Data: ${f.date}`, MARGIN + WIDTH / 2, y, {
      width: WIDTH / 2,
      align: "right",
    });
    y += 16;
    pdf
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + WIDTH, y)
      .stroke();
    foot(pdf, f.footer, page);
    continued = true;
    pdf.font("Times-Roman").fontSize(10);
    pdf.x = MARGIN;
    pdf.y = y + 8;
  });
  for (const f of fichas) {
    current = f;
    continued = false;
    pdf.addPage();
    const field = (label: string, text: string) => {
      pdf.font("Times-Bold").fontSize(10).text(`${label}:`, MARGIN, pdf.y, {
        width: WIDTH,
      });
      pdf
        .font("Times-Roman")
        .fontSize(10)
        .text(text || "não consta", {
          width: WIDTH,
          align: "justify",
        });
      pdf.moveDown(0.6);
    };
    field("IDENTIFICAÇÃO DO IMÓVEL", f.identification);
    field("NOME, DOMICÍLIO E NACIONALIDADE DO PROPRIETÁRIO", f.owner);
    field("NÚMERO DO REGISTRO ANTERIOR", f.previous);
    pdf
      .moveTo(MARGIN, pdf.y)
      .lineTo(MARGIN + WIDTH, pdf.y)
      .stroke();
    pdf.moveDown(0.6);
    for (const act of f.acts) {
      pdf.font("Times-Bold").fontSize(10).text(act.label, MARGIN, pdf.y, {
        width: WIDTH,
        continued: true,
      });
      pdf.font("Times-Roman").text(` ${act.text}`, {
        width: WIDTH,
        align: "justify",
      });
      pdf.moveDown(0.6);
    }
  }
  if (signer && fichas.length) {
    // Who signs the ficha (Lei nº 6.015/1973, art. 210).
    if (pdf.y + 110 > A4[1] - MARGIN - 16) pdf.addPage();
    pdf.moveDown(1);
    pdf.font("Times-Roman").fontSize(10).text(signer.place, MARGIN, pdf.y, {
      width: WIDTH,
      align: "center",
    });
    const top = pdf.y + 8;
    if (signer.image) {
      pdf.image(Buffer.from(signer.image), A4[0] / 2 - 90, top, {
        fit: [180, 46],
        align: "center",
      });
    }
    const rule = top + 50;
    pdf
      .moveTo(A4[0] / 2 - 120, rule)
      .lineTo(A4[0] / 2 + 120, rule)
      .stroke();
    pdf.text(signer.name, MARGIN, rule + 4, { width: WIDTH, align: "center" });
    pdf.fontSize(9).text(signer.title, { width: WIDTH, align: "center" });
  }
  current = null;
  if (fichas.length === 0) {
    pdf.addPage();
    header(pdf, "REGISTRO GERAL", "Livro nº 2", "");
    pdf
      .font("Times-Italic")
      .fontSize(10)
      .text("Nenhuma ficha neste intervalo.");
  }
  return done(pdf);
}
