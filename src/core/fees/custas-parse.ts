import type { FeeBlock, FeeRow, FeeTableData, FeeTableMeta } from "./custas.ts";

/**
 * Reads a tabela de custas drawn in the office's standard (the PDF the
 * assistant also produces): cover, summary, presentation, then the tables,
 * each row a code, a description and seven amounts, the groups of rows
 * under their caption, and the notas explicativas after each table.
 *
 * It works on lines with positions, not on bare text: a description that
 * wraps sits above and below its row, and only its distance to the row and
 * its column tell it apart from a group caption.
 */

export interface PdfPiece {
  x: number;
  /** Where the piece ends, to know whether the next one is a new word. */
  end: number;
  text: string;
}

export interface PdfLine {
  page: number;
  /** Top-down: a larger y is lower on the page. */
  y: number;
  pieces: PdfPiece[];
}

const MONEY = /R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g;
const CODE = /^\d{7,9}$/;

function lineText(line: PdfLine): string {
  let out = "";
  let lastEnd = Number.NEGATIVE_INFINITY;
  for (const piece of [...line.pieces].sort((a, b) => a.x - b.x)) {
    if (out && piece.x - lastEnd > 0.8) out += " ";
    out += piece.text;
    lastEnd = piece.end;
  }
  return out.replace(/\s+/g, " ").trim();
}

function firstX(line: PdfLine): number {
  return Math.min(...line.pieces.map((p) => p.x));
}

function cents(money: string): number {
  const digits = money.replace(/[^\d,]/g, "");
  const [reais = "0", c = "0"] = digits.split(",");
  return Number(reais) * 100 + Number(c.padEnd(2, "0"));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** The running header, the column header, the footer and the page number. */
function isChrome(text: string): boolean {
  return (
    /^TABELA DE CUSTAS E EMOLUMENTOS .*:/.test(text) ||
    /^[^·]+ · valores com ISS de \d/i.test(text) ||
    /^Fonte:/.test(text) ||
    /^Valores com ISS de \d+%$/.test(text) ||
    /^C[óo]digo\s+Discrimina/.test(text) ||
    /^\d{1,3}$/.test(text)
  );
}

const HEADING_1 = /^TABELA [IVXL]+\s*:/;
const HEADING_2 = /^TABELA [A-Z]?-?[IVXL]+(?:-[A-Z])?$/;
const HEADING_3 = /^[A-Z]\)\s/;

export interface ParseResult {
  data: FeeTableData;
  warnings: string[];
}

export function parseFeeTable(lines: PdfLine[]): ParseResult {
  const warnings: string[] = [];
  const all = lines
    .filter((l) => l.pieces.length > 0)
    .map((l) => ({ line: l, text: lineText(l) }))
    .filter((l) => l.text);

  // Where the tables start: the first "TABELA I:" that is not a summary
  // entry (those trail dots and a page number).
  const start = all.findIndex(
    (l) => HEADING_1.test(l.text) && !/\.{4,}/.test(l.text),
  );
  if (start < 0) {
    return {
      data: { meta: emptyMeta(), blocks: [] },
      warnings: ["Não achei o começo das tabelas (TABELA I)."],
    };
  }
  const front = all.slice(0, start);
  const body = all.slice(start);
  const meta = readMeta(front, all);

  // Columns: where codes start and where descriptions start.
  const rowLines = body.filter((l) => (l.text.match(MONEY) ?? []).length >= 7);
  const codeX = median(
    rowLines
      .filter((l) => CODE.test(l.text.split(" ")[0] ?? ""))
      .map((l) => firstX(l.line)),
  );
  const descX = median(
    rowLines.flatMap((l) => {
      const sorted = [...l.line.pieces].sort((a, b) => a.x - b.x);
      const second = sorted.find(
        (p) => p.x > codeX + 15 && !/^R\$|^\d/.test(p.text),
      );
      return second ? [second.x] : [];
    }),
  );

  const blocks: FeeBlock[] = [];
  let inNotes = false;
  // Notes are indented further than group captions and headings: a line
  // that starts left of them ends the notes.
  let notesX = 0;
  let headingX = Number.NaN;
  let lastWasGroup = false;
  // Per page: the rows drawn on it and the loose description lines.
  type PageRow = {
    y: number;
    row: FeeRow;
    inline: string;
    parts: { y: number; text: string }[];
  };
  let pageRows: PageRow[] = [];
  let pageFragments: { y: number; text: string }[] = [];
  let page = -1;

  const flushPage = () => {
    // A cell's text is centred on its row: as many wrapped lines below the
    // row's own line as above it. Walking down the page, the lines after a
    // row go back to it until it has as many below as above; the rest are
    // the next row's lines above.
    const items = [
      ...pageRows.map((r) => ({
        y: r.y,
        row: r as PageRow | undefined,
        text: "",
      })),
      ...pageFragments.map((f) => ({ y: f.y, row: undefined, text: f.text })),
    ].sort((a, b) => a.y - b.y);
    let previous: { row: PageRow; above: number; below: number } | undefined;
    let pending: { y: number; text: string }[] = [];
    for (const item of items) {
      if (item.row) {
        item.row.parts.push(...pending);
        previous = { row: item.row, above: pending.length, below: 0 };
        pending = [];
        continue;
      }
      if (previous && previous.below < previous.above) {
        previous.row.parts.push({ y: item.y, text: item.text });
        previous.below += 1;
      } else {
        pending.push({ y: item.y, text: item.text });
      }
    }
    if (pending.length > 0) {
      if (previous) previous.row.parts.push(...pending);
      else
        for (const f of pending)
          warnings.push(`Texto sem linha na página ${page}: "${f.text}"`);
    }
    for (const r of pageRows) {
      const parts = [
        ...r.parts,
        ...(r.inline ? [{ y: r.y, text: r.inline }] : []),
      ].sort((a, b) => a.y - b.y);
      r.row.description = parts
        .map((p) => p.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
    pageRows = [];
    pageFragments = [];
  };

  for (const { line, text } of body) {
    if (line.page !== page) {
      flushPage();
      page = line.page;
    }
    if (isChrome(text)) continue;
    const money = text.match(MONEY) ?? [];
    const x = firstX(line);

    if (HEADING_1.test(text)) {
      blocks.push({ kind: "heading", level: 1, text });
      inNotes = false;
      headingX = x;
      lastWasGroup = false;
      continue;
    }
    if (HEADING_2.test(text) && money.length === 0) {
      blocks.push({ kind: "heading", level: 2, text });
      inNotes = false;
      headingX = x;
      lastWasGroup = false;
      continue;
    }
    if (/^NOTAS EXPLICATIVAS$/.test(text)) {
      blocks.push({ kind: "notes", items: [] });
      inNotes = true;
      notesX = x;
      lastWasGroup = false;
      continue;
    }
    if (money.length >= 7) {
      inNotes = false;
      lastWasGroup = false;
      const values = money.slice(-7).map(cents);
      // The description may itself hold amounts ("De R$ 0,01 a R$ 50,00"):
      // the columns are the last seven, the description is all before them.
      const matches = [...text.matchAll(MONEY)];
      const firstColumn = matches[matches.length - 7]?.index ?? 0;
      const head = text.slice(0, firstColumn).trim();
      const [first = "", ...rest] = head.split(" ");
      const code = CODE.test(first) ? first : "";
      const inline = (code ? rest.join(" ") : head).trim();
      const row: FeeRow = {
        code,
        description: inline,
        cents: {
          emolumentos: values[0] ?? 0,
          fdj: values[1] ?? 0,
          frmp: values[2] ?? 0,
          fcrcpn: values[3] ?? 0,
          iss: values[4] ?? 0,
          funaf: values[5] ?? 0,
          total: values[6] ?? 0,
        },
      };
      if (!code) warnings.push(`Linha sem código: "${text.slice(0, 80)}"`);
      blocks.push({ kind: "row", row });
      pageRows.push({ y: line.y, row, inline, parts: [] });
      continue;
    }
    if (inNotes && x < notesX - 3) inNotes = false;
    if (inNotes) {
      const notes = blocks.at(-1);
      if (notes?.kind === "notes") {
        if (/^\d+\.\s/.test(text) || notes.items.length === 0) {
          notes.items.push(text);
        } else {
          notes.items[notes.items.length - 1] += ` ${text}`;
        }
        continue;
      }
    }
    if (HEADING_3.test(text)) {
      blocks.push({ kind: "heading", level: 3, text });
      headingX = x;
      lastWasGroup = false;
      continue;
    }
    const previous = blocks.at(-1);
    if (
      previous?.kind === "heading" &&
      previous.level === 3 &&
      Math.abs(x - headingX) < 3 &&
      text === text.toUpperCase()
    ) {
      previous.text += ` ${text}`;
      continue;
    }
    if (descX && x >= descX - 4) {
      pageFragments.push({ y: line.y, text });
      lastWasGroup = false;
      continue;
    }
    if (lastWasGroup && previous?.kind === "group") {
      previous.text += ` ${text}`;
    } else {
      blocks.push({ kind: "group", text });
    }
    lastWasGroup = true;
  }
  flushPage();
  return { data: { meta, blocks }, warnings };
}

function emptyMeta(): FeeTableMeta {
  return {
    title: "",
    subtitle: "",
    source: "",
    validity: "",
    issuer: "",
    footer: "",
    region: "",
    city: "",
    year: "",
    issBasisPoints: 500,
    presentation: [],
  };
}

type Entry = { line: PdfLine; text: string };

function readMeta(front: Entry[], all: Entry[]): FeeTableMeta {
  const meta = emptyMeta();
  const cover = front.filter((e) => e.line.page === front[0]?.line.page);
  meta.issuer = cover[0]?.text ?? "";
  const titleAt = cover.findIndex((e) =>
    /^TABELA DE CUSTAS E EMOLUMENTOS/.test(e.text),
  );
  if (titleAt >= 0) {
    meta.title = cover[titleAt]?.text ?? "";
    meta.subtitle = cover[titleAt + 1]?.text ?? "";
  }
  meta.source = cover.find((e) => /^Anexo/.test(e.text))?.text ?? "";
  meta.validity = cover.find((e) => /Vig[êe]ncia/.test(e.text))?.text ?? "";
  const iss = all
    .map((e) => /ISS de (\d+(?:,\d+)?)%/.exec(e.text)?.[1])
    .find(Boolean);
  if (iss)
    meta.issBasisPoints = Math.round(Number(iss.replace(",", ".")) * 100);
  const yearAt = cover.findIndex((e) => /^\d{4}$/.test(e.text));
  if (yearAt > 0) {
    meta.year = cover[yearAt]?.text ?? "";
    meta.city = cover[yearAt - 1]?.text ?? "";
  }
  const footer = all.find((e) => /^Fonte:/.test(e.text))?.text ?? "";
  meta.footer = footer.replace(/\s*Valores com ISS de \d+(?:,\d+)?%\s*$/, "");
  const header = all.find((e) =>
    /^[^·]+ · valores com ISS de \d/i.test(e.text),
  );
  meta.region = header?.text.split(" · ")[0] ?? "";

  // The presentation: from its heading to the end of the front matter,
  // a new paragraph where a line starts indented.
  const at = front.findIndex((e) => /^APRESENTA[ÇC][ÃA]O$/.test(e.text));
  if (at >= 0) {
    const lines = front.slice(at + 1).filter((e) => !isChrome(e.text));
    // The heading sits at the margin, like the lines that continue a
    // paragraph; a paragraph's first line is indented from it.
    const base = firstX((front[at] as Entry).line);
    for (const e of lines) {
      const indented = firstX(e.line) > base + 8;
      if (indented || meta.presentation.length === 0) {
        meta.presentation.push(e.text);
      } else {
        meta.presentation[meta.presentation.length - 1] += ` ${e.text}`;
      }
    }
  }
  return meta;
}
