import {
  ACQUIRER_KINDS,
  type AcquirerKind,
  ForeignError,
  type ForeignInput,
  readForeignInput,
} from "./foreign.ts";
import { PROTOCOL_STATUS_LABELS, type ProtocolStatus } from "./protocol.ts";

/**
 * Bringing in the books the office already keeps (decision of 27/11/2026:
 * "importação e exportação do livro 1 e de todos os livros"). Each reader
 * takes the rows of a spreadsheet (the first row is the header, matched
 * by name, in any order) and says, line by line, what came in and what is
 * wrong. Nothing is overwritten: the caller skips what already exists.
 */

export interface Reading<T> {
  items: T[];
  errors: string[];
}

const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The index of the first header that starts with one of the names. */
function column(header: string[], ...names: string[]): number {
  const folded = header.map(fold);
  for (const name of names) {
    const i = folded.findIndex((h) => h.startsWith(fold(name)));
    if (i >= 0) return i;
  }
  return -1;
}

function isoOf(value: string): string | null {
  const v = value.trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  const iso = br
    ? `${br[3]}-${br[2]?.padStart(2, "0")}-${br[1]?.padStart(2, "0")}`
    : v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y &&
    at.getUTCMonth() === m - 1 &&
    at.getUTCDate() === d
    ? iso
    : null;
}

// ── Livro 1 (Protocolo) ─────────────────────────────────────────────────

export interface ProtocolImport {
  number: number;
  presentedOn: string;
  presenter: string;
  titleKind: string;
  acts: string;
  status: ProtocolStatus;
  voided: boolean;
}

/** The columns the Livro 1 is exported with (art. 175), and "Situação". */
export const PROTOCOL_IMPORT_COLUMNS = [
  "Nº de ordem",
  "Data",
  "Apresentante",
  "Natureza do título",
  "Atos (anotações)",
  "Situação",
];

/**
 * The Protocolo kept elsewhere. A título with atos is "registrado" unless
 * the Situação says otherwise; without atos, "cessado". The old book is
 * history: none of it starts the prazos again.
 */
export function readProtocolImport(
  rows: string[][],
  today: string,
): Reading<ProtocolImport> {
  const [header = [], ...body] = rows;
  const at = {
    number: column(header, "nº de ordem", "numero", "n "),
    date: column(header, "data"),
    presenter: column(header, "apresentante"),
    title: column(header, "natureza"),
    acts: column(header, "atos", "anotacoes"),
    status: column(header, "situacao"),
  };
  const errors: string[] = [];
  if (at.number < 0 || at.date < 0 || at.presenter < 0 || at.title < 0) {
    return {
      items: [],
      errors: [
        `A planilha precisa das colunas ${PROTOCOL_IMPORT_COLUMNS.slice(0, 4).join(", ")}.`,
      ],
    };
  }
  const seen = new Set<number>();
  const items: ProtocolImport[] = [];
  const statusByLabel = new Map(
    Object.entries(PROTOCOL_STATUS_LABELS).map(([k, label]) => [
      fold(label.split(":")[0] ?? label),
      k as ProtocolStatus,
    ]),
  );
  body.forEach((row, i) => {
    const line = i + 2;
    const cell = (j: number) => (j >= 0 ? String(row[j] ?? "").trim() : "");
    if (row.every((c) => !String(c ?? "").trim())) return;
    const number = Number(cell(at.number).replace(/\D/g, ""));
    if (!number) {
      errors.push(`Linha ${line}: sem o número de ordem.`);
      return;
    }
    if (seen.has(number)) {
      errors.push(`Linha ${line}: o nº ${number} se repete na planilha.`);
      return;
    }
    const presentedOn = isoOf(cell(at.date));
    if (!presentedOn || presentedOn > today) {
      errors.push(`Linha ${line}: data inválida (use dd/mm/aaaa).`);
      return;
    }
    const presenter = cell(at.presenter).slice(0, 300);
    const titleKind = cell(at.title).slice(0, 300);
    if (!presenter || !titleKind) {
      errors.push(`Linha ${line}: falta o apresentante ou a natureza.`);
      return;
    }
    const acts = cell(at.acts).slice(0, 2000);
    const voided =
      /anulad|engano/i.test(acts) || /anulad/i.test(cell(at.status));
    const named = statusByLabel.get(fold(cell(at.status)));
    seen.add(number);
    items.push({
      number,
      presentedOn,
      presenter,
      titleKind,
      acts: voided ? "" : acts,
      status: named ?? (acts && !voided ? "registrado" : "cessado"),
      voided,
    });
  });
  return { items, errors };
}

// ── Livro de Cadastro de Aquisição por Estrangeiro ──────────────────────

/** One column per field of the assento: the model to fill and import. */
export const FOREIGN_IMPORT_COLUMNS: { key: string; label: string }[] = [
  { key: "number", label: "Nº" },
  { key: "kind", label: "Ato (aquisição ou arrendamento)" },
  { key: "registeredOn", label: "Data do registro" },
  { key: "matricula", label: "Matrícula" },
  { key: "actRef", label: "Ato na matrícula" },
  {
    key: "acquirerKind",
    label: "Quem adquire (física, jurídica estrangeira ou equiparada)",
  },
  { key: "acquirerName", label: "Adquirente" },
  { key: "nationality", label: "Nacionalidade" },
  { key: "acquirerDocument", label: "Documento do adquirente" },
  { key: "spouseName", label: "Cônjuge brasileiro" },
  { key: "spouseCpf", label: "CPF do cônjuge" },
  { key: "transmitterName", label: "Transmitente" },
  { key: "transmitterDocument", label: "Documento do transmitente" },
  { key: "area", label: "Área (ha)" },
  { key: "municipality", label: "Município" },
  { key: "description", label: "Descrição do imóvel" },
  { key: "ccir", label: "CCIR" },
  { key: "securityArea", label: "Área de segurança nacional (sim ou não)" },
  { key: "authorityBody", label: "Órgão da autorização" },
  { key: "authorizationNumber", label: "Número da autorização" },
  { key: "authorizationDate", label: "Data da autorização" },
  { key: "notes", label: "Observações" },
];

function acquirerKindOf(value: string): AcquirerKind {
  const v = fold(value);
  if (v.includes("equipar") || v.includes("brasileir")) return "pj-equiparada";
  if (v.includes("juridic") || v.includes("pj")) return "pj-estrangeira";
  const exact = (Object.keys(ACQUIRER_KINDS) as AcquirerKind[]).find(
    (k) => k === value.trim(),
  );
  return exact ?? "pf-estrangeira";
}

export function readForeignImport(
  rows: string[][],
  today: string,
): Reading<ForeignInput & { number: number | null }> {
  const [header = [], ...body] = rows;
  const index = Object.fromEntries(
    FOREIGN_IMPORT_COLUMNS.map((c) => [
      c.key,
      column(header, c.label.split(" (")[0] ?? c.label),
    ]),
  ) as Record<string, number>;
  if ((index.acquirerName ?? -1) < 0 || (index.registeredOn ?? -1) < 0) {
    return {
      items: [],
      errors: [
        "Use o modelo de planilha do livro: faltam as colunas Adquirente e Data do registro.",
      ],
    };
  }
  const items: (ForeignInput & { number: number | null })[] = [];
  const errors: string[] = [];
  body.forEach((row, i) => {
    if (row.every((c) => !String(c ?? "").trim())) return;
    const raw: Record<string, unknown> = {};
    for (const c of FOREIGN_IMPORT_COLUMNS) {
      const j = index[c.key] ?? -1;
      raw[c.key] = j >= 0 ? String(row[j] ?? "").trim() : "";
    }
    raw.kind = /arrend/i.test(String(raw.kind)) ? "arrendamento" : "aquisicao";
    raw.acquirerKind = acquirerKindOf(String(raw.acquirerKind));
    raw.securityArea = /^(s|sim|x|true|1)/i.test(String(raw.securityArea))
      ? "on"
      : "";
    try {
      const input = readForeignInput(raw, today);
      const n = Number(String(raw.number).replace(/\D/g, ""));
      items.push({ ...input, number: n || null });
    } catch (error) {
      errors.push(
        `Linha ${i + 2}: ${error instanceof ForeignError ? error.message : "não foi possível ler."}`,
      );
    }
  });
  return { items, errors };
}
