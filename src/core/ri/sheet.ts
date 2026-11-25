import {
  CNM_SITUATIONS,
  STREET_KIND_UNSPECIFIED,
  streetKindOf,
} from "./codes.ts";
import {
  EMPTY_CONDO,
  EMPTY_RURAL,
  isoDate,
  matriculaNumber,
  type PropertyInput,
} from "./property.ts";

/**
 * The index the office already keeps in a spreadsheet (one row per
 * matrícula), read into matrículas for the conferência before anything is
 * saved. The columns are found by their names, in any order; what is not
 * recognised is reported, never guessed.
 */

export interface SheetOwner {
  name: string;
  document: string;
}

export interface SheetRow {
  line: number;
  input: PropertyInput;
  owners: SheetOwner[];
  warnings: string[];
}

export interface SheetReading {
  rows: SheetRow[];
  errors: { line: number; message: string }[];
  /** Header → the field it fills ("" when ignored). */
  columns: { header: string; field: string }[];
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Field =
  | "number"
  | "status"
  | "ficha"
  | "owners"
  | "documents"
  | "denominacao"
  | "origin"
  | "openedOn"
  | "tipo"
  | "area"
  | "cnm"
  | "notes"
  | "street"
  | "streetNumber"
  | "district"
  | "cep"
  | "ccir"
  | "nirf"
  | "car"
  | "incra"
  | "sigef"
  | "book"
  | "priorActs"
  | "lastAct";

const FIELD_LABELS: Record<Field, string> = {
  number: "Número da matrícula",
  status: "Situação",
  ficha: "Ficha",
  owners: "Proprietários",
  documents: "CPF/CNPJ",
  denominacao: "Denominação",
  origin: "Origem (livro e folha)",
  openedOn: "Data de abertura",
  tipo: "Tipo (rural, urbano, transcrição)",
  area: "Área",
  cnm: "CNM",
  notes: "Observações",
  street: "Logradouro",
  streetNumber: "Número do logradouro",
  district: "Bairro",
  cep: "CEP",
  ccir: "CCIR",
  nirf: "NIRF",
  car: "CAR",
  incra: "Código do Incra",
  sigef: "Sigef",
  book: "Livro",
  priorActs: "Número de atos já lançados",
  lastAct: "Último ato",
};

/** Header (folded) → field. The first rule that matches wins. */
const RULES: [RegExp, Field][] = [
  [/^(n |no |numero )?matricula$|^matricula n|^mat$|^n matricula/, "number"],
  [/situacao|status/, "status"],
  [/ficha/, "ficha"],
  [/proprietari|titular/, "owners"],
  [/cpf|cnpj|documento/, "documents"],
  [/denominacao|nome do imovel/, "denominacao"],
  [/origem|livro\/fls|registro anterior|transcricao anterior/, "origin"],
  [/abertura|^data$/, "openedOn"],
  [/^tipo/, "tipo"],
  [/^area/, "area"],
  [/^cnm|codigo nacional/, "cnm"],
  [/observ|^obs/, "notes"],
  [/logradouro|endereco|^rua$/, "street"],
  [/^numero$|^n$|^no$/, "streetNumber"],
  [/bairro|localidade/, "district"],
  [/^cep/, "cep"],
  [/ccir/, "ccir"],
  [/nirf|itr/, "nirf"],
  [/^car$|cadastro ambiental/, "car"],
  [/incra|sncr/, "incra"],
  [/sigef|certificacao/, "sigef"],
  [/^livro$/, "book"],
  [/n de atos|numero de atos|qtd.*atos|quantidade de atos|^atos$/, "priorActs"],
  [/ultimo ato/, "lastAct"],
];

export function fieldOf(header: string): Field | null {
  const h = fold(header);
  if (!h) return null;
  for (const [rule, field] of RULES) if (rule.test(h)) return field;
  return null;
}

/** "ativa", "Encerrada", "2", "sem imóvel" → the PGV situação. */
export function statusOf(value: string): number | null {
  const v = fold(value);
  if (!v) return 0;
  if (/^[0-4]$/.test(v)) return Number(v);
  if (/ativ|aberta|vigente/.test(v)) return 0;
  if (/anulad/.test(v)) return 1;
  if (/encerrad|unificad|fundid/.test(v)) return 2;
  if (/cancelad/.test(v)) return 3;
  if (/inexist|sem imovel|nao utilizad|vag/.test(v)) return 4;
  return null;
}

/** "Fulano e Beltrana; Sicrano" → the names, in order. */
export function splitNames(value: string): string[] {
  return value
    .split(/\s*;\s*|\s*\n\s*|\s+e\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((name) => name.replace(/\s+/g, " ").trim())
    .filter((name) => name.length > 1);
}

/** Every CPF (11) or CNPJ (14) in the text, digits only, in order. */
export function splitDocuments(value: string): string[] {
  const out: string[] = [];
  for (const match of value.matchAll(
    /\d{2,3}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g,
  )) {
    const d = match[0].replace(/\D/g, "");
    if (d.length === 11 || d.length === 14) out.push(d);
  }
  return out;
}

/** CSV with ";" or "," (whichever the header uses), quotes as Excel writes. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim()));
}

/** The header row: the first one with a matrícula column. */
function headerIndex(rows: string[][]): number {
  return rows.findIndex((row) =>
    row.some((cell) => fieldOf(cell) === "number"),
  );
}

/** Reads the rows of the sheet (the header among the first ten). */
export function readSheet(rows: string[][]): SheetReading {
  const at = headerIndex(rows.slice(0, 10));
  if (at < 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            'Não achei a coluna da matrícula. A primeira linha precisa ter um título como "Matrícula".',
        },
      ],
      columns: [],
    };
  }
  const header = rows[at] ?? [];
  const fields = header.map((cell) => fieldOf(cell));
  const columns = header
    .map((cell, i) => ({
      header: cell.trim(),
      field: fields[i] ? FIELD_LABELS[fields[i] as Field] : "",
    }))
    .filter((column) => column.header);
  const out: SheetRow[] = [];
  const errors: SheetReading["errors"] = [];
  for (let r = at + 1; r < rows.length; r++) {
    const line = r + 1;
    const cells = rows[r] ?? [];
    const get = (field: Field) =>
      fields
        .map((f, i) => (f === field ? (cells[i] ?? "").trim() : ""))
        .filter(Boolean)
        .join("\n");
    if (!cells.some((cell) => cell.trim())) continue;
    const number = matriculaNumber(get("number"));
    if (!number) {
      errors.push({ line, message: "sem número de matrícula" });
      continue;
    }
    const warnings: string[] = [];
    const status = statusOf(get("status"));
    if (status === null) {
      warnings.push(
        `situação "${get("status")}" não reconhecida: ficou como Ativa`,
      );
    }
    const openedText = get("openedOn");
    const openedOn = isoDate(openedText);
    if (openedText && !openedOn) {
      warnings.push(`data de abertura "${openedText}" não reconhecida`);
    }
    const tipo = fold(get("tipo"));
    const street = get("street");
    const denominacao = get("denominacao");
    const rural =
      /rural|fazenda|sitio|gleba/.test(tipo) ||
      (!/urban/.test(tipo) && Boolean(denominacao) && !street);
    const streetKind = street
      ? streetKindOf(street)
      : rural
        ? STREET_KIND_UNSPECIFIED
        : null;
    const names = splitNames(get("owners"));
    const documents = splitDocuments(get("documents"));
    if (documents.length > 0 && documents.length !== names.length) {
      warnings.push(
        `${names.length} proprietário(s) e ${documents.length} CPF/CNPJ: confira quem é quem`,
      );
    }
    const prior = Number(get("priorActs").replace(/\D/g, "")) || 0;
    const lastAct = get("lastAct");
    const notes = [
      get("notes"),
      lastAct ? `Último ato na planilha: ${lastAct}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    out.push({
      line,
      owners: names.map((name, i) => ({ name, document: documents[i] ?? "" })),
      warnings,
      input: {
        book: get("book").trim() === "3" ? 3 : 2,
        number,
        recordKind: /transcri/.test(tipo) ? 4 : 1,
        status: status ?? 0,
        cnm: get("cnm"),
        cnmInPgv: false,
        openedOn,
        origin: get("origin"),
        ficha: get("ficha"),
        location: rural ? 1 : 0,
        propertyKind: rural ? 9 : null,
        streetKind,
        street:
          street.replace(/^\S+\.?\s+/, (word) =>
            streetKindOf(word.trim()) ? "" : word,
          ) || (rural ? denominacao : ""),
        streetNumber: get("streetNumber"),
        district: get("district") || (rural ? "Zona Rural" : ""),
        cep: get("cep").replace(/\D/g, "").slice(0, 8),
        complement: "",
        quadra: "",
        setor: "",
        conjunto: "",
        lote: "",
        loteamento: "",
        contributors: [],
        rural: {
          ...EMPTY_RURAL,
          denominacao,
          ccir: get("ccir"),
          nirf: get("nirf"),
          car: get("car"),
          incra: get("incra"),
          sigef: get("sigef"),
        },
        condo: { ...EMPTY_CONDO },
        area: get("area"),
        priorActs: prior,
        description: "",
        notes,
      },
    });
  }
  return { rows: out, errors, columns };
}

/** The situação as the screens say it. */
export function statusLabel(status: number): string {
  return CNM_SITUATIONS.get(status) ?? "Ativa";
}
