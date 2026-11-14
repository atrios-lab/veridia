import "server-only";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import MDBReader from "mdb-reader";
import { createExtractorFromData } from "node-unrar-js";
import { isCargaXml, readCargaXml } from "@/core/rcpn/carga-xml.ts";
import {
  CARTOSOFT_COLUMNS,
  readCartosoft,
  type Tables,
} from "@/core/rcpn/cartosoft.ts";
import { mergeSources, type RcpnRecord } from "@/core/rcpn/record.ts";

/**
 * Reads whatever the office sends (design, decisions 1 and 2): any file is
 * accepted; the format is told by its content, not its name; packages are
 * opened; what is not understood is reported, never refused and never
 * guessed. Nothing read here is executed: an Access file is parsed, a
 * `.sql` would be text, a package only listed and unpacked within limits.
 */

export interface Reading {
  /** What was recognised, for the import's list: "cartosoft-access"... */
  format: string;
  records: RcpnRecord[];
  /** One line per file: what was read, or why it was not. */
  notes: string[];
}

/** While reading: each source apart, joined at the end (mergeSources). */
interface Collecting extends Reading {
  fromXml: RcpnRecord[];
  fromAccess: RcpnRecord[];
}

/** A package that unpacks past this is left closed. */
const MAX_UNPACKED = 600 * 1024 * 1024;
const MAX_DEPTH = 3;
const MAX_FILES = 3000;

type Kind = "access" | "zip" | "rar" | "xml" | "lock" | "other";

function kindOf(bytes: Uint8Array, name: string): Kind {
  const head = Buffer.from(bytes.subarray(0, 32)).toString("latin1");
  if (
    head.slice(4, 19) === "Standard Jet DB" ||
    head.slice(4, 19) === "Standard ACE DB"
  ) {
    return "access";
  }
  if (head.startsWith("PK\u0003\u0004")) return "zip";
  if (head.startsWith("Rar!")) return "rar";
  const text = head.replace(/^﻿|^ï»¿/, "").trimStart();
  if (text.startsWith("<")) return "xml";
  if (/\.(ldb|laccdb)$/i.test(name)) return "lock";
  return "other";
}

/** UTF-8 when it is, else Windows-1252: the cargas say UTF-8 and are not. */
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function readAccess(bytes: Uint8Array, name: string, out: Collecting): void {
  let reader: MDBReader;
  try {
    reader = new MDBReader(Buffer.from(bytes));
  } catch {
    out.notes.push(
      `${name}: banco Access que não abriu (protegido por senha ou danificado). Guardado sem leitura.`,
    );
    return;
  }
  const names = new Set(reader.getTableNames());
  const tables: Tables = {};
  for (const [table, wanted] of Object.entries(CARTOSOFT_COLUMNS)) {
    if (!names.has(table)) continue;
    const t = reader.getTable(table);
    const present = new Set(t.getColumnNames());
    // Only the model's columns leave the file (decision 5).
    tables[table] = t.getData({
      columns: wanted.filter((c) => present.has(c)),
    });
  }
  const records = readCartosoft(tables);
  if (records.length === 0) {
    out.notes.push(
      `${name}: banco Access sem as tabelas de registro do Cartosoft (NASCIMENTO, CASAMENTO, OBITO). Guardado sem leitura.`,
    );
    return;
  }
  out.fromAccess.push(...records);
  out.notes.push(
    `${name}: banco do Cartosoft, ${records.length} registros lidos.`,
  );
  if (!out.format.includes("cartosoft-access"))
    out.format = join(out.format, "cartosoft-access");
}

function readXml(bytes: Uint8Array, name: string, out: Collecting): void {
  const text = decodeText(bytes).replace(/encoding="[^"]*"/i, "");
  let tree: unknown;
  try {
    tree = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
    }).parse(text);
  } catch {
    out.notes.push(`${name}: XML com erro de estrutura. Guardado sem leitura.`);
    return;
  }
  if (isCargaXml(tree)) {
    const { records, unknownMovements } = readCargaXml(tree);
    out.fromXml.push(...records);
    out.notes.push(`${name}: carga XML, ${records.length} registros lidos.`);
    if (unknownMovements.length > 0) {
      out.notes.push(
        `${name}: movimentos ainda não lidos pelo sistema (${unknownMovements.join(", ")}). Envie um exemplo para incluirmos.`,
      );
    }
    if (!out.format.includes("carga-xml"))
      out.format = join(out.format, "carga-xml");
    return;
  }
  const root =
    tree && typeof tree === "object"
      ? Object.keys(tree).find((k) => k !== "?xml")
      : undefined;
  const known: Record<string, string> = {
    certidao: "certidão on-line da CRC",
    edital_proclama: "edital de proclamas eletrônico (e-Proclamas)",
    InscricaoCPF: "inscrição de CPF",
  };
  out.notes.push(
    `${name}: ${known[root ?? ""] ?? `XML de leiaute ainda não conhecido (${root ?? "sem raiz"})`}. Guardado sem leitura para o índice.`,
  );
}

const join = (a: string, b: string) => (a ? `${a}+${b}` : b);

interface Budget {
  unpacked: number;
  files: number;
}

async function readAny(
  bytes: Uint8Array,
  name: string,
  out: Collecting,
  depth: number,
  budget: Budget,
): Promise<void> {
  budget.files++;
  if (budget.files > MAX_FILES) return;
  switch (kindOf(bytes, name)) {
    case "access":
      return readAccess(bytes, name, out);
    case "xml":
      return readXml(bytes, name, out);
    case "lock":
      out.notes.push(`${name}: arquivo de trava do Access, ignorado.`);
      return;
    case "zip":
    case "rar": {
      if (depth >= MAX_DEPTH) {
        out.notes.push(
          `${name}: pacote dentro de pacote demais. Guardado sem abrir.`,
        );
        return;
      }
      const entries = await unpack(bytes, name, out, budget);
      for (const entry of entries)
        await readAny(
          entry.bytes,
          `${name} › ${entry.name}`,
          out,
          depth + 1,
          budget,
        );
      return;
    }
    default:
      out.notes.push(`${name}: formato ainda não lido pelo sistema. Guardado.`);
  }
}

async function unpack(
  bytes: Uint8Array,
  name: string,
  out: Collecting,
  budget: Budget,
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const entries: { name: string; bytes: Uint8Array }[] = [];
  const add = (entryName: string, data: Uint8Array): boolean => {
    budget.unpacked += data.byteLength;
    if (budget.unpacked > MAX_UNPACKED) {
      out.notes.push(
        `${name}: o conteúdo passa de 600 MB descompactado. Parte do pacote não foi aberta.`,
      );
      return false;
    }
    entries.push({ name: entryName, bytes: data });
    return true;
  };
  try {
    if (kindOf(bytes, name) === "zip") {
      const zip = await JSZip.loadAsync(bytes);
      for (const file of Object.values(zip.files)) {
        if (file.dir) continue;
        if (!add(file.name, await file.async("uint8array"))) break;
      }
    } else {
      const extractor = await createExtractorFromData({
        data: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      });
      const { files } = extractor.extract();
      for (const file of files) {
        if (file.fileHeader.flags.directory || !file.extraction) continue;
        if (!add(file.fileHeader.name, file.extraction)) break;
      }
    }
  } catch {
    out.notes.push(
      `${name}: pacote que não abriu (protegido por senha ou danificado). Guardado sem abrir.`,
    );
  }
  return entries;
}

export async function readImportFile(
  bytes: Uint8Array,
  name: string,
): Promise<Reading> {
  const out: Collecting = {
    format: "",
    records: [],
    notes: [],
    fromXml: [],
    fromAccess: [],
  };
  await readAny(bytes, name, out, 0, { unpacked: 0, files: 0 });
  // The carga first: its book, folha and termo come from the matrícula,
  // the same way for every registro; the database fills the rest (avós,
  // testemunhas, declarante, anotações).
  out.records = mergeSources([out.fromXml, out.fromAccess]);
  const both = out.fromXml.length > 0 && out.fromAccess.length > 0;
  const joinedCount =
    out.fromXml.length + out.fromAccess.length - out.records.length;
  // A package of many cargas (one file per batch) reads as one line, by
  // kind; any other note stays as it is.
  const carga = /: carga XML, (\d+) registros lidos\.$/;
  const cargaNotes = out.notes.filter((n) => carga.test(n));
  if (cargaNotes.length > 3) {
    const count = (kind: string) =>
      out.records.filter((r) => r.kind === kind).length;
    const natimortos = out.records.filter(
      (r) => r.subtype === "natimorto",
    ).length;
    out.notes = [
      `${cargaNotes.length} arquivos de carga XML lidos: ${count("nascimento")} nascimentos, ${count("casamento")} casamentos e ${count("obito")} óbitos${natimortos ? ` (${natimortos} natimortos)` : ""}.`,
      ...out.notes.filter((n) => !carga.test(n)),
    ];
  }
  if (both) {
    out.notes.push(
      `${joinedCount} registros estavam na carga e no banco ao mesmo tempo: foram juntados pela matrícula, cada arquivo completando o que o outro não tinha.`,
    );
  }
  return { format: out.format, records: out.records, notes: out.notes };
}
