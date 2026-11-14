import "server-only";
import {
  type GuideReading,
  mergeReadings,
  readGuideText,
} from "@/core/guides/reading.ts";

/**
 * Reads the documents attached to a guia, in memory, to fill its fields
 * (decision of 14/11/2026). Nothing is stored here: the files that go with
 * the request travel in its own attachments field, under its own rules.
 * A PDF with text (searchable) is read; a scanned PDF or a photo has no
 * text to read, and the person is told so.
 */

export const READ_MAX_FILES = 5;
export const READ_MAX_BYTES = 15 * 1024 * 1024;

export interface GuideFilesReading {
  reading: GuideReading;
  /** One line per file, in plain words. */
  notes: string[];
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export async function readGuideFiles(
  files: File[],
): Promise<GuideFilesReading> {
  const notes: string[] = [];
  const readings: GuideReading[] = [];
  for (const file of files.slice(0, READ_MAX_FILES)) {
    const name = file.name || "arquivo";
    if (file.size > READ_MAX_BYTES) {
      notes.push(`${name}: maior que 15 MB, não foi lido.`);
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf = String.fromCharCode(...bytes.subarray(0, 4)) === "%PDF";
    if (!isPdf) {
      notes.push(
        `${name}: foto ou imagem não é lida. Envie o documento em PDF pesquisável para o sistema preencher; o arquivo segue anexado.`,
      );
      continue;
    }
    try {
      const text = await pdfText(bytes);
      if (text.replace(/\s+/g, "").length < 40) {
        notes.push(
          `${name}: PDF digitalizado, sem texto para ler. Envie em PDF pesquisável ou preencha os campos; o arquivo segue anexado.`,
        );
        continue;
      }
      const reading = readGuideText(text);
      readings.push(reading);
      const found = [
        reading.parties.length > 0 &&
          `${reading.parties.length} ${reading.parties.length === 1 ? "pessoa" : "pessoas"}`,
        reading.property.registration && "matrícula",
        reading.property.fiscalRegistration && "inscrição imobiliária",
        reading.property.description && "descrição do imóvel",
        reading.declaredValueCents && "valor",
      ].filter(Boolean);
      notes.push(
        found.length > 0
          ? `${name}: lido (${found.join(", ")}). Confira os campos preenchidos.`
          : `${name}: lido, mas sem os dados da guia (pessoas com CPF ou CNPJ, matrícula, imóvel ou valor).`,
      );
    } catch {
      notes.push(`${name}: não foi possível abrir este PDF.`);
    }
  }
  return { reading: mergeReadings(readings), notes };
}
