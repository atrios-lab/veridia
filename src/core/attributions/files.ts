/**
 * What a file sent to an attribution is, read from its first bytes and
 * never only from the name (decision of 14/11/2026: "em todos deixe o campo
 * de importar os arquivos"). Every file is kept as it came; this only names
 * it for the list, and tells the person what the panel can do with it.
 * Nothing here runs or opens the file.
 */

export interface FileKind {
  /** Short name for the list: "PDF", "XML", "Banco Access"... */
  label: string;
  /** One line for the person, in plain words. */
  note: string;
}

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

const starts = (bytes: Uint8Array, signature: number[]) =>
  signature.every((b, i) => bytes[i] === b);

/** The first element of an XML document, without the prolog and comments. */
export function xmlRoot(text: string): string {
  const body = text
    .replace(/^﻿/, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");
  return /<\s*([A-Za-z_][\w.:-]*)/.exec(body)?.[1] ?? "";
}

/** Text that a person or a system wrote, not binary. */
function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 2048);
  if (sample.length === 0) return false;
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) control += 1;
  }
  return control / sample.length < 0.02;
}

export function recognizeFile(bytes: Uint8Array, name: string): FileKind {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46])) {
    return { label: "PDF", note: "Documento em PDF, guardado para consulta." };
  }
  if (
    ascii(bytes, 4, 19) === "Standard Jet DB" ||
    ascii(bytes, 4, 19) === "Standard ACE DB"
  ) {
    return {
      label: "Banco Access",
      note: "Banco de dados do sistema da serventia, guardado como veio.",
    };
  }
  if (starts(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (["docx", "xlsx", "pptx", "odt", "ods"].includes(ext)) {
      return {
        label: ext.toUpperCase(),
        note: "Documento de escritório (modelo, planilha ou texto).",
      };
    }
    return { label: "ZIP", note: "Pacote compactado, guardado como veio." };
  }
  if (ascii(bytes, 0, 4) === "Rar!") {
    return { label: "RAR", note: "Pacote compactado, guardado como veio." };
  }
  if (starts(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
    return { label: "7Z", note: "Pacote compactado, guardado como veio." };
  }
  if (starts(bytes, [0x1f, 0x8b])) {
    return { label: "GZ", note: "Pacote compactado, guardado como veio." };
  }
  if (starts(bytes, [0xff, 0xd8, 0xff])) {
    return { label: "JPG", note: "Imagem (folha digitalizada ou foto)." };
  }
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    return { label: "PNG", note: "Imagem (folha digitalizada ou foto)." };
  }
  if (
    starts(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    starts(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return { label: "TIFF", note: "Imagem digitalizada (folha do livro)." };
  }
  if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
    return {
      label: ext ? ext.toUpperCase() : "Office antigo",
      note: "Documento do Office em formato antigo (doc, xls).",
    };
  }
  const head = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(0, 4096),
  );
  const trimmed = head.replace(/^﻿/, "").trimStart();
  if (trimmed.startsWith("{\\rtf")) {
    return {
      label: "RTF",
      note: "Texto formatado (modelo de ato ou certidão).",
    };
  }
  if (trimmed.startsWith("<")) {
    const root = xmlRoot(trimmed);
    return {
      label: "XML",
      note: root
        ? `Arquivo XML (elemento principal: ${root}), como os das centrais e do sistema da serventia.`
        : "Arquivo XML, como os das centrais e do sistema da serventia.",
    };
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return {
      label: "JSON",
      note: "Arquivo JSON (por exemplo, a importação da DOI à Receita Federal).",
    };
  }
  if (looksLikeText(bytes)) {
    const delimited = /[;,\t]/.test(trimmed.split(/\r?\n/)[0] ?? "");
    return delimited
      ? { label: "CSV", note: "Planilha em texto (colunas separadas)." }
      : {
          label: "Texto",
          note: "Arquivo de texto, como os de remessa e retorno.",
        };
  }
  return {
    label: ext ? ext.toUpperCase() : "Outro",
    note: "Formato que o painel ainda não lê: fica guardado como veio.",
  };
}

const UNITS = ["B", "KB", "MB", "GB"];

/** "1,5 MB" */
export function formatSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text =
    unit === 0
      ? String(value)
      : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${text} ${UNITS[unit]}`;
}
