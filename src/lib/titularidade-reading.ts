import "server-only";
import JSZip from "jszip";
import { readGuideText } from "@/core/guides/reading.ts";
import {
  actDateIn,
  addressIn,
  bookAndPageIn,
  doiIn,
  emptyTransfer,
  operationIn,
  type Service,
  type TitleTransfer,
  taxBaseIn,
} from "@/core/titularidade/titularidade.ts";
import { pdfText } from "./guide-reading.ts";

/**
 * Reads the escritura or the registro the office sends (decision of
 * 14/11/2026: "onde o tabelião envia a escritura ou o registro, o sistema
 * lê, pega os dados e cria a informação para a SEMUT"), in memory, and
 * fills a communication. A searchable PDF or a Word file (.docx) is read;
 * a scanned PDF or a photo has no text, and the person is told so.
 * Nothing is guessed: what the text does not say stays blank.
 */

export const TITLE_READ_MAX_BYTES = 15 * 1024 * 1024;

export async function docxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return xml
    .replace(/<w:br\s+w:type="page"\s*\/>/g, "\f")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export interface TitleReading {
  transfer: TitleTransfer;
  /** What was read, in plain words, or why nothing was. */
  note: string;
  /** Whether anything was taken from the file. */
  read: boolean;
}

/** The service the title is from, by its own words. */
function serviceIn(
  text: string,
  fallback: Service,
): Pick<TitleTransfer, "service" | "act"> {
  const head = text.slice(0, 2000);
  if (/\bescritura\b/i.test(head))
    return { service: "notas", act: "escritura" };
  if (
    /\b(?:R|AV)[-.\s]?\d+[-.\s]?(?:M[-.\s]?)?\d/i.test(head) ||
    /\bmatr[íi]cula\b.*\bregistr/i.test(head)
  ) {
    return {
      service: "ri",
      act: /\bAV[-.\s]?\d/i.test(head) ? "averbacao" : "registro",
    };
  }
  return {
    service: fallback,
    act: fallback === "notas" ? "escritura" : "registro",
  };
}

export async function readTitleFile(
  file: File,
  fallback: Service,
): Promise<TitleReading> {
  const name = file.name || "arquivo";
  const blank = { transfer: emptyTransfer(fallback), read: false };
  if (file.size > TITLE_READ_MAX_BYTES) {
    return { ...blank, note: `${name}: maior que 15 MB, não foi lido.` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  let text = "";
  try {
    if (head === "%PDF") text = await pdfText(bytes);
    else if (head.startsWith("PK")) text = await docxText(bytes);
    else {
      return {
        ...blank,
        note: `${name}: envie a escritura ou a certidão em PDF pesquisável ou em Word (.docx). Foto e PDF digitalizado não têm texto para ler.`,
      };
    }
  } catch {
    return { ...blank, note: `${name}: não foi possível abrir este arquivo.` };
  }
  if (text.replace(/\s+/g, "").length < 40) {
    return {
      ...blank,
      note: `${name}: sem texto para ler (PDF digitalizado). Preencha os campos à mão.`,
    };
  }
  return readTitleText(text, name, fallback);
}

/**
 * The same reading from text already extracted (the CENSEC's loads read
 * each act once and reuse it here: decision of 14/11/2026, "vai
 * aproveitando informações de outros").
 */
export function readTitleText(
  text: string,
  name: string,
  fallback: Service,
): TitleReading {
  const reading = readGuideText(text);
  const where = bookAndPageIn(text);
  const transfer: TitleTransfer = {
    ...emptyTransfer(fallback),
    ...serviceIn(text, fallback),
    actDate: actDateIn(text),
    book: where.book,
    page: where.page,
    operation: operationIn(text),
    destination: reading.property.type ?? "",
    matricula: reading.property.registration ?? "",
    fiscalRegistration: reading.property.fiscalRegistration ?? "",
    address: addressIn(text),
    description: (reading.property.description ?? "").slice(0, 1000),
    valueCents: reading.declaredValueCents ?? null,
    taxBaseCents: taxBaseIn(text),
    transmitentes: reading.parties
      .filter((p) => p.role === "transmitente")
      .map((p) => ({ name: p.name, taxId: p.taxId, share: "" })),
    adquirentes: reading.parties
      .filter((p) => p.role === "adquirente")
      .map((p) => ({ name: p.name, taxId: p.taxId, share: "" })),
  };
  transfer.doi = doiIn(text, transfer.operation);
  const unplaced = reading.parties.filter((p) => !p.role);
  if (unplaced.length > 0) {
    transfer.notes = `Pessoas lidas sem saber se transmitem ou adquirem (mova para o lado certo): ${unplaced
      .map((p) => `${p.name} (${p.taxId})`)
      .join("; ")}.`;
  }
  const found = [
    transfer.operation && "operação",
    transfer.actDate && "data",
    transfer.transmitentes.length && "transmitentes",
    transfer.adquirentes.length && "adquirentes",
    transfer.matricula && "matrícula",
    transfer.fiscalRegistration && "inscrição imobiliária",
    transfer.address && "endereço",
    transfer.valueCents !== null && "valor",
  ].filter(Boolean);
  return {
    transfer,
    read: found.length > 0,
    note:
      found.length > 0
        ? `${name}: lido (${found.join(", ")}). Confira cada campo antes de salvar.`
        : `${name}: lido, mas sem os dados da comunicação. Preencha à mão.`,
  };
}
