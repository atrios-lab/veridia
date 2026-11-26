import "server-only";
import JSZip from "jszip";
import { parseCsv } from "@/core/ri/sheet.ts";

/**
 * The office's index of matrículas as rows of text: a .csv (";" or ",",
 * UTF-8 or the Windows encoding Excel saves in) or an .xlsx (the first
 * sheet, each cell in its column, so an empty cell never shifts the
 * others).
 */

export class SheetFileError extends Error {}

const MAX_BYTES = 20 * 1024 * 1024;

function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // Many replacement characters: it was saved as Windows-1252.
  if ((utf8.match(/�/g)?.length ?? 0) > 2) {
    return new TextDecoder("windows-1252").decode(bytes);
  }
  return utf8;
}

/** "AB12" → 27 (zero-based column of the cell reference). */
function columnOf(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

const unescapeXml = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

/** Excel's serial date (days since 1899-12-30) → dd/mm/aaaa. */
function serialDate(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 80000) return value;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(date.getUTCDate())}/${p(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

async function xlsxRows(bytes: Uint8Array): Promise<string[][]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new SheetFileError("Não deu para abrir a planilha (.xlsx).");
  }
  const shared: string[] = [];
  const sst = await zip.file("xl/sharedStrings.xml")?.async("string");
  for (const si of sst?.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    shared.push(
      unescapeXml(
        (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [])
          .map((t) => t.replace(/<[^>]+>/g, ""))
          .join(""),
      ),
    );
  }
  // Which cell styles are dates (numFmt 14 to 22, or a custom with d/m/y).
  const styles = (await zip.file("xl/styles.xml")?.async("string")) ?? "";
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(
    /<numFmt [^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g,
  )) {
    custom.set(Number(m[1]), m[2] ?? "");
  }
  const xfs =
    /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/
      .exec(styles)?.[1]
      ?.match(/<xf [^>]*>/g) ?? [];
  const dateStyle = xfs.map((xf) => {
    const id = Number(/numFmtId="(\d+)"/.exec(xf)?.[1] ?? 0);
    return (id >= 14 && id <= 22) || /[dy]/i.test(custom.get(id) ?? "");
  });
  const sheetName =
    Object.keys(zip.files)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort((a, b) => Number(/\d+/.exec(a)) - Number(/\d+/.exec(b)))[0] ?? "";
  const xml = (await zip.file(sheetName)?.async("string")) ?? "";
  const rows: string[][] = [];
  for (const row of xml.match(/<row[\s\S]*?<\/row>/g) ?? []) {
    const cells: string[] = [];
    for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = /r="([A-Z]+)\d+"/.exec(c)?.[1];
      const col = ref ? columnOf(ref) : cells.length;
      const raw = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1] ?? "";
      const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c)?.[1];
      const style = Number(/ s="(\d+)"/.exec(c)?.[1] ?? -1);
      let value: string;
      if (/ t="s"/.test(c)) value = shared[Number(raw)] ?? "";
      else if (inline !== undefined) value = unescapeXml(inline);
      else if (style >= 0 && dateStyle[style]) value = serialDate(raw);
      else value = unescapeXml(raw);
      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/** The rows of an uploaded index (.csv or .xlsx). */
export async function sheetRows(file: File): Promise<string[][]> {
  if (!file || file.size === 0) {
    throw new SheetFileError("Escolha a planilha do índice.");
  }
  if (file.size > MAX_BYTES) {
    throw new SheetFileError("A planilha passa de 20 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".xlsx")) return xlsxRows(bytes);
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(decodeText(bytes));
  }
  throw new SheetFileError(
    'Envie a planilha em .xlsx ou .csv (no Excel ou no Google Planilhas: "Salvar como" ou "Fazer download").',
  );
}

// ---------------------------------------------------------------- writing

const xmlText = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // XML 1.0 does not take control characters (a stray one from Word).
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join("");

/** 0 → "A", 27 → "AB". */
function columnName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * A planilha .xlsx with one sheet: every cell as text (a CPF keeps its
 * leading zero, a number of matrícula is not turned into 1,23E+03), the
 * header in bold and frozen.
 */
export async function xlsxOf(
  rows: string[][],
  sheet = "Planilha",
): Promise<Uint8Array> {
  const zip = new JSZip();
  const name = xmlText(sheet.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
  zip.file(
    "xl/styles.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>',
  );
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const text = String(value ?? "");
          if (!text) return "";
          const style = r === 0 ? 1 : text.includes("\n") ? 2 : 0;
          return `<c r="${columnName(c)}${r + 1}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** A CSV the Excel in Portuguese opens right: ";", quotes, UTF-8 with BOM. */
export function csvOf(rows: string[][]): Uint8Array {
  const cell = (value: string) => {
    const text = String(value ?? "");
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const text = rows.map((row) => row.map(cell).join(";")).join("\r\n");
  return new TextEncoder().encode(`﻿${text}\r\n`);
}

export type TransferFile =
  | { type: "table"; rows: string[][]; label: string }
  | { type: "json"; value: unknown }
  | { type: "xml"; text: string };

/** Any file of the RI's import: planilha, JSON or XML of the ONR. */
export async function transferFile(file: {
  name: string;
  bytes: Uint8Array;
}): Promise<TransferFile> {
  const name = (file.name || "").toLowerCase();
  const head = new TextDecoder().decode(file.bytes.subarray(0, 200)).trim();
  if (name.endsWith(".xlsx") || head.startsWith("PK")) {
    return {
      type: "table",
      rows: await xlsxRows(file.bytes),
      label: "Planilha .xlsx",
    };
  }
  if (name.endsWith(".json") || /^﻿?[[{]/.test(head)) {
    try {
      return {
        type: "json",
        value: JSON.parse(decodeText(file.bytes).replace(/^﻿/, "")),
      };
    } catch {
      throw new SheetFileError(
        "O JSON está com erro de formato e não deu para ler.",
      );
    }
  }
  if (name.endsWith(".xml") || /^﻿?</.test(head)) {
    const latin = /encoding=["']iso-8859-1["']/i.test(head);
    const text = latin
      ? new TextDecoder("windows-1252").decode(file.bytes)
      : decodeText(file.bytes);
    return { type: "xml", text };
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return {
      type: "table",
      rows: parseCsv(decodeText(file.bytes)),
      label: "Planilha .csv",
    };
  }
  throw new SheetFileError(
    "Envie uma planilha (.xlsx ou .csv), um JSON (exportado aqui ou o Indicador Real da ONR) ou um XML da ONR (Indicador Pessoal ou lote de CNM).",
  );
}
