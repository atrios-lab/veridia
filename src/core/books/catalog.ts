/**
 * The books of the attributions that keep no system of their own yet
 * (decision of 27/11/2026: importação e exportação "nos livros de Notas,
 * Títulos e Documentos, Pessoas Jurídicas e Protesto, com várias opções").
 * Each book has the columns the law asks; the platform keeps one line per
 * ato, imports and exports them, and prints the book.
 *
 * Sources: Provimento nº 156/2016 CGJ/RN (Código de Normas), arts. 64
 * (pessoas jurídicas), 65 (notas), 69 and 201 (títulos e documentos), 600
 * to 602 (protesto); Lei nº 6.015/1973, arts. 116 and 132; Lei nº
 * 9.492/1997, arts. 32 and 33.
 */

export interface BookColumn {
  key: string;
  label: string;
  required?: boolean;
  /** "date" is read as dd/mm/aaaa; "money" as R$. */
  kind?: "text" | "date" | "money" | "long";
}

export interface AttributionBook {
  key: string;
  attribution: string;
  name: string;
  source: string;
  columns: BookColumn[];
}

const number: BookColumn = {
  key: "numero",
  label: "Nº de ordem",
  required: true,
};
const date: BookColumn = {
  key: "data",
  label: "Data",
  required: true,
  kind: "date",
};
const notes: BookColumn = {
  key: "anotacoes",
  label: "Anotações e averbações",
  kind: "long",
};
const bookPage: BookColumn = { key: "livroFolha", label: "Livro e folha" };
const seal: BookColumn = { key: "selo", label: "Selo" };

const notarial = (key: string, name: string, act: string): AttributionBook => ({
  key,
  attribution: "notas",
  name,
  source: "Prov. nº 156/2016 CGJ/RN, art. 65",
  columns: [
    number,
    date,
    bookPage,
    { key: "natureza", label: act, required: true },
    { key: "partes", label: "Partes", required: true, kind: "long" },
    { key: "objeto", label: "Objeto", kind: "long" },
    { key: "valor", label: "Valor", kind: "money" },
    seal,
    notes,
  ],
});

const protocolA = (attribution: string, source: string): AttributionBook => ({
  key: "protocolo",
  attribution,
  name:
    attribution === "titulos-e-documentos" ? "Livro A: Protocolo" : "Protocolo",
  source,
  columns: [
    number,
    date,
    { key: "apresentante", label: "Apresentante", required: true },
    { key: "natureza", label: "Natureza do título", required: true },
    { key: "lancamento", label: "Qualidade do lançamento" },
    notes,
  ],
});

const registry = (
  attribution: string,
  key: string,
  name: string,
  source: string,
  subject: string,
): AttributionBook => ({
  key,
  attribution,
  name,
  source,
  columns: [
    number,
    date,
    bookPage,
    { key: "natureza", label: "Natureza", required: true },
    { key: "partes", label: subject, required: true, kind: "long" },
    { key: "resumo", label: "Resumo", kind: "long" },
    seal,
    notes,
  ],
});

export const ATTRIBUTION_BOOKS: AttributionBook[] = [
  notarial("escrituras", "Livro de Escrituras", "Natureza do ato"),
  notarial("testamentos", "Livro de Testamentos", "Espécie de testamento"),
  notarial("procuracoes", "Livro de Procurações", "Espécie de procuração"),
  notarial(
    "substabelecimentos",
    "Livro de Substabelecimento de Procurações",
    "Procuração substabelecida",
  ),
  notarial("atas", "Livro de Atas Notariais", "Fato constatado"),

  protocolA(
    "titulos-e-documentos",
    "Prov. nº 156/2016 CGJ/RN, arts. 69, I, e 201; Lei nº 6.015/1973, art. 132, I",
  ),
  registry(
    "titulos-e-documentos",
    "livro-b",
    "Livro B: Registro integral",
    "Prov. nº 156/2016 CGJ/RN, art. 69, II; Lei nº 6.015/1973, art. 132, II",
    "Partes",
  ),
  registry(
    "titulos-e-documentos",
    "livro-c",
    "Livro C: Registro por extrato",
    "Prov. nº 156/2016 CGJ/RN, art. 69, III; Lei nº 6.015/1973, art. 132, III",
    "Partes",
  ),
  {
    key: "livro-d",
    attribution: "titulos-e-documentos",
    name: "Livro D: Indicador Pessoal",
    source:
      "Prov. nº 156/2016 CGJ/RN, art. 69, IV; Lei nº 6.015/1973, art. 132, IV",
    columns: [
      number,
      { key: "nome", label: "Nome", required: true },
      { key: "documento", label: "CPF ou CNPJ" },
      {
        key: "referencias",
        label: "Referência aos demais livros",
        required: true,
      },
      notes,
    ],
  },

  protocolA("pessoas-juridicas", "Prov. nº 156/2016 CGJ/RN, art. 64, III"),
  registry(
    "pessoas-juridicas",
    "livro-a",
    "Livro A: Atos constitutivos e estatutos",
    "Prov. nº 156/2016 CGJ/RN, art. 64, I; Lei nº 6.015/1973, arts. 114 e 116",
    "Pessoa jurídica (denominação e CNPJ)",
  ),
  registry(
    "pessoas-juridicas",
    "livro-b",
    "Livro B: Jornais, oficinas e agências",
    "Prov. nº 156/2016 CGJ/RN, art. 64, II; Lei nº 6.015/1973, arts. 116 e 122",
    "Empresa matriculada",
  ),

  {
    key: "protocolo",
    attribution: "protesto",
    name: "Livro de Protocolo",
    source:
      "Prov. nº 156/2016 CGJ/RN, arts. 600, I, e 601; Lei nº 9.492/1997, art. 32",
    columns: [
      number,
      date,
      { key: "protocolo", label: "Nº do protocolo", required: true },
      {
        key: "natureza",
        label: "Natureza do documento de dívida",
        required: true,
      },
      { key: "valor", label: "Valor", kind: "money" },
      {
        key: "apresentante",
        label: "Apresentante (credor ou portador)",
        required: true,
      },
      { key: "devedor", label: "Devedor", required: true },
      { key: "intimacao", label: "Data da intimação", kind: "date" },
      {
        key: "comprovante",
        label: "Devolução do comprovante da intimação",
        kind: "date",
      },
      {
        key: "ocorrencias",
        label:
          "Ocorrências (retirada, sustação, pagamento, protesto ou cancelamento), com data",
        kind: "long",
      },
      { key: "taxas", label: "Taxas recolhidas", kind: "money" },
      {
        key: "repasse",
        label: "Data do repasse ao apresentante",
        kind: "date",
      },
    ],
  },
  {
    key: "registro",
    attribution: "protesto",
    name: "Livro de Registro de Protesto",
    source:
      "Prov. nº 156/2016 CGJ/RN, arts. 600, II, e 602; Lei nº 9.492/1997, art. 33",
    columns: [
      number,
      date,
      bookPage,
      { key: "protocolo", label: "Nº do protocolo" },
      {
        key: "natureza",
        label: "Título ou documento de dívida",
        required: true,
      },
      { key: "devedor", label: "Devedor", required: true },
      { key: "credor", label: "Credor", required: true },
      { key: "motivo", label: "Tipo e motivo do protesto", required: true },
      { key: "emolumentos", label: "Emolumentos", kind: "money" },
      { key: "taxas", label: "Taxas", kind: "money" },
      { key: "despesas", label: "Outras despesas", kind: "money" },
      seal,
      notes,
    ],
  },
];

export function booksOf(attribution: string): AttributionBook[] {
  return ATTRIBUTION_BOOKS.filter((b) => b.attribution === attribution);
}

export function bookOf(
  attribution: string,
  key: string,
): AttributionBook | undefined {
  return ATTRIBUTION_BOOKS.find(
    (b) => b.attribution === attribution && b.key === key,
  );
}

// ── leitura e conferência ───────────────────────────────────────────────

export class BookEntryError extends Error {}

const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function isoOf(value: string): string | null {
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

export interface EntryInput {
  number: number;
  date: string | null;
  data: Record<string, string>;
}

/** One entry, checked against the columns of its book. */
export function readEntry(
  book: AttributionBook,
  raw: Record<string, unknown>,
  today: string,
): EntryInput {
  const data: Record<string, string> = {};
  const missing: string[] = [];
  let date: string | null = null;
  for (const c of book.columns) {
    let value = String(raw[c.key] ?? "")
      .trim()
      .slice(0, c.kind === "long" ? 5000 : 500);
    if (c.kind === "date" && value) {
      const iso = isoOf(value);
      if (!iso)
        throw new BookEntryError(`${c.label}: data inválida (use dd/mm/aaaa).`);
      if (iso > today)
        throw new BookEntryError(
          `${c.label}: a data não pode ser depois de hoje.`,
        );
      value = iso;
      if (c.key === "data") date = iso;
    }
    if (c.required && !value) missing.push(c.label);
    if (c.key !== "numero") data[c.key] = value;
  }
  if (missing.length) {
    throw new BookEntryError(`Falta: ${missing.join(", ")}.`);
  }
  const number = Number(String(raw.numero ?? "").replace(/\D/g, ""));
  if (!number) throw new BookEntryError("Falta o número de ordem.");
  return { number, date, data };
}

export interface ImportReading {
  items: EntryInput[];
  errors: string[];
}

/**
 * The rows of a spreadsheet (first row = header, matched by name in any
 * order) or of a JSON array of objects, read line by line.
 */
export function readBookRows(
  book: AttributionBook,
  rows: string[][],
  today: string,
): ImportReading {
  const [header = [], ...body] = rows;
  const folded = header.map((h) => fold(String(h ?? "")));
  const index = new Map<string, number>();
  for (const c of book.columns) {
    const target = fold(c.label);
    const short = fold(c.label.split(" (")[0] ?? c.label);
    const i = folded.findIndex(
      (h) =>
        h === target ||
        h === fold(c.key) ||
        h.startsWith(short) ||
        h.startsWith(fold(c.key)),
    );
    if (i >= 0) index.set(c.key, i);
  }
  const missing = book.columns
    .filter((c) => c.required && !index.has(c.key))
    .map((c) => c.label);
  if (missing.length) {
    return {
      items: [],
      errors: [
        `A planilha precisa das colunas: ${missing.join(", ")}. Baixe o modelo do livro.`,
      ],
    };
  }
  const items: EntryInput[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();
  body.forEach((row, i) => {
    if (row.every((c) => !String(c ?? "").trim())) return;
    const raw: Record<string, unknown> = {};
    for (const [key, j] of index) raw[key] = String(row[j] ?? "");
    try {
      const entry = readEntry(book, raw, today);
      if (seen.has(entry.number)) {
        errors.push(
          `Linha ${i + 2}: o nº ${entry.number} se repete na planilha.`,
        );
        return;
      }
      seen.add(entry.number);
      items.push(entry);
    } catch (error) {
      errors.push(
        `Linha ${i + 2}: ${error instanceof BookEntryError ? error.message : "não foi possível ler."}`,
      );
    }
  });
  return { items, errors };
}

/** A JSON export (array of objects keyed by column label or key) as rows. */
export function rowsOfJson(book: AttributionBook, text: string): string[][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BookEntryError("O arquivo JSON não pôde ser lido.");
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { lancamentos?: unknown })?.lancamentos)
      ? (parsed as { lancamentos: unknown[] }).lancamentos
      : null;
  if (!list)
    throw new BookEntryError("O JSON precisa ser uma lista de lançamentos.");
  const header = book.columns.map((c) => c.label);
  const rows = list.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return book.columns.map((c) => String(o[c.label] ?? o[c.key] ?? ""));
  });
  return [header, ...rows];
}

/** The entry as the row of the book, dates in dd/mm/aaaa. */
export function rowOf(book: AttributionBook, entry: EntryInput): string[] {
  return book.columns.map((c) => {
    if (c.key === "numero") return String(entry.number);
    const value = entry.data[c.key] ?? "";
    return c.kind === "date" && value
      ? value.split("-").reverse().join("/")
      : value;
  });
}

export type ImportMode = "conferir" | "novos" | "completar";

export const IMPORT_MODES: Record<ImportMode, string> = {
  conferir: "Só conferir (não grava nada)",
  novos: "Acrescentar só os lançamentos novos",
  completar:
    "Acrescentar os novos e completar campos vazios dos que já existem",
};

/**
 * What a "completar" import adds to an entry already in the book: only the
 * fields still empty; a value already there is never replaced.
 */
export function fillEmpty(
  current: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> | null {
  const out = { ...current };
  let changed = false;
  for (const [key, value] of Object.entries(incoming)) {
    if (value && !String(current[key] ?? "").trim()) {
      out[key] = value;
      changed = true;
    }
  }
  return changed ? out : null;
}

/**
 * Which book of the attribution a spreadsheet belongs to, by its header:
 * the book whose required columns are all there and that matches the most
 * columns. Null when none fits (the screen then asks which book it is).
 */
export function detectBook(
  attribution: string,
  header: string[],
  fileName = "",
): AttributionBook | null {
  const folded = header.map((h) => fold(String(h ?? "")));
  const has = (c: BookColumn) => {
    const target = fold(c.label);
    const short = fold(c.label.split(" (")[0] ?? c.label);
    return folded.some(
      (h) =>
        h === target ||
        h === fold(c.key) ||
        h.startsWith(short) ||
        h.startsWith(fold(c.key)),
    );
  };
  const name = fold(fileName);
  let best: { book: AttributionBook; score: number } | null = null;
  for (const book of booksOf(attribution)) {
    if (!book.columns.filter((c) => c.required).every(has)) continue;
    let score = book.columns.filter(has).length;
    // The file name breaks a tie: "procuracoes.xlsx", "livro-b.csv".
    const words = fold(book.name)
      .split(" ")
      .filter((w) => w.length > 3 && w !== "livro");
    if (words.some((w) => name.includes(w))) score += 0.5;
    if (name.includes(fold(book.key))) score += 0.5;
    if (!best || score > best.score) best = { book, score };
  }
  return best?.book ?? null;
}

/**
 * The volume a lançamento is in, read from "Livro e folha" ("Livro 12, fl.
 * 34", "L-12 F-34", "12/34", "12-A"). Empty when it does not say.
 */
export function volumeOf(livroFolha: string): string {
  const v = livroFolha.trim();
  if (!v) return "";
  const named = /livro\s*(?:n[ºo°.]?\s*)?([0-9]+(?:-?[a-z])?)/i.exec(v);
  if (named?.[1]) return named[1].toUpperCase();
  const short = /^l\.?\s*-?\s*([0-9]+(?:-?[a-z])?)/i.exec(v);
  if (short?.[1]) return short[1].toUpperCase();
  const pair = /^([0-9]+(?:-?[a-z])?)\s*[/,-]\s*(?:fl|f|folha)?/i.exec(v);
  return pair?.[1]?.toUpperCase() ?? "";
}

/** The volumes found in the lançamentos, in order (1, 2, 2-A, 10). */
export function volumesOf(
  entries: { data: Record<string, string> }[],
): string[] {
  const set = new Set(
    entries.map((e) => volumeOf(e.data.livroFolha ?? "")).filter(Boolean),
  );
  return [...set].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  );
}
