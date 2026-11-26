import {
  type Act,
  type ActEffect,
  actLabel,
  PARTY_ROLE_LABELS,
  type PartyRole,
  ROLES_BY_EFFECT,
  situationOf,
} from "./acts.ts";
import {
  LOCATIONS,
  PROPERTY_KINDS,
  RECORD_KINDS,
  STREET_KINDS,
} from "./codes.ts";
import { natureOf } from "./matricula-text.ts";
import { actTypeFor } from "./onr.ts";
import {
  brDate,
  isoDate,
  matriculaNumber,
  PropertyError,
  type PropertyInput,
  readProperty,
} from "./property.ts";
import {
  readSheet,
  type SheetOwner,
  type SheetRow,
  statusLabel,
  statusOf,
} from "./sheet.ts";

/**
 * The acervo of the Registro de Imóveis going out and coming in (decision
 * of 25/11/2026: "exportar e importar as matrículas, os indicadores, os
 * índices e os atos, em todos os formatos"). Every table has one shape for
 * the planilha (.xlsx, .csv) and for the JSON, so what goes out comes back
 * in; the files of the ONR (Indicador Real, Indicador Pessoal, lote de CNM)
 * are read too. Reading never decides: it hands rows to the conferência,
 * and the service never overwrites what is already in the system.
 */

export type Table = string[][];

export type TransferKind =
  | "matriculas"
  | "atos"
  | "pessoas"
  | "indicador-real"
  | "indicador-pessoal";

export const TRANSFER_LABELS: Record<TransferKind, string> = {
  matriculas: "Matrículas (índice completo, Livros 2 e 3)",
  atos: "Atos (registros e averbações de cada matrícula)",
  pessoas: "Pessoas (Indicador Pessoal, uma linha por pessoa)",
  "indicador-real": "Indicador Real (Livro 4, uma linha por imóvel)",
  "indicador-pessoal":
    "Indicador Pessoal (Livro 5, pessoa, matrícula e ato, como o Banco Light)",
};

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** A code of the list, from its number or its name ("Rural", "Rua"). */
function codeFrom(
  list: ReadonlyMap<number, string>,
  value: string,
): number | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return list.has(Number(v)) ? Number(v) : null;
  const f = fold(v);
  for (const [code, name] of list) if (fold(name) === f) return code;
  return null;
}

// ------------------------------------------------------------- matrículas

type Owners = { owners: SheetOwner[] };

interface Column {
  label: string;
  /** The key readProperty() reads ("rural.car"), or an own one. */
  key: string;
  out: (p: PropertyInput & Owners) => string;
  /** Text of the cell → what readProperty() expects. */
  in?: (value: string) => unknown;
  real?: boolean;
}

const named = (list: ReadonlyMap<number, string>, code: number | null) =>
  code === null ? "" : (list.get(code) ?? String(code));

const PROPERTY_COLUMNS: Column[] = [
  { label: "Livro", key: "book", out: (p) => String(p.book), real: true },
  {
    label: "Matrícula",
    key: "number",
    out: (p) => String(p.number),
    real: true,
  },
  {
    label: "Tipo de registro",
    key: "recordKind",
    out: (p) => named(RECORD_KINDS, p.recordKind),
    in: (v) => codeFrom(RECORD_KINDS, v),
    real: true,
  },
  {
    label: "Situação",
    key: "status",
    out: (p) => statusLabel(p.status),
    in: (v) => statusOf(v),
    real: true,
  },
  { label: "CNM", key: "cnm", out: (p) => p.cnm, real: true },
  {
    label: "CNM já no PGV",
    key: "cnmInPgv",
    out: (p) => (p.cnmInPgv ? "Sim" : "Não"),
    in: (v) => /^s/i.test(v.trim()),
  },
  {
    label: "Data de abertura",
    key: "openedOn",
    out: (p) => brDate(p.openedOn),
  },
  { label: "Origem (registro anterior)", key: "origin", out: (p) => p.origin },
  { label: "Ficha", key: "ficha", out: (p) => p.ficha },
  {
    label: "Localização",
    key: "location",
    out: (p) => named(LOCATIONS, p.location),
    in: (v) => codeFrom(LOCATIONS, v),
    real: true,
  },
  {
    label: "Tipo de imóvel",
    key: "propertyKind",
    out: (p) => named(PROPERTY_KINDS, p.propertyKind),
    in: (v) => codeFrom(PROPERTY_KINDS, v),
    real: true,
  },
  {
    label: "Tipo de logradouro",
    key: "streetKind",
    out: (p) => named(STREET_KINDS, p.streetKind),
    in: (v) => codeFrom(STREET_KINDS, v),
    real: true,
  },
  { label: "Logradouro", key: "street", out: (p) => p.street, real: true },
  {
    label: "Número do logradouro",
    key: "streetNumber",
    out: (p) => p.streetNumber,
    real: true,
  },
  { label: "Bairro", key: "district", out: (p) => p.district, real: true },
  { label: "CEP", key: "cep", out: (p) => p.cep, real: true },
  {
    label: "Complemento",
    key: "complement",
    out: (p) => p.complement,
    real: true,
  },
  { label: "Quadra", key: "quadra", out: (p) => p.quadra, real: true },
  { label: "Setor", key: "setor", out: (p) => p.setor, real: true },
  { label: "Conjunto", key: "conjunto", out: (p) => p.conjunto, real: true },
  { label: "Lote", key: "lote", out: (p) => p.lote, real: true },
  {
    label: "Loteamento",
    key: "loteamento",
    out: (p) => p.loteamento,
    real: true,
  },
  {
    label: "Contribuintes (inscrição municipal)",
    key: "contributors",
    out: (p) => p.contributors.join("; "),
    real: true,
  },
  {
    label: "Denominação do imóvel rural",
    key: "rural.denominacao",
    out: (p) => p.rural.denominacao,
    real: true,
  },
  { label: "CCIR", key: "rural.ccir", out: (p) => p.rural.ccir, real: true },
  {
    label: "NIRF (ITR)",
    key: "rural.nirf",
    out: (p) => p.rural.nirf,
    real: true,
  },
  { label: "CAR", key: "rural.car", out: (p) => p.rural.car, real: true },
  {
    label: "Código do Incra (SNCR)",
    key: "rural.incra",
    out: (p) => p.rural.incra,
    real: true,
  },
  {
    label: "Certificação Sigef",
    key: "rural.sigef",
    out: (p) => p.rural.sigef,
    real: true,
  },
  {
    label: "Acidente geográfico",
    key: "rural.acidente",
    out: (p) => p.rural.acidente,
    real: true,
  },
  {
    label: "Condomínio",
    key: "condo.nome",
    out: (p) => p.condo.nome,
    real: true,
  },
  { label: "Bloco", key: "condo.bloco", out: (p) => p.condo.bloco, real: true },
  {
    label: "Conjunto do condomínio",
    key: "condo.conjunto",
    out: (p) => p.condo.conjunto,
    real: true,
  },
  { label: "Torre", key: "condo.torre", out: (p) => p.condo.torre, real: true },
  {
    label: "Apartamento",
    key: "condo.apto",
    out: (p) => p.condo.apto,
    real: true,
  },
  { label: "Vaga", key: "condo.vaga", out: (p) => p.condo.vaga, real: true },
  { label: "Área", key: "area", out: (p) => p.area },
  {
    label: "Tipo do registro auxiliar (Livro 3)",
    key: "auxKind",
    out: (p) => p.auxKind,
  },
  {
    label: "Matrículas ligadas (Livro 3)",
    key: "linkedNumbers",
    out: (p) => p.linkedNumbers,
  },
  {
    label: "Atos anteriores ao sistema",
    key: "priorActs",
    out: (p) => (p.priorActs ? String(p.priorActs) : ""),
  },
  {
    label: "Proprietários",
    key: "owners",
    out: (p) => p.owners.map((o) => o.name).join("; "),
  },
  {
    label: "CPF/CNPJ dos proprietários",
    key: "documents",
    out: (p) => p.owners.map((o) => o.document).join("; "),
  },
  {
    label: "Descrição do imóvel",
    key: "description",
    out: (p) => p.description,
  },
  { label: "Observações", key: "notes", out: (p) => p.notes },
];

/** The matrículas, every field, as the import reads them back. */
export function propertyTable(
  items: readonly (PropertyInput & Owners)[],
  options: { real?: boolean } = {},
): Table {
  const columns = options.real
    ? PROPERTY_COLUMNS.filter((c) => c.real)
    : PROPERTY_COLUMNS;
  return [
    columns.map((c) => c.label),
    ...items.map((p) => columns.map((c) => c.out(p))),
  ];
}

/** The owners of a matrícula from its atos (the situação in force). */
export function ownersOf(acts: readonly Act[]): SheetOwner[] {
  return situationOf([...acts]).owners.map((o) => ({
    name: o.name,
    document: o.document,
  }));
}

const PROPERTY_BY_LABEL = new Map(
  PROPERTY_COLUMNS.map((c) => [fold(c.label), c]),
);

/** How many headers are the system's own labels (complete format). */
function ownLabels(header: readonly string[]): number {
  return header.filter((h) => PROPERTY_BY_LABEL.has(fold(h))).length;
}

export interface TableReading<T> {
  rows: T[];
  errors: { line: number; message: string }[];
  columns: { header: string; field: string }[];
}

/** The complete matrícula sheet (the one this system exports). */
export function readPropertyTable(rows: Table): TableReading<SheetRow> {
  const header = rows[0] ?? [];
  const columns = header.map((h) => PROPERTY_BY_LABEL.get(fold(h)) ?? null);
  const out: SheetRow[] = [];
  const errors: { line: number; message: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => String(c ?? "").trim())) continue;
    const line = r + 1;
    const raw: Record<string, unknown> = {};
    let names: string[] = [];
    let documents: string[] = [];
    columns.forEach((column, i) => {
      if (!column) return;
      const value = String(cells[i] ?? "").trim();
      if (column.key === "owners") {
        names = value
          .split(/\s*;\s*|\n/)
          .map((n) => n.trim())
          .filter(Boolean);
      } else if (column.key === "documents") {
        documents = value.split(/\s*;\s*|\n/).map((d) => d.replace(/\D/g, ""));
      } else {
        raw[column.key] = column.in ? column.in(value) : value;
      }
    });
    try {
      const input = readProperty(raw);
      const warnings: string[] = [];
      const docs = documents.filter(Boolean);
      if (docs.length > 0 && documents.length !== names.length) {
        warnings.push(
          `${names.length} proprietário(s) e ${documents.length} CPF/CNPJ: confira quem é quem`,
        );
      }
      out.push({
        line,
        input,
        owners: names.map((name, i) => ({
          name,
          document: documents[i] ?? "",
        })),
        warnings,
      });
    } catch (error) {
      errors.push({
        line,
        message:
          error instanceof PropertyError ? error.message : "linha não lida",
      });
    }
  }
  return {
    rows: out,
    errors,
    columns: header
      .map((h, i) => ({ header: h.trim(), field: columns[i]?.label ?? "" }))
      .filter((c) => c.header),
  };
}

// ------------------------------------------------------------------- atos

export const EFFECT_NAMES: Record<ActEffect, string> = {
  titularidade: "Proprietários",
  transmissao: "Transmissão",
  onus: "Ônus",
  cancelamento: "Cancelamento",
  descricao: "Descrição do imóvel",
  encerramento: "Encerramento",
  outro: "Outra averbação",
};

const ACT_HEADER = [
  "Livro",
  "Matrícula",
  "Tipo de registro",
  "Ato",
  "Número do ato",
  "Natureza",
  "Efeito",
  "Data do ato",
  "Protocolo",
  "Selo",
  "Valor (R$)",
  "Cancela o ato nº",
  "Partes",
  "Texto do ato",
] as const;

const money = (cents: number | null | undefined) =>
  cents === null || cents === undefined
    ? ""
    : (cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/** "1.234,56", "1234.56", "R$ 10" → cents; null when empty or not money. */
export function centsOf(value: string): number | null {
  const v = value.replace(/[^\d,.-]/g, "");
  if (!v) return null;
  const n = v.includes(",")
    ? Number(v.replace(/\./g, "").replace(",", "."))
    : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** One party per line: "Adquirente: NOME | CPF | fração". */
export function partiesCell(parties: readonly Act["parties"][number][]) {
  return parties
    .map((p) =>
      [`${PARTY_ROLE_LABELS[p.role]}: ${p.name}`, p.document, p.share]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

const ROLE_WORDS: [RegExp, PartyRole][] = [
  [/^(proprietari|titular)/, "titular"],
  [
    /^(adquirente|comprador|donatari|outorgad|herdeir|arrematante)/,
    "adquirente",
  ],
  [/^(transmitente|vendedor|doador|outorgante|alienante)/, "transmitente"],
  [/^(credor|fiduciari|banco)/, "credor"],
  [/^(devedor|fiduciante|emitente|executad)/, "devedor"],
  [/^(outr|parte|interveniente|anuente)/, "outro"],
];

export interface PartyRow {
  name: string;
  document: string;
  role: PartyRole;
  share: string;
}

/** The parties written in one cell, back into rows. */
export function readParties(cell: string): PartyRow[] {
  const out: PartyRow[] = [];
  for (const line of cell.split(/\r?\n|;\s*(?=[^;:|]{3,30}:)/)) {
    const text = line.trim();
    if (!text) continue;
    const colon = text.indexOf(":");
    const roleText = colon > 0 ? fold(text.slice(0, colon)) : "";
    const role =
      ROLE_WORDS.find(([rule]) => rule.test(roleText))?.[1] ?? "outro";
    const rest =
      colon > 0 && roleText.length <= 30 ? text.slice(colon + 1) : text;
    const parts = rest.split("|").map((part) => part.trim());
    const name = (parts.shift() ?? "").replace(/\s+/g, " ");
    let document = "";
    let share = "";
    for (const part of parts) {
      const digits = part.replace(/\D/g, "");
      if (!document && (digits.length === 11 || digits.length === 14)) {
        document = digits;
      } else if (part) {
        share = part.slice(0, 40);
      }
    }
    if (name.length > 1) out.push({ name, document, role, share });
  }
  return out;
}

/** The atos of every matrícula, one row each, in the order of the ficha. */
export function actTable(
  items: readonly {
    property: Pick<PropertyInput, "book" | "number" | "recordKind">;
    acts: readonly Act[];
  }[],
): Table {
  const rows: Table = [[...ACT_HEADER]];
  for (const { property, acts } of items) {
    const bySeqId = new Map(acts.map((a) => [a.id, a.seq]));
    for (const act of [...acts].sort((a, b) => a.seq - b.seq)) {
      rows.push([
        String(property.book),
        String(property.number),
        named(RECORD_KINDS, property.recordKind),
        act.kind,
        String(act.seq),
        act.nature,
        EFFECT_NAMES[act.effect],
        brDate(act.registeredOn),
        act.protocol ?? "",
        act.seal ?? "",
        money(act.valueCents),
        act.cancelsActId ? String(bySeqId.get(act.cancelsActId) ?? "") : "",
        partiesCell(act.parties),
        act.summary,
      ]);
    }
  }
  return rows;
}

export interface ActRow {
  line: number;
  book: 2 | 3;
  recordKind: number;
  number: number;
  kind: "R" | "AV" | "M";
  seq: number;
  nature: string;
  effect: ActEffect;
  registeredOn: string | null;
  protocol: string;
  seal: string;
  valueCents: number | null;
  cancelsSeq: number | null;
  parties: PartyRow[];
  summary: string;
  warnings: string[];
}

const EFFECT_BY_NAME = new Map<string, ActEffect>(
  (Object.entries(EFFECT_NAMES) as [ActEffect, string][]).flatMap(
    ([effect, name]) => [
      [fold(name), effect],
      [effect, effect],
    ],
  ),
);

function headerMap(header: readonly string[]) {
  const map = new Map<string, number>();
  header.forEach((h, i) => {
    const f = fold(h);
    if (f && !map.has(f)) map.set(f, i);
  });
  return map;
}

/** The atos sheet (the one this system exports, or one made like it). */
export function readActTable(rows: Table): TableReading<ActRow> {
  const header = rows[0] ?? [];
  const at = headerMap(header);
  const get = (cells: string[], label: string) =>
    String(cells[at.get(fold(label)) ?? -1] ?? "").trim();
  const out: ActRow[] = [];
  const errors: { line: number; message: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => String(c ?? "").trim())) continue;
    const line = r + 1;
    const number = matriculaNumber(get(cells, "Matrícula"));
    if (!number) {
      errors.push({ line, message: "sem número de matrícula" });
      continue;
    }
    const kindText = get(cells, "Ato")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    const kind =
      kindText === "R" || kindText === "AV" || kindText === "M"
        ? kindText
        : null;
    if (!kind) {
      errors.push({ line, message: 'o ato precisa ser "R", "AV" ou "M"' });
      continue;
    }
    const seqText = get(cells, "Número do ato").replace(/\D/g, "");
    const seq = kind === "M" ? 0 : Number(seqText);
    if (kind !== "M" && (!seqText || seq < 1 || seq > 99999)) {
      errors.push({ line, message: "sem o número de ordem do ato" });
      continue;
    }
    const warnings: string[] = [];
    const nature = get(cells, "Natureza").replace(/\s+/g, " ").slice(0, 200);
    const summary = get(cells, "Texto do ato").slice(0, 5000);
    const guessed = natureOf(`${nature} ${summary}`);
    const effect =
      kind === "M"
        ? "titularidade"
        : (EFFECT_BY_NAME.get(fold(get(cells, "Efeito"))) ??
          guessed?.effect ??
          "outro");
    const dateText = get(cells, "Data do ato");
    const registeredOn = isoDate(dateText);
    if (dateText && !registeredOn) {
      warnings.push(`data "${dateText}" não reconhecida`);
    }
    const allowed = new Set(ROLES_BY_EFFECT[effect]);
    const parties = readParties(get(cells, "Partes")).map((p) => {
      if (allowed.has(p.role)) return p;
      const fallback = allowed.has("outro")
        ? "outro"
        : (ROLES_BY_EFFECT[effect][0] as PartyRole);
      warnings.push(
        `${p.name}: "${PARTY_ROLE_LABELS[p.role]}" não cabe neste ato; ficou como ${PARTY_ROLE_LABELS[fallback]}`,
      );
      return { ...p, role: fallback };
    });
    const cancelsText = get(cells, "Cancela o ato nº").replace(/\D/g, "");
    out.push({
      line,
      book: get(cells, "Livro") === "3" ? 3 : 2,
      recordKind: codeFrom(RECORD_KINDS, get(cells, "Tipo de registro")) ?? 1,
      number,
      kind,
      seq,
      nature:
        nature ||
        guessed?.name ||
        (kind === "R" ? "Registro" : kind === "AV" ? "Averbação" : ""),
      effect,
      registeredOn,
      protocol: get(cells, "Protocolo").slice(0, 60),
      seal: get(cells, "Selo").slice(0, 120),
      valueCents: centsOf(get(cells, "Valor (R$)")),
      cancelsSeq: cancelsText ? Number(cancelsText) : null,
      parties,
      summary,
      warnings,
    });
  }
  return {
    rows: out,
    errors,
    columns: header
      .map((h) => ({
        header: h.trim(),
        field: ACT_HEADER.some((l) => fold(l) === fold(h)) ? h.trim() : "",
      }))
      .filter((c) => c.header),
  };
}

// ----------------------------------------------------------------- pessoas

export interface PersonRow {
  line: number;
  name: string;
  document: string;
  /** Where the file says the person appears (shown, not saved). */
  where: string;
}

/** One row per person: name, CPF/CNPJ and where they appear. */
export function peopleTable(
  items: readonly {
    property: Pick<PropertyInput, "book" | "number" | "recordKind">;
    acts: readonly Act[];
  }[],
): Table {
  const byKey = new Map<
    string,
    { name: string; document: string; where: string[] }
  >();
  for (const { property, acts } of items) {
    const book =
      property.recordKind === 4
        ? "Transcrição"
        : property.book === 3
          ? "Livro 3"
          : "Matrícula";
    for (const act of acts) {
      for (const p of act.parties) {
        const key = p.personId || `${p.document}|${fold(p.name)}`;
        const entry = byKey.get(key) ?? {
          name: p.name,
          document: p.document,
          where: [],
        };
        entry.where.push(
          `${book} ${property.number.toLocaleString("pt-BR")}: ${actLabel(act)} (${PARTY_ROLE_LABELS[p.role]})`,
        );
        byKey.set(key, entry);
      }
    }
  }
  const people = [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  return [
    ["Nome", "CPF/CNPJ", "Onde aparece"],
    ...people.map((p) => [p.name, p.document, p.where.join("; ")]),
  ];
}

/** Pessoas, or the Indicador Pessoal sheet: who to have in the index. */
export function readPeopleTable(rows: Table): TableReading<PersonRow> {
  const header = rows[0] ?? [];
  const at = headerMap(header);
  const index = (...labels: string[]) => {
    for (const l of labels) {
      const i = at.get(fold(l));
      if (i !== undefined) return i;
    }
    return -1;
  };
  const nameAt = index("Nome", "Nome da pessoa", "NOME");
  const docAt = index("CPF/CNPJ", "CPF", "CNPJ", "Documento", "CNPJCPF");
  const whereAt = index("Onde aparece");
  const matAt = index("Matrícula", "NMATRICULA");
  const actAt = index("Tipo de ato", "TIPODEATO");
  const out: PersonRow[] = [];
  const errors: { line: number; message: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? [];
    if (!cells.some((c) => String(c ?? "").trim())) continue;
    const line = r + 1;
    const name = String(cells[nameAt] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (name.length < 2) {
      errors.push({ line, message: "sem nome" });
      continue;
    }
    const document = String(cells[docAt] ?? "").replace(/\D/g, "");
    if (document && document.length !== 11 && document.length !== 14) {
      errors.push({ line, message: `CPF/CNPJ "${cells[docAt]}" incompleto` });
      continue;
    }
    const where =
      whereAt >= 0
        ? String(cells[whereAt] ?? "")
        : [
            matAt >= 0 && cells[matAt] ? `Matrícula ${cells[matAt]}` : "",
            actAt >= 0 ? String(cells[actAt] ?? "") : "",
          ]
            .filter(Boolean)
            .join(": ");
    out.push({ line, name: name.slice(0, 300), document, where });
  }
  return {
    rows: out,
    errors,
    columns: header
      .map((h, i) => ({
        header: h.trim(),
        field:
          i === nameAt
            ? "Nome"
            : i === docAt
              ? "CPF/CNPJ"
              : i === whereAt || i === matAt || i === actAt
                ? "Onde aparece (só para conferir)"
                : "",
      }))
      .filter((c) => c.header),
  };
}

/** The Indicador Pessoal as a sheet: the rows of the Banco Light. */
export function personalTable(
  items: readonly {
    property: Pick<PropertyInput, "book" | "number" | "status" | "openedOn">;
    acts: readonly Act[];
  }[],
): Table {
  const rows: Table = [
    [
      "Nome",
      "CPF/CNPJ",
      "Matrícula",
      "Tipo de ato",
      "Data do registro ou averbação",
      "Data da venda",
    ],
  ];
  for (const { property, acts } of items) {
    if (property.status === 4 || property.book === 3) continue;
    const sorted = [...acts].sort((a, b) => a.seq - b.seq);
    for (const act of sorted) {
      for (const party of act.parties) {
        let sold = "";
        if (party.role === "adquirente" || party.role === "titular") {
          const later = sorted.find(
            (other) =>
              other.seq > act.seq &&
              other.effect === "transmissao" &&
              other.parties.some(
                (q) =>
                  q.personId === party.personId && q.role === "transmitente",
              ),
          );
          sold = brDate(later?.registeredOn ?? null);
        }
        rows.push([
          party.name,
          party.document,
          String(property.number),
          actTypeFor(act, party),
          brDate(
            act.registeredOn ?? (act.kind === "M" ? property.openedOn : null),
          ),
          sold,
        ]);
      }
    }
  }
  return rows;
}

// ------------------------------------------------------------ the bundle

export interface Transfer {
  /** What the file was read as, in the office's words. */
  format: string;
  properties: SheetRow[];
  acts: ActRow[];
  people: PersonRow[];
  errors: { line: number; message: string }[];
  columns: { header: string; field: string }[];
}

const empty = (format: string): Transfer => ({
  format,
  properties: [],
  acts: [],
  people: [],
  errors: [],
  columns: [],
});

/** The header row: the first of the first ten with a known column. */
function trimToHeader(rows: Table): Table {
  const at = rows.slice(0, 10).findIndex((row) =>
    row.some((cell) => {
      const f = fold(String(cell ?? ""));
      return (
        PROPERTY_BY_LABEL.has(f) ||
        f === "nome" ||
        f === "ato" ||
        /matricula/.test(f)
      );
    }),
  );
  return at > 0 ? rows.slice(at) : rows;
}

/** What kind of table this is, by its columns. */
export function tableKind(header: readonly string[]): TransferKind | "indice" {
  const f = new Set(header.map((h) => fold(String(h ?? ""))));
  if (f.has("ato") && f.has("numero do ato")) return "atos";
  if (f.has("nome") && (f.has("tipo de ato") || f.has("tipodeato"))) {
    return "indicador-pessoal";
  }
  if (ownLabels(header) >= 6) return "matriculas";
  if (
    (f.has("nome") || f.has("nome da pessoa")) &&
    ![...f].some((h) => /matricula|proprietari/.test(h))
  ) {
    return "pessoas";
  }
  return "indice";
}

/** A planilha (.xlsx or .csv, already as rows). */
export function transferFromTable(rows: Table, fileKind: string): Transfer {
  const table = trimToHeader(rows.map((r) => r.map((c) => String(c ?? ""))));
  const header = table[0] ?? [];
  const kind = tableKind(header);
  if (kind === "atos") {
    const read = readActTable(table);
    return {
      ...empty(`${fileKind}: atos das matrículas`),
      acts: read.rows,
      errors: read.errors,
      columns: read.columns,
    };
  }
  if (kind === "pessoas" || kind === "indicador-pessoal") {
    const read = readPeopleTable(table);
    return {
      ...empty(
        `${fileKind}: ${kind === "pessoas" ? "pessoas" : "Indicador Pessoal"}`,
      ),
      people: dedupePeople(read.rows),
      errors: read.errors,
      columns: read.columns,
    };
  }
  if (kind === "matriculas") {
    const read = readPropertyTable(table);
    return {
      ...empty(`${fileKind}: matrículas (formato completo)`),
      properties: read.rows,
      errors: read.errors,
      columns: read.columns,
    };
  }
  const read = readSheet(rows);
  return {
    ...empty(`${fileKind}: índice de matrículas da serventia`),
    properties: read.rows,
    errors: read.errors,
    columns: read.columns,
  };
}

/** The same person many times in the Indicador Pessoal: once here. */
function dedupePeople(rows: PersonRow[]): PersonRow[] {
  const seen = new Map<string, PersonRow>();
  for (const row of rows) {
    const key = row.document || `nome:${fold(row.name)}`;
    const found = seen.get(key);
    if (found) {
      if (row.where && !found.where.includes(row.where)) {
        found.where = [found.where, row.where].filter(Boolean).join("; ");
      }
    } else {
      seen.set(key, { ...row });
    }
  }
  return [...seen.values()];
}

/** Objects ({ "Matrícula": "12", … }) back into rows with a header. */
export function rowsOfObjects(list: readonly unknown[]): Table {
  const header: string[] = [];
  for (const item of list) {
    if (item && typeof item === "object") {
      for (const key of Object.keys(item)) {
        if (!header.includes(key)) header.push(key);
      }
    }
  }
  return [
    header,
    ...list.map((item) =>
      header.map((key) => {
        const value =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)[key]
            : "";
        return value === null || value === undefined ? "" : String(value);
      }),
    ),
  ];
}

/** A table as objects, for the JSON. */
export function objectsOf(table: Table): Record<string, string>[] {
  const [header = [], ...rows] = table;
  return rows.map((row) =>
    Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])),
  );
}

export const JSON_FORMAT = "veridia-registro-de-imoveis";

/** The INDICADOR_REAL of the ONR (v1.5) back into matrículas. */
function fromIndicadorReal(real: unknown[]): Transfer {
  const out = empty("JSON do Indicador Real (ONR)");
  real.forEach((item, i) => {
    const line = i + 1;
    if (!item || typeof item !== "object") return;
    const r = item as Record<string, unknown>;
    const rural = (r.RURAL ?? {}) as Record<string, unknown>;
    const condo = (r.CONDOMINIO ?? {}) as Record<string, unknown>;
    const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    const raw: Record<string, unknown> = {
      book: 2,
      number: s(r.NUMERO_REGISTRO),
      recordKind: s(r.REGISTRO_TIPO),
      status: Number(r.TIPOENVIO) === 2 ? 2 : 0,
      location: s(r.LOCALIZACAO),
      propertyKind: s(r.TIPO_DE_IMOVEL),
      streetKind: s(r.TIPO_LOGRADOURO),
      street: s(r.NOME_LOGRADOURO),
      streetNumber: s(r.NUMERO_LOGRADOURO),
      district: s(r.BAIRRO),
      cep: s(r.CEP),
      complement: s(r.COMPLEMENTO),
      quadra: s(r.QUADRA),
      conjunto: s(r.CONJUNTO),
      setor: s(r.SETOR),
      lote: s(r.LOTE),
      loteamento: s(r.LOTEAMENTO),
      contributors: Array.isArray(r.CONTRIBUINTE)
        ? r.CONTRIBUINTE.map(s).join(";")
        : s(r.CONTRIBUINTE),
      "rural.car": s(rural.CAR),
      "rural.nirf": s(rural.NIRF),
      "rural.ccir": s(rural.CCIR),
      "rural.incra": s(rural.NUMERO_INCRA),
      "rural.sigef": s(rural.SIGEF),
      "rural.denominacao": s(rural.DENOMINACAORURAL),
      "rural.acidente": s(rural.ACIDENTEGEOGRAFICO),
      "condo.nome": s(condo.NOME_CONDOMINIO),
      "condo.bloco": s(condo.BLOCO),
      "condo.conjunto": s(condo.CONJUNTO),
      "condo.torre": s(condo.TORRE),
      "condo.apto": s(condo.APTO),
      "condo.vaga": s(condo.VAGA),
    };
    try {
      const warnings =
        Number(r.TIPOENVIO) === 2
          ? ["veio como baixa (TIPOENVIO 2): ficou Encerrada; confira"]
          : [];
      out.properties.push({
        line,
        input: readProperty(raw),
        owners: [],
        warnings,
      });
    } catch (error) {
      out.errors.push({
        line,
        message:
          error instanceof PropertyError ? error.message : "registro não lido",
      });
    }
  });
  return out;
}

/** A JSON: this system's own, or the ONR's Indicador Real. */
export function transferFromJson(value: unknown): Transfer {
  if (Array.isArray(value)) {
    return transferFromTable(rowsOfObjects(value), "JSON");
  }
  if (!value || typeof value !== "object") {
    return { ...empty("JSON"), errors: [{ line: 1, message: "JSON vazio" }] };
  }
  const v = value as Record<string, unknown>;
  const ir = v.INDICADOR_REAL as Record<string, unknown> | undefined;
  if (ir && Array.isArray(ir.REAL)) return fromIndicadorReal(ir.REAL);
  if (v.formato === JSON_FORMAT) {
    const parts: Transfer[] = [];
    for (const key of ["matriculas", "atos", "pessoas", "linhas"]) {
      const list = v[key];
      if (Array.isArray(list) && list.length > 0) {
        parts.push(transferFromTable(rowsOfObjects(list), "JSON"));
      }
    }
    const merged = empty(
      v.tipo === "acervo"
        ? "JSON: cópia do acervo (matrículas, atos e pessoas)"
        : (parts[0]?.format ?? "JSON"),
    );
    for (const part of parts) {
      merged.properties.push(...part.properties);
      merged.acts.push(...part.acts);
      merged.people.push(...part.people);
      merged.errors.push(...part.errors);
      merged.columns.push(...part.columns);
    }
    return merged;
  }
  return {
    ...empty("JSON"),
    errors: [
      {
        line: 1,
        message:
          "Este JSON não é do sistema nem o Indicador Real da ONR. Use um arquivo exportado aqui ou o do Indicador Real.",
      },
    ],
  };
}

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i").exec(block);
  const raw = m?.[1] ?? "";
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(raw);
  return (cdata ? (cdata[1] ?? "") : raw)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
};

/** ddMMaaaa → dd/mm/aaaa. */
const fromBdl = (value: string) =>
  /^\d{8}$/.test(value)
    ? `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`
    : value;

/** A XML of the ONR: the Banco Light (Indicador Pessoal) or a lote de CNM. */
export function transferFromXml(xml: string): Transfer {
  if (/<BANCOLIGHT/i.test(xml)) {
    const rows: Table = [
      ["Nome", "CPF/CNPJ", "Matrícula", "Tipo de ato", "Data"],
    ];
    for (const block of xml.match(/<INDIVIDUO>[\s\S]*?<\/INDIVIDUO>/gi) ?? []) {
      rows.push([
        tag(block, "NOME"),
        tag(block, "CNPJCPF"),
        tag(block, "NMATRICULA"),
        tag(block, "TIPODEATO"),
        fromBdl(tag(block, "DTREGAVERB")),
      ]);
    }
    const read = readPeopleTable(rows);
    return {
      ...empty("XML do Indicador Pessoal (Banco Light da ONR)"),
      people: dedupePeople(read.rows),
      errors: read.errors,
    };
  }
  if (/<LOTE/i.test(xml)) {
    const out = empty("XML do lote de CNM (PGV-CNM)");
    (xml.match(/<REGISTRO>[\s\S]*?<\/REGISTRO>/gi) ?? []).forEach(
      (block, i) => {
        const line = i + 1;
        try {
          const book = tag(block, "LIVRO") === "3" ? 3 : 2;
          out.properties.push({
            line,
            owners: [],
            warnings:
              book === 3
                ? ["lote com Livro 3: confira o tipo do registro"]
                : [],
            input: readProperty({
              book,
              number: tag(block, "NUM"),
              cnm: tag(block, "CNM").replace(/\D/g, ""),
              status: tag(block, "SITUACAO") || 0,
              recordKind: 1,
            }),
          });
        } catch (error) {
          out.errors.push({
            line,
            message:
              error instanceof PropertyError
                ? error.message
                : "registro não lido",
          });
        }
      },
    );
    return out;
  }
  return {
    ...empty("XML"),
    errors: [
      {
        line: 1,
        message:
          "Este XML não é o Indicador Pessoal (Banco Light) nem um lote de CNM.",
      },
    ],
  };
}

/** The key the matrículas are matched by: livro (or T) and number. */
export function propertyKey(p: {
  book: number;
  number: number;
  recordKind: number;
}): string {
  return `${p.recordKind === 4 ? "T" : p.book}:${p.number}`;
}

/** Fills only what the matrícula left empty; never changes a value. */
export function fillEmpty(
  current: PropertyInput,
  incoming: PropertyInput,
): { input: PropertyInput; fields: string[] } {
  const fields: string[] = [];
  const pick = <T>(label: string, a: T, b: T, isEmpty: (v: T) => boolean) => {
    if (isEmpty(a) && !isEmpty(b)) {
      fields.push(label);
      return b;
    }
    return a;
  };
  const str = (v: string) => !v.trim();
  const nul = (v: unknown) => v === null || v === undefined;
  const ruralOut = { ...current.rural };
  for (const key of Object.keys(ruralOut) as (keyof typeof ruralOut)[]) {
    ruralOut[key] = pick(key, current.rural[key], incoming.rural[key], str);
  }
  const condoOut = { ...current.condo };
  for (const key of Object.keys(condoOut) as (keyof typeof condoOut)[]) {
    condoOut[key] = pick(key, current.condo[key], incoming.condo[key], str);
  }
  const input: PropertyInput = {
    ...current,
    cnm: pick("CNM", current.cnm, incoming.cnm, str),
    openedOn: pick("abertura", current.openedOn, incoming.openedOn, nul),
    origin: pick("origem", current.origin, incoming.origin, str),
    ficha: pick("ficha", current.ficha, incoming.ficha, str),
    propertyKind: pick(
      "tipo de imóvel",
      current.propertyKind,
      incoming.propertyKind,
      nul,
    ),
    streetKind: pick(
      "tipo de logradouro",
      current.streetKind,
      incoming.streetKind,
      nul,
    ),
    street: pick("logradouro", current.street, incoming.street, str),
    streetNumber: pick(
      "número",
      current.streetNumber,
      incoming.streetNumber,
      str,
    ),
    district: pick("bairro", current.district, incoming.district, str),
    cep: pick("CEP", current.cep, incoming.cep, str),
    complement: pick(
      "complemento",
      current.complement,
      incoming.complement,
      str,
    ),
    quadra: pick("quadra", current.quadra, incoming.quadra, str),
    setor: pick("setor", current.setor, incoming.setor, str),
    conjunto: pick("conjunto", current.conjunto, incoming.conjunto, str),
    lote: pick("lote", current.lote, incoming.lote, str),
    loteamento: pick(
      "loteamento",
      current.loteamento,
      incoming.loteamento,
      str,
    ),
    contributors: pick(
      "contribuintes",
      current.contributors,
      incoming.contributors,
      (v) => v.length === 0,
    ),
    rural: ruralOut,
    condo: condoOut,
    area: pick("área", current.area, incoming.area, str),
    auxKind: pick("tipo do Livro 3", current.auxKind, incoming.auxKind, str),
    linkedNumbers: pick(
      "matrículas ligadas",
      current.linkedNumbers,
      incoming.linkedNumbers,
      str,
    ),
    description: pick(
      "descrição",
      current.description,
      incoming.description,
      str,
    ),
  };
  return { input, fields };
}
