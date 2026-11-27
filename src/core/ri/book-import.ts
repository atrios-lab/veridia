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
  /** The "Livro" column, when the spreadsheet has it ("1", "1-B"…). */
  volume?: string;
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

const MONTHS: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

/**
 * The dates an old Protocolo is typed with: dd/mm/aaaa, dd-mm-aaaa,
 * dd-mm-aa (19aa when past this year's two digits) and dd-mês-aaaa.
 */
export function protocolDate(value: string, today: string): string | null {
  // The first date of the cell, without notes: "13-09-81 [sic]", "30-08-82 / 03-09-82".
  const first =
    value.replace(/\[[\s\S]*?\]/g, " ").split(/\s+\/\s+|\s+e\s+/)[0] ?? "";
  const v = fold(first).replace(/[\s/.]+/g, "-");
  const m = /^(\d{1,2})-([a-z]+|\d{1,2})-(\d{2,4})$/.exec(v);
  if (!m) return isoOf(first);
  const [, d = "", mo = "", y = ""] = m;
  const month = /^\d+$/.test(mo)
    ? mo.padStart(2, "0")
    : (MONTHS[mo] ??
      Object.entries(MONTHS).find(
        ([name]) => mo.length >= 3 && name.startsWith(mo),
      )?.[1]);
  if (!month) return null;
  let year = y;
  if (y.length < 4) {
    // "81" is 1981; "003" and "03" are 2003 (past this year: 19..).
    const n = Number(y);
    const cut = Number(today.slice(2, 4));
    year = String(n > cut && y.length === 2 ? 1900 + n : 2000 + n);
  }
  return isoOf(`${d.padStart(2, "0")}/${month}/${year}`);
}

/** "1.234", "104 [sic - repetido]", "1.234-A": the number, its letter, the note. */
export function protocolNumber(value: string): {
  number: number;
  suffix: string;
  note: string;
} | null {
  const note = /\[([\s\S]*)\]/.exec(value)?.[1]?.trim() ?? "";
  const head = value.replace(/\[[\s\S]*\]/, "").trim();
  const m = /^(\d{1,3}(?:\.\d{3})*|\d+)\s*-?\s*([A-Za-z])?$/.exec(head);
  if (!m?.[1]) return null;
  const number = Number(m[1].replace(/\./g, ""));
  return number ? { number, suffix: (m[2] ?? "").toUpperCase(), note } : null;
}

const ILLEGIBLE =
  /ilegivel|nao lido|nao encontrado|incert|rasurad|nao legivel|duvidos/;

/**
 * Every number missing between 1 and the last one of the book becomes a
 * "Protocolo não utilizado (cancelado)", dated with the número before it
 * (decision of 27/11/2026: "preencha como sendo protocolo não usado e
 * cancelado"). A number already in the system is never touched.
 */
export function fillGaps(items: ProtocolImport[]): ProtocolImport[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.number - b.number);
  const have = new Set(sorted.map((i) => i.number));
  const last = sorted[sorted.length - 1]?.number ?? 0;
  const out: ProtocolImport[] = [];
  let prev = sorted[0] as ProtocolImport;
  let k = 0;
  for (let n = 1; n <= last; n++) {
    while (k < sorted.length && (sorted[k]?.number ?? 0) < n) {
      prev = sorted[k] as ProtocolImport;
      k++;
    }
    if (have.has(n)) continue;
    const before = sorted[k - 1] ?? prev;
    out.push({
      number: n,
      presentedOn: before.presentedOn,
      presenter: "Não consta",
      titleKind: "Protocolo não utilizado (cancelado)",
      acts: "Número sem lançamento no livro original: considerado não utilizado e cancelado na migração. Data do lançamento anterior.",
      status: "cessado",
      voided: true,
    });
  }
  return out;
}

const CANCELLED =
  /cancelad|anulad|sem lancamento|nao consta|nao constam|lacuna|omissao|riscad/;

/**
 * The Protocolo kept elsewhere, as the office typed it. The old book is
 * history: none of it starts the prazos again. What the book has twice
 * (a repeated number, a number with letter) goes into the anotações of the
 * first, so nothing is lost; a cancelled number or a gap comes in voided,
 * dated with the line before it when it has no date of its own.
 */
export function readProtocolImport(
  rows: string[][],
  today: string,
): Reading<ProtocolImport> & { merged: number; blank: number; gaps: number } {
  const [header = [], ...body] = rows;
  const at = {
    number: column(header, "nº de ordem", "numero de ordem", "numero", "n "),
    date: column(header, "data"),
    presenter: column(header, "apresentante", "nome do apresentante"),
    title: column(header, "natureza"),
    acts: column(header, "atos", "anotacoes", "anotacao"),
    status: column(header, "situacao"),
    volume: column(header, "livro"),
  };
  if (at.number < 0 || at.date < 0 || at.presenter < 0 || at.title < 0) {
    return {
      items: [],
      merged: 0,
      blank: 0,
      gaps: 0,
      errors: [
        `A planilha precisa das colunas ${PROTOCOL_IMPORT_COLUMNS.slice(0, 4).join(", ")}.`,
      ],
    };
  }
  const errors: string[] = [];
  const byNumber = new Map<number, ProtocolImport>();
  const items: ProtocolImport[] = [];
  let merged = 0;
  let blank = 0;
  let lastDate: string | null = null;
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
    const parsed = protocolNumber(cell(at.number));
    if (!parsed) {
      // A blank line of the book ("[EM BRANCO]") is not a título: skipped.
      if (/em branco|\[\s*\]/i.test(cell(at.number))) {
        blank++;
        return;
      }
      errors.push(
        `Linha ${line}: número de ordem "${cell(at.number)}" ilegível; corrija na planilha e importe de novo (o que já entrou fica como está).`,
      );
      return;
    }
    const presenter = cell(at.presenter).slice(0, 300);
    const titleKind = cell(at.title).slice(0, 300);
    const annotations = cell(at.acts);
    const text = fold(
      `${presenter} ${titleKind} ${annotations} ${parsed.note}`,
    );
    const voided = CANCELLED.test(text) || /anulad/.test(fold(cell(at.status)));
    const typedDate = cell(at.date);
    let presentedOn = typedDate ? protocolDate(typedDate, today) : null;
    if (presentedOn && presentedOn > today) presentedOn = null;
    const notes: string[] = [];
    // A date written with a note, two dates or a date that does not exist
    // keeps its text in the anotações, word for word.
    if (typedDate && (!presentedOn || /[[/]|\se\s/.test(typedDate))) {
      notes.push(`Data no livro original: "${typedDate}".`);
    }
    if (!presentedOn) {
      if (!lastDate) {
        // A gap before any dated line: dated with the first date that comes.
        const next = body
          .slice(i + 1)
          .map((r) => protocolDate(String(r[at.date] ?? ""), today))
          .find(Boolean);
        presentedOn = next ?? null;
      } else {
        presentedOn = lastDate;
      }
      if (!presentedOn) {
        errors.push(`Linha ${line} (nº ${parsed.number}): sem data.`);
        return;
      }
      notes.push(
        "Data não consta do livro original (usada a do lançamento vizinho).",
      );
    } else {
      lastDate = presentedOn;
    }
    if (parsed.note) notes.push(`Observação: ${parsed.note}`);
    if (
      ILLEGIBLE.test(
        fold(
          `${typedDate} ${presenter} ${titleKind} ${annotations} ${parsed.note}`,
        ),
      )
    ) {
      notes.push(
        "Trecho ilegível ou incerto no livro original; conferir no livro físico.",
      );
    }
    if (voided) notes.push("Protocolo cancelado.");
    const acts = [annotations, ...notes]
      .filter(Boolean)
      .join(" ")
      .slice(0, 2000);
    const first = byNumber.get(parsed.number);
    if (first) {
      // The book has this number again (repeated, or with a letter): kept
      // in the anotações of the first, word for word.
      merged++;
      first.acts =
        `${first.acts} | Também lançado sob o nº ${parsed.number}${parsed.suffix ? `-${parsed.suffix}` : ""} em ${presentedOn.split("-").reverse().join("/")}: ${presenter || "sem apresentante"}, ${titleKind || "sem natureza"}${annotations ? `; ${annotations}` : ""}${parsed.note ? ` [${parsed.note}]` : ""}`.slice(
          0,
          4000,
        );
      return;
    }
    const named = statusByLabel.get(fold(cell(at.status)));
    const item: ProtocolImport = {
      number: parsed.number,
      presentedOn,
      presenter: presenter || (voided ? "Não consta" : ""),
      titleKind: titleKind || (voided ? "Não consta" : ""),
      acts,
      status:
        named ??
        (voided
          ? "cessado"
          : /registrad|averbad/.test(fold(annotations)) || annotations
            ? "registrado"
            : "cessado"),
      voided,
    };
    const volume = at.volume >= 0 ? cell(at.volume).slice(0, 30) : "";
    if (volume) item.volume = volume;
    if (!item.presenter || !item.titleKind) {
      item.presenter ||= "Não consta";
      item.titleKind ||= "Não consta";
      item.acts =
        `${item.acts} Apresentante ou natureza não constam do livro original.`.trim();
    }
    byNumber.set(parsed.number, item);
    items.push(item);
  });
  // The numbers the book skipped (between 1 and the last one): not used,
  // cancelled, dated with the número before them.
  const gaps = fillGaps(items);
  return {
    items: [...items, ...gaps].sort((a, b) => a.number - b.number),
    errors,
    merged,
    blank,
    gaps: gaps.length,
  };
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
