import "server-only";
import type { CensecAct } from "@/core/censec/censec.ts";
import { readActText, splitActs } from "@/core/censec/reading.ts";
import { docxText } from "./titularidade-reading.ts";

/**
 * The files the office attaches for the CENSEC (decision of 14/11/2026):
 * as many as there are, or all the quinzena's acts joined in a single PDF.
 * Each one is read in memory, page by page, split into acts and read; the
 * file itself is never kept ("não precisa salvar o doc ou pdf ... para não
 * encher o banco").
 */

/** Each file: up to 50 MB; all together: up to 100 MB; up to 60 files. */
export const CENSEC_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const CENSEC_TOTAL_MAX_BYTES = 100 * 1024 * 1024;
export const CENSEC_MAX_FILES = 60;

export interface ReadAct {
  act: CensecAct;
  sourceName: string;
  /** The act's text, kept in memory only for the CTP and the DOI. */
  text: string;
  found: string[];
}

export interface FileReport {
  name: string;
  pages: number;
  acts: number;
  /** Why nothing was read, when nothing was. */
  note: string;
}

async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

/** A Word file: its explicit page breaks split it like a PDF's pages. */
async function docxPages(bytes: Uint8Array): Promise<string[]> {
  const text = await docxText(bytes);
  return text.split(/\f/).filter((p) => p.trim());
}

export async function readCensecFiles(
  files: File[],
): Promise<{ acts: ReadAct[]; reports: FileReport[] }> {
  const acts: ReadAct[] = [];
  const reports: FileReport[] = [];
  let total = 0;
  for (const file of files.slice(0, CENSEC_MAX_FILES)) {
    const name = file.name || "arquivo";
    total += file.size;
    if (file.size > CENSEC_FILE_MAX_BYTES) {
      reports.push({
        name,
        pages: 0,
        acts: 0,
        note: "maior que 50 MB: reduza o PDF e envie de novo.",
      });
      continue;
    }
    if (total > CENSEC_TOTAL_MAX_BYTES) {
      reports.push({
        name,
        pages: 0,
        acts: 0,
        note: "passou de 100 MB no envio: mande este em outro envio.",
      });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = String.fromCharCode(...bytes.subarray(0, 4));
    let pages: string[];
    try {
      if (head === "%PDF") pages = await pdfPages(bytes);
      else if (head.startsWith("PK")) pages = await docxPages(bytes);
      else {
        reports.push({
          name,
          pages: 0,
          acts: 0,
          note: "envie em PDF pesquisável ou em Word (.docx); foto não tem texto para ler.",
        });
        continue;
      }
    } catch {
      reports.push({
        name,
        pages: 0,
        acts: 0,
        note: "não foi possível abrir este arquivo.",
      });
      continue;
    }
    if (pages.join("").replace(/\s+/g, "").length < 40) {
      reports.push({
        name,
        pages: pages.length,
        acts: 0,
        note: "sem texto (PDF digitalizado como imagem): lance o ato à mão.",
      });
      continue;
    }
    const texts = splitActs(pages);
    for (const text of texts) {
      const { act, found } = readActText(text);
      acts.push({ act, sourceName: name, text, found });
    }
    reports.push({ name, pages: pages.length, acts: texts.length, note: "" });
  }
  for (const file of files.slice(CENSEC_MAX_FILES)) {
    reports.push({
      name: file.name,
      pages: 0,
      acts: 0,
      note: `passou de ${CENSEC_MAX_FILES} arquivos no envio: mande em outro envio.`,
    });
  }
  return { acts, reports };
}
