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
