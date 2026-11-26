import "server-only";
import PDFDocument from "pdfkit";

/**
 * The books of the Registro de Imóveis drawn as the models annexed to the
 * Lei nº 6.015/1973 (decisions of 26/11/2026: "coloque o quadrado nos
 * livros como o modelo", "na matrícula tem que sair a ficha, no modelo da
 * 02"): a double frame; the head of the book in a box of its own; each
 * column with its title in a box and running down to the foot of the
 * folha. The ficha of the Livro 2 follows the office's own ficha (the one
 * it sends to the ONR), without the logos: Times 12, justified, the labels
 * in bold, "Página X de Y" under the frame and "Fl. 1v (continuação)" on
 * the back of each folha.
 *
 * - Livro 1, Protocolo: Nº de ordem · Data · Nome do apresentante ·
 *   Natureza formal do título · Anotações;
 * - Livro 3, Registro Auxiliar: Nº de ordem · Data · Registro · Ref. aos
 *   demais livros · Averbações;
 * - Livro 4, Indicador Real: Nº de ordem · Identificação do imóvel ·
 *   Referência aos demais livros · Anotações;
 * - Livro 5, Indicador Pessoal: Nº de ordem · Pessoas · Referência aos
 *   demais livros · Anotações.
 */

const A4: [number, number] = [595.28, 841.89];
/** The frame: 2 cm from the sides, 2,5 cm from the top, 2 cm from the foot. */
const FRAME = { left: 57, right: A4[0] - 45, top: 70, bottom: A4[1] - 62 };
const PAD = 10;

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
  /** "ANO: 2026". */
  year: string;
  columns: TableColumn[];
  rows: TableRow[];
  /** Under the frame of every folha. */
  footer: string;
}

export interface FichaPage {
  volume: string;
  /** The number of the ficha. */
  sheet: number;
  matricula: number;
  date: string;
  /** "IMÓVEL RURAL" or "IMÓVEL URBANO": the label of the identification. */
  identificationLabel?: string;
  identification: string;
  memorial?: string;
  owner: string;
  /** The owners before the current ones, with the ato that took them out. */
  previousOwners?: string;
  previous: string;
  acts: {
    label: string;
    text: string;
    /** The selo, as the office chose at printing. */
    seal?: string;
    sealImage?: Uint8Array;
  }[];
  /** "CNM 094615.2.0000001-07". */
  cnm: string;
  /** "09.461-5". */
  cns?: string;
  footer: string;
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

/** The double frame of the models. */
function frame(pdf: PDFKit.PDFDocument) {
  const { left, right, top, bottom } = FRAME;
  pdf.save().lineWidth(1.6).strokeColor("dimgray");
  pdf.rect(left, top, right - left, bottom - top).stroke();
  pdf.lineWidth(0.5);
  pdf.rect(left + 3, top + 3, right - left - 6, bottom - top - 6).stroke();
  pdf.restore();
}

/** Writes in the margin without pdfkit taking it as overflow. */
function inMargin(pdf: PDFKit.PDFDocument, draw: () => void) {
  const margins = { ...pdf.page.margins };
  const { x, y } = pdf;
  pdf.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  draw();
  pdf.page.margins = margins;
  pdf.x = x;
  pdf.y = y;
}

/** The table books (1, 3, 4 and 5), as the models of the law. */
export async function drawTableBook(book: TableBook): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: A4,
    margin: 0,
    autoFirstPage: false,
    bufferPages: true,
  });
  const inner = { left: FRAME.left + 7, right: FRAME.right - 7 };
  const width = inner.right - inner.left;
  const widths = book.columns.map((c) => c.width * width);
  const xs = widths.map((_, i) =>
    widths.slice(0, i).reduce((a, b) => a + b, inner.left),
  );
  const colBottom = FRAME.bottom - 7;
  let y = 0;

  const newPage = () => {
    pdf.addPage();
    frame(pdf);
    // The head of the book, in its own box.
    const headTop = FRAME.top + 7;
    pdf.font("Times-Bold").fontSize(12).fillColor("black");
    pdf.text("REGISTRO DE IMÓVEIS", inner.left, headTop + 10, {
      width,
      align: "center",
    });
    pdf.text(book.title, inner.left, pdf.y, { width, align: "center" });
    pdf.font("Times-Roman").fontSize(11);
    const line = pdf.y + 10;
    pdf.text(`Livro nº ${book.volume}`, inner.left + 18, line, {
      width: width / 2,
    });
    pdf.text(book.year, inner.left + width * 0.6, line, { width: width / 3 });
    const headBottom = pdf.y + 4;
    pdf.lineWidth(0.6).rect(inner.left, headTop, width, headBottom - headTop);
    pdf.stroke();
    // The titles of the columns, each in its box.
    const labelTop = headBottom + 4;
    pdf.font("Times-Roman").fontSize(9.5);
    const labelH =
      Math.max(
        ...book.columns.map((c, i) =>
          pdf.heightOfString(c.label, { width: (widths[i] ?? 0) - 6 }),
        ),
      ) + 10;
    book.columns.forEach((c, i) => {
      const x = (xs[i] ?? 0) + 1.5;
      const w = (widths[i] ?? 0) - 3;
      pdf.rect(x, labelTop, w, labelH).stroke();
      const h = pdf.heightOfString(c.label, { width: w - 6 });
      pdf.text(c.label, x + 3, labelTop + (labelH - h) / 2, {
        width: w - 6,
        align: "center",
      });
    });
    // The columns run down to the foot of the folha.
    const bodyTop = labelTop + labelH + 4;
    book.columns.forEach((_, i) => {
      pdf
        .rect(
          (xs[i] ?? 0) + 1.5,
          bodyTop,
          (widths[i] ?? 0) - 3,
          colBottom - bodyTop,
        )
        .stroke();
    });
    y = bodyTop + 5;
  };

  newPage();
  for (const row of book.rows) {
    if ("across" in row) {
      pdf.font(row.bold ? "Times-Bold" : "Times-Italic").fontSize(9.5);
      const h = pdf.heightOfString(row.across, { width: width - 16 }) + 8;
      if (y + h > colBottom - 4) newPage();
      // A line across the columns: the closing of the day (art. 184).
      pdf
        .save()
        .rect(inner.left + 2, y - 2, width - 4, h)
        .fill("white");
      pdf.restore();
      pdf
        .lineWidth(0.6)
        .moveTo(inner.left + 1.5, y - 2)
        .lineTo(inner.right - 1.5, y - 2)
        .moveTo(inner.left + 1.5, y + h - 2)
        .lineTo(inner.right - 1.5, y + h - 2)
        .stroke();
      pdf.text(row.across, inner.left + 8, y + 2, { width: width - 16 });
      y += h + 4;
      continue;
    }
    pdf.font("Times-Roman").fontSize(9.5);
    const h = Math.max(
      12,
      ...row.cells.map((cell, i) =>
        pdf.heightOfString(cell || " ", { width: (widths[i] ?? 0) - 10 }),
      ),
    );
    if (y + h > colBottom - 4) newPage();
    pdf.font("Times-Roman").fontSize(9.5);
    row.cells.forEach((cell, i) => {
      pdf.text(cell, (xs[i] ?? 0) + 5, y, { width: (widths[i] ?? 0) - 10 });
    });
    y += h + 6;
  }
  if (book.rows.length === 0) {
    pdf.font("Times-Italic").fontSize(10);
    pdf.text("Sem lançamentos no período.", inner.left + 10, y, { width });
  }
  const range = pdf.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    pdf.switchToPage(range.start + i);
    inMargin(pdf, () => {
      pdf.font("Times-Roman").fontSize(9).fillColor("black");
      pdf.text(
        `Página ${i + 1} de ${range.count} · ${book.footer}`,
        FRAME.left,
        FRAME.bottom + 12,
        { width: FRAME.right - FRAME.left, lineBreak: false },
      );
    });
  }
  return done(pdf);
}

/** "Label: value", the label in bold, placed by hand (left, right or centre). */
function pair(
  pdf: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  align: "left" | "right" | "center",
  valueBold = true,
) {
  pdf.fontSize(12).font("Times-Roman");
  const lw = pdf
    .font(valueBold ? "Times-Roman" : "Times-Bold")
    .widthOfString(label);
  const vw = pdf
    .font(valueBold ? "Times-Bold" : "Times-Roman")
    .widthOfString(value);
  const total = lw + vw;
  const start =
    align === "left"
      ? x
      : align === "right"
        ? x + width - total
        : x + (width - total) / 2;
  pdf.font(valueBold ? "Times-Roman" : "Times-Bold").text(label, start, y, {
    lineBreak: false,
  });
  pdf
    .font(valueBold ? "Times-Bold" : "Times-Roman")
    .text(value, start + lw, y, {
      lineBreak: false,
    });
}

const BODY = 12;
const GAP = 6; // 1,5 line spacing at 12 pt

/** The fichas of the Livro 2, as the office's ficha (the model of the law). */
export async function drawFichas(
  fichas: readonly FichaPage[],
  signer?: {
    name: string;
    title: string;
    image?: Uint8Array;
    place: string;
  } | null,
): Promise<Buffer> {
  const textLeft = FRAME.left + PAD + 4;
  const textRight = FRAME.right - PAD - 4;
  const width = textRight - textLeft;
  const pdf = new PDFDocument({
    size: A4,
    margins: {
      top: FRAME.top + PAD + 6,
      bottom: A4[1] - FRAME.bottom + PAD,
      left: textLeft,
      right: A4[0] - textRight,
    },
    autoFirstPage: false,
    bufferPages: true,
  });
  /** Pages of each ficha, to number them "Página X de Y" and "Fl. Nv". */
  const runs: { ficha: FichaPage; first: number }[] = [];
  let current: FichaPage | null = null;
  let firstPageOfFicha = true;

  pdf.on("pageAdded", () => {
    frame(pdf);
    if (!current) return;
    if (firstPageOfFicha) {
      firstPageOfFicha = false;
      return;
    }
    // The back of the folha, or the next one: room for its marker.
    pdf.y = FRAME.top + PAD + 22;
    pdf.x = textLeft;
  });

  const label = (title: string, text: string) => {
    pdf.font("Times-Bold").fontSize(BODY).text(`${title}: `, textLeft, pdf.y, {
      width,
      align: "justify",
      lineGap: GAP,
      continued: true,
    });
    pdf.font("Times-Roman").text(text || "Não consta.", {
      width,
      align: "justify",
      lineGap: GAP,
    });
    pdf.moveDown(0.6);
  };

  for (const f of fichas) {
    current = f;
    firstPageOfFicha = true;
    pdf.addPage();
    runs.push({ ficha: f, first: pdf.bufferedPageRange().count - 1 });
    // "REGISTRO DE IMÓVEIS" over the frame.
    inMargin(pdf, () => {
      pdf.font("Times-Bold").fontSize(12).fillColor("black");
      pdf.text("REGISTRO DE IMÓVEIS", 0, FRAME.top - 26, {
        width: A4[0],
        align: "center",
      });
    });
    // The head of the ficha.
    let y = FRAME.top + 14;
    pdf.font("Times-Bold").fontSize(12);
    pdf.text("REGISTRO DE IMÓVEIS", textLeft, y, { width, align: "center" });
    pdf.text("REGISTRO  GERAL", textLeft, pdf.y, { width, align: "center" });
    y = pdf.y + 18;
    pair(pdf, "Livro nº ", f.volume, textLeft, y, width, "left");
    pair(
      pdf,
      "FICHA: ",
      String(f.sheet).padStart(3, "0"),
      textLeft,
      y,
      width,
      "right",
    );
    y += 18;
    pdf
      .lineWidth(0.8)
      .moveTo(FRAME.left + 3, y)
      .lineTo(FRAME.right - 3, y)
      .stroke();
    y += 10;
    const number = String(f.matricula).padStart(3, "0");
    pair(pdf, "MATRÍCULA Nº ", number, textLeft, y, width, "left");
    pair(pdf, "DATA: ", f.date, textLeft, y, width, "right");
    y += 20;
    if (f.cns) {
      pair(pdf, "CNS: ", f.cns, textLeft, y, width, "center", false);
      y += 20;
    }
    if (f.cnm) {
      pair(
        pdf,
        "CNM: ",
        f.cnm.replace(/^CNM\s*/, ""),
        textLeft,
        y,
        width,
        "center",
        false,
      );
      y += 20;
    }
    pdf.x = textLeft;
    pdf.y = y + 6;
    label(f.identificationLabel ?? "IDENTIFICAÇÃO DO IMÓVEL", f.identification);
    label("MEMORIAL DESCRITIVO", f.memorial ?? "");
    label("NOME, DOMICÍLIO E NACIONALIDADE DOS PROPRIETÁRIOS ATUAIS", f.owner);
    if (f.previousOwners) {
      label(
        "NOME, DOMICÍLIO E NACIONALIDADE DOS PROPRIETÁRIOS ANTERIORES",
        f.previousOwners,
      );
    }
    label("NÚMERO DO REGISTRO ANTERIOR AO TRANSPORTE", f.previous);
    for (const act of f.acts) {
      pdf
        .font("Times-Bold")
        .fontSize(BODY)
        .text(`${act.label.replace(/\s*·\s*$/, "")} \u2013 `, textLeft, pdf.y, {
          width,
          align: "justify",
          lineGap: GAP,
          continued: true,
        });
      pdf.font("Times-Roman").text(act.text, {
        width,
        align: "justify",
        lineGap: GAP,
      });
      if (act.sealImage) {
        if (pdf.y + 70 > FRAME.bottom - PAD) pdf.addPage();
        const top = pdf.y + 4;
        pdf.image(
          Buffer.from(act.sealImage),
          textLeft + (width - 200) / 2,
          top,
          {
            fit: [200, 62],
            align: "center",
          },
        );
        pdf.y = top + 66;
      } else if (act.seal) {
        pdf.font("Times-Roman").fontSize(10).text(`Selo: ${act.seal}`, {
          width,
          align: "center",
        });
      }
      pdf.moveDown(0.6);
    }
    if (signer) {
      // Who signs the ficha (art. 210), centred.
      if (pdf.y + 120 > FRAME.bottom - PAD) pdf.addPage();
      pdf.moveDown(1);
      pdf
        .font("Times-Roman")
        .fontSize(BODY)
        .text(signer.place, textLeft, pdf.y, {
          width,
          align: "center",
        });
      const top = pdf.y + 6;
      if (signer.image) {
        pdf.image(Buffer.from(signer.image), textLeft + width / 2 - 90, top, {
          fit: [180, 46],
          align: "center",
        });
      }
      const rule = top + 50;
      pdf
        .lineWidth(0.6)
        .moveTo(textLeft + width / 2 - 120, rule)
        .lineTo(textLeft + width / 2 + 120, rule)
        .stroke();
      pdf.text(signer.name, textLeft, rule + 4, { width, align: "center" });
      pdf.fontSize(10).text(signer.title, { width, align: "center" });
    }
  }
  current = null;
  if (fichas.length === 0) {
    pdf.addPage();
    pdf
      .font("Times-Italic")
      .fontSize(12)
      .text("Nenhuma ficha neste intervalo.", textLeft, FRAME.top + 30);
  }

  // "Página X de Y" under the frame; "Fl. Nv (continuação)" on the back of
  // each folha and the ficha's number on the folhas after the first.
  const total = pdf.bufferedPageRange().count;
  runs.forEach((run, r) => {
    const end = runs[r + 1]?.first ?? total;
    const count = end - run.first;
    for (let i = 0; i < count; i++) {
      pdf.switchToPage(run.first + i);
      inMargin(pdf, () => {
        pdf.font("Times-Roman").fontSize(11).fillColor("black");
        pdf.text("Página ", FRAME.left, FRAME.bottom + 14, {
          continued: true,
          lineBreak: false,
        });
        pdf.font("Times-Bold").text(String(i + 1), { continued: true });
        pdf.font("Times-Roman").text(" de ", { continued: true });
        pdf.font("Times-Bold").text(String(count), { lineBreak: false });
        if (i > 0) {
          const folha = Math.floor(i / 2) + 1;
          const side = i % 2 === 1 ? `${folha}v` : String(folha);
          pdf.font("Times-Italic").fontSize(10);
          pdf.text(
            `Ficha ${String(run.ficha.sheet).padStart(3, "0")} · Matrícula nº ${String(run.ficha.matricula).padStart(3, "0")} · Fl. ${side} (continuação)`,
            FRAME.left + PAD,
            FRAME.top + PAD,
            {
              width: FRAME.right - FRAME.left - 2 * PAD,
              align: "right",
              lineBreak: false,
            },
          );
        }
      });
    }
  });
  return done(pdf);
}
