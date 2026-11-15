import "server-only";
import JSZip from "jszip";
import {
  cleanText,
  isOfficialUrl,
  textFromHtml,
  toMarkdown,
} from "@/core/conhecimento/base.ts";
import {
  AI_IMAGE_MAX_BYTES,
  AI_IMAGE_TYPES,
  AI_PDF_MAX_BYTES,
  type AiImageType,
} from "./ai.ts";
import { pdfText } from "./guide-reading.ts";
import { docxText } from "./titularidade-reading.ts";

/**
 * Reads what the office sends to the legal base (decision of 15/11/2026:
 * "após receber os PDF ou docs, seja qual tipo de arquivo, inclusive ZIP,
 * descarte o documento ficando apenas com as informações"): every file is
 * read in memory and dropped; only its text goes on, as Markdown ("ao
 * receber os documentos transforme eles em MD"). A ZIP is opened and each
 * file inside read the same way. Images and PDFs scanned as images are
 * read by the AI when it is on ("analise todos os documentos que chegar,
 * inclusive imagens").
 */

/** Reads an image or a scanned PDF into Markdown (lib/ai.ts). */
export type Transcriber = (input: {
  bytes: Uint8Array;
  mediaType: AiImageType | "application/pdf";
}) => Promise<string>;

export interface ReadOptions {
  /** Absent: the AI is off, and images are only noted. */
  transcribe?: Transcriber;
  /** Why the AI is off, said in the note of an image not read. */
  aiOff?: string;
}

export const KNOWLEDGE_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const KNOWLEDGE_TOTAL_MAX_BYTES = 100 * 1024 * 1024;
const ZIP_MAX_ENTRIES = 300;
const ZIP_MAX_UNPACKED = 300 * 1024 * 1024;

export interface ReadDocument {
  name: string;
  /** The document as Markdown. */
  markdown: string;
  /** Read by the AI (an image or a scanned PDF): to be checked. */
  viaAi: boolean;
}

export interface ReadReport {
  documents: ReadDocument[];
  /** What was not read, and why. */
  notes: string[];
}

/** Text in UTF-8, or Windows-1252 when it is not valid UTF-8. */
function decodeText(bytes: Uint8Array, charset?: string): string {
  if (charset && !/utf-?8/i.test(charset)) {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      // Falls to the guesses below.
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** An HTML page's own charset, when it declares one. */
function htmlCharset(bytes: Uint8Array): string | undefined {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  return /charset=["']?([\w-]+)/i.exec(head)?.[1];
}

function rtfText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) =>
      new TextDecoder("windows-1252").decode(
        new Uint8Array([Number.parseInt(hex, 16)]),
      ),
    )
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "");
}

async function odtText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) return "";
  return xml
    .replace(/<\/text:(p|h)>/g, "\n")
    .replace(/<text:tab\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** The file's name without the folder and the extension, as the title. */
const titleOf = (name: string) =>
  (name.split(/[/›]/).pop() ?? name).replace(/\.[a-z0-9]+$/i, "").trim();

const extension = (name: string) =>
  /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";

async function readBytes(
  name: string,
  bytes: Uint8Array,
  report: ReadReport,
  depth: number,
  options: ReadOptions,
): Promise<void> {
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  const ext = extension(name);
  const title = titleOf(name);
  const add = (text: string) =>
    report.documents.push({
      name,
      markdown: toMarkdown(text, title),
      viaAi: false,
    });
  const byAi = async (
    mediaType: AiImageType | "application/pdf",
    what: string,
  ): Promise<void> => {
    if (!options.transcribe) {
      report.notes.push(
        `${name}: ${what} só é lido pelo Assistente Virtual. ${options.aiOff ?? "O Assistente Virtual está desligado."}`,
      );
      return;
    }
    const max =
      mediaType === "application/pdf" ? AI_PDF_MAX_BYTES : AI_IMAGE_MAX_BYTES;
    if (bytes.length > max) {
      report.notes.push(
        `${name}: ${what} maior que ${max / 1024 / 1024} MB para o Assistente Virtual; reduza e envie de novo.`,
      );
      return;
    }
    try {
      const markdown = await options.transcribe({ bytes, mediaType });
      report.documents.push({
        name,
        markdown: cleanText(markdown),
        viaAi: true,
      });
    } catch (error) {
      report.notes.push(
        `${name}: ${error instanceof Error ? error.message : "o Assistente Virtual não leu este arquivo."}`,
      );
    }
  };
  try {
    if (head === "%PDF") {
      const text = await pdfText(bytes);
      if (text.replace(/\s+/g, "").length < 40) {
        await byAi("application/pdf", "PDF digitalizado (imagem)");
        return;
      }
      add(cleanText(text));
      return;
    }
    if (head.startsWith("PK")) {
      const zip = await JSZip.loadAsync(bytes);
      if (zip.file("word/document.xml")) {
        add(cleanText(await docxText(bytes)));
        return;
      }
      if (zip.file("content.xml")) {
        add(cleanText(await odtText(bytes)));
        return;
      }
      if (depth >= 2) {
        report.notes.push(
          `${name}: ZIP dentro de ZIP dentro de ZIP não é aberto.`,
        );
        return;
      }
      const entries = Object.values(zip.files).filter((f) => !f.dir);
      if (entries.length > ZIP_MAX_ENTRIES) {
        report.notes.push(
          `${name}: mais de ${ZIP_MAX_ENTRIES} arquivos no ZIP; divida em partes.`,
        );
        return;
      }
      let unpacked = 0;
      for (const entry of entries) {
        if (/(^|\/)(__MACOSX|\.)/.test(entry.name)) continue;
        const inner = await entry.async("uint8array");
        unpacked += inner.length;
        if (unpacked > ZIP_MAX_UNPACKED) {
          report.notes.push(
            `${name}: conteúdo grande demais depois de aberto; divida o ZIP.`,
          );
          return;
        }
        await readBytes(
          `${name} › ${entry.name}`,
          inner,
          report,
          depth + 1,
          options,
        );
      }
      return;
    }
    if (head.startsWith("{\\rt")) {
      add(cleanText(rtfText(decodeText(bytes))));
      return;
    }
    if (
      ["htm", "html", "xml"].includes(ext) ||
      /^\s*</.test(decodeText(bytes.subarray(0, 200)))
    ) {
      add(textFromHtml(decodeText(bytes, htmlCharset(bytes))));
      return;
    }
    if (ext === "md") {
      // Already Markdown: kept as written.
      report.documents.push({
        name,
        markdown: cleanText(decodeText(bytes)),
        viaAi: false,
      });
      return;
    }
    if (["txt", "csv", "text", ""].includes(ext)) {
      add(cleanText(decodeText(bytes)));
      return;
    }
    if (Object.hasOwn(AI_IMAGE_TYPES, ext)) {
      await byAi(AI_IMAGE_TYPES[ext as keyof typeof AI_IMAGE_TYPES], "imagem");
      return;
    }
    if (["tif", "tiff", "bmp", "heic", "heif"].includes(ext)) {
      report.notes.push(
        `${name}: imagem ${ext.toUpperCase()}; salve como JPG ou PNG e envie de novo.`,
      );
      return;
    }
    if (ext === "doc") {
      report.notes.push(
        `${name}: Word antigo (.doc); salve como .docx ou PDF e envie de novo.`,
      );
      return;
    }
    report.notes.push(`${name}: formato não lido (${ext || "sem extensão"}).`);
  } catch {
    report.notes.push(`${name}: não foi possível abrir este arquivo.`);
  }
}

/** The files sent: each one read and dropped; the text goes on. */
export async function readKnowledgeFiles(
  files: File[],
  options: ReadOptions = {},
): Promise<ReadReport> {
  const report: ReadReport = { documents: [], notes: [] };
  let total = 0;
  for (const file of files) {
    const name = file.name || "arquivo";
    total += file.size;
    if (file.size > KNOWLEDGE_FILE_MAX_BYTES) {
      report.notes.push(
        `${name}: maior que 50 MB; divida ou reduza o arquivo.`,
      );
      continue;
    }
    if (total > KNOWLEDGE_TOTAL_MAX_BYTES) {
      report.notes.push(
        `${name}: passou de 100 MB no envio; mande em outro envio.`,
      );
      continue;
    }
    await readBytes(
      name,
      new Uint8Array(await file.arrayBuffer()),
      report,
      0,
      options,
    );
  }
  report.documents = report.documents.filter((d) => {
    if (d.markdown.replace(/\s+/g, "").length >= 40) return true;
    report.notes.push(`${d.name}: sem texto para guardar.`);
    return false;
  });
  return report;
}

/**
 * The text in force of an official page (Planalto, CNJ, tribunais), read
 * on the server: only the official hosts; the struck-through passages are
 * left out. A PDF at the address is read too.
 */
export async function fetchOfficialText(url: string): Promise<string> {
  if (!isOfficialUrl(url)) {
    throw new Error(
      "Use o endereço oficial (Planalto, CNJ, tribunais) começando com https://.",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; base-juridica)" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`A fonte respondeu ${response.status}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > KNOWLEDGE_FILE_MAX_BYTES)
      throw new Error("Página grande demais.");
    if (String.fromCharCode(...bytes.subarray(0, 4)) === "%PDF") {
      return cleanText(await pdfText(bytes));
    }
    const type = response.headers.get("content-type") ?? "";
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? htmlCharset(bytes);
    return textFromHtml(decodeText(bytes, charset));
  } finally {
    clearTimeout(timer);
  }
}
