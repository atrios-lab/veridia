import {
  CNM_SITUATIONS,
  codeIn,
  LOCATIONS,
  PROPERTY_KINDS,
  RECORD_KINDS,
  STREET_KINDS,
} from "./codes.ts";

/**
 * A matrícula (or transcrição) of the acervo as the office keeps it: the
 * fields the Indicador Real of the ONR asks for (Livro 4), the CNM and its
 * situação in the PGV, and the free description of the imóvel.
 */

export interface RuralData {
  car: string;
  nirf: string;
  ccir: string;
  incra: string;
  sigef: string;
  denominacao: string;
  acidente: string;
}

export interface CondoData {
  nome: string;
  bloco: string;
  conjunto: string;
  torre: string;
  apto: string;
  vaga: string;
}

export interface PropertyInput {
  book: 2 | 3;
  number: number;
  recordKind: number;
  status: number;
  cnm: string;
  cnmInPgv: boolean;
  openedOn: string | null;
  origin: string;
  ficha: string;
  location: number;
  propertyKind: number | null;
  streetKind: number | null;
  street: string;
  streetNumber: string;
  district: string;
  cep: string;
  complement: string;
  quadra: string;
  setor: string;
  conjunto: string;
  lote: string;
  loteamento: string;
  contributors: string[];
  rural: RuralData;
  condo: CondoData;
  area: string;
  /** Livro 3: what is registered (AUX_KINDS, or the office's words). */
  auxKind: string;
  /** Livro 3: the matrículas it refers to, as written ("1.234; 1.235"). */
  linkedNumbers: string;
  /** Lançamentos already on the ficha before the system (R/AV numbering). */
  priorActs: number;
  description: string;
  notes: string;
}

/**
 * What the Livro 3 (Registro Auxiliar) receives: Lei nº 6.015/1973, art.
 * 178, I to VII. The registro of a cédula's hipoteca or of a penhor that
 * guarantees the debêntures still goes on the matrícula (art. 178, I and
 * II): the Livro 3 holds the title itself.
 */
export const AUX_KINDS: readonly { name: string; source: string }[] = [
  { name: "Emissão de debêntures", source: "art. 178, I" },
  { name: "Cédula de crédito industrial", source: "art. 178, II" },
  {
    name: "Convenção de condomínio (edilício, geral voluntário ou multipropriedade)",
    source: "art. 178, III",
  },
  {
    name: "Penhor de máquinas e aparelhos da indústria",
    source: "art. 178, IV",
  },
  { name: "Convenção antenupcial (pacto antenupcial)", source: "art. 178, V" },
  { name: "Contrato de penhor rural", source: "art. 178, VI" },
  {
    name: "Título registrado no inteiro teor, a pedido do interessado",
    source: "art. 178, VII",
  },
];

export const EMPTY_RURAL: RuralData = {
  car: "",
  nirf: "",
  ccir: "",
  incra: "",
  sigef: "",
  denominacao: "",
  acidente: "",
};

export const EMPTY_CONDO: CondoData = {
  nome: "",
  bloco: "",
  conjunto: "",
  torre: "",
  apto: "",
  vaga: "",
};

export const RURAL_LABELS: Record<keyof RuralData, string> = {
  denominacao: "Denominação do imóvel rural",
  ccir: "CCIR",
  nirf: "NIRF (ITR)",
  car: "CAR",
  incra: "Código do imóvel no Incra (SNCR)",
  sigef: "Certificação Sigef",
  acidente: "Acidente geográfico (rio, serra, lagoa…)",
};

export const CONDO_LABELS: Record<keyof CondoData, string> = {
  nome: "Condomínio",
  bloco: "Bloco",
  conjunto: "Conjunto",
  torre: "Torre",
  apto: "Apartamento",
  vaga: "Vaga",
};

export class PropertyError extends Error {}

const MAX = 5000;
const clean = (value: unknown, max = 300) =>
  String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);

/** "1.234", "1234", "Mat. 1234" → 1234; null otherwise. */
export function matriculaNumber(value: unknown): number | null {
  const d = String(value ?? "").replace(/\D/g, "");
  if (!d || d.length > 7) return null;
  const n = Number(d);
  return n >= 1 ? n : null;
}

/** dd/mm/aaaa or aaaa-mm-dd → aaaa-mm-dd; null when empty or not a date. */
export function isoDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  let y: number;
  let m: number;
  let d: number;
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (br) {
    d = Number(br[1]);
    m = Number(br[2]);
    y = Number(br[3]);
  } else if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d ||
    y < 1800 ||
    y > 2200
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** aaaa-mm-dd → dd/mm/aaaa. */
export function brDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * The form of a matrícula, checked. Throws PropertyError with the message
 * the screen shows.
 */
export function readProperty(raw: Record<string, unknown>): PropertyInput {
  const book = Number(raw.book) === 3 ? 3 : 2;
  const number = matriculaNumber(raw.number);
  if (!number) throw new PropertyError("Informe o número da matrícula.");
  const recordKind = codeIn(RECORD_KINDS, raw.recordKind) ?? 1;
  const status = codeIn(CNM_SITUATIONS, raw.status) ?? 0;
  const location = codeIn(LOCATIONS, raw.location) ?? 0;
  const openedRaw = clean(raw.openedOn, 20);
  const openedOn = isoDate(openedRaw);
  if (openedRaw && !openedOn) {
    throw new PropertyError("A data de abertura não é uma data válida.");
  }
  const rural = { ...EMPTY_RURAL };
  for (const key of Object.keys(rural) as (keyof RuralData)[]) {
    rural[key] = clean(raw[`rural.${key}`]);
  }
  const condo = { ...EMPTY_CONDO };
  for (const key of Object.keys(condo) as (keyof CondoData)[]) {
    condo[key] = clean(raw[`condo.${key}`], 120);
  }
  const contributors = clean(raw.contributors, 1000)
    .split(/[\n;,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  return {
    book,
    number,
    recordKind,
    status,
    cnm: clean(raw.cnm, 30),
    cnmInPgv: raw.cnmInPgv === true || raw.cnmInPgv === "on",
    openedOn,
    origin: clean(raw.origin, 500),
    ficha: clean(raw.ficha, 120),
    location,
    propertyKind: codeIn(PROPERTY_KINDS, raw.propertyKind),
    streetKind: codeIn(STREET_KINDS, raw.streetKind),
    street: clean(raw.street),
    streetNumber: clean(raw.streetNumber, 30),
    district: clean(raw.district, 120),
    cep: clean(raw.cep, 12).replace(/\D/g, "").slice(0, 8),
    complement: clean(raw.complement),
    quadra: clean(raw.quadra, 60),
    setor: clean(raw.setor, 60),
    conjunto: clean(raw.conjunto, 60),
    lote: clean(raw.lote, 60),
    loteamento: clean(raw.loteamento, 200),
    contributors,
    rural,
    condo,
    area: clean(raw.area, 120),
    auxKind: book === 3 ? clean(raw.auxKind, 200) : "",
    linkedNumbers: book === 3 ? clean(raw.linkedNumbers, 300) : "",
    priorActs: Math.min(
      9999,
      Math.max(
        0,
        Math.trunc(Number(String(raw.priorActs ?? "").replace(/\D/g, "")) || 0),
      ),
    ),
    description: clean(raw.description, MAX),
    notes: clean(raw.notes, MAX),
  };
}

/** "Matrícula 1.234" / "Transcrição 56" / "Registro Auxiliar 7". */
export function propertyTitle(p: {
  book: number;
  number: number;
  recordKind: number;
}): string {
  const n = p.number.toLocaleString("pt-BR");
  if (p.recordKind === 4) return `Transcrição ${n}`;
  if (p.book === 3) return `Registro Auxiliar ${n}`;
  return `Matrícula ${n}`;
}

/** The one-line address of the index: denominação first when rural. */
export function addressLine(
  p: Pick<
    PropertyInput,
    | "location"
    | "streetKind"
    | "street"
    | "streetNumber"
    | "district"
    | "rural"
    | "lote"
    | "quadra"
  >,
): string {
  const kind = p.streetKind ? (STREET_KINDS.get(p.streetKind) ?? "") : "";
  const street = [kind && kind !== "Não Especificado" ? kind : "", p.street]
    .filter(Boolean)
    .join(" ");
  const denomination = p.location === 1 ? p.rural.denominacao : "";
  const road = [street, p.streetNumber].filter(Boolean).join(", ");
  const parts = [
    denomination,
    road === denomination ? "" : road,
    p.quadra ? `Quadra ${p.quadra}` : "",
    p.lote ? `Lote ${p.lote}` : "",
    p.district,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** What the Indicador Real of the ONR still lacks to accept this row. */
export function indicatorGaps(
  p: Pick<PropertyInput, "streetKind" | "street">,
): string[] {
  const gaps: string[] = [];
  if (!p.streetKind) gaps.push("tipo de logradouro");
  if (!p.street) gaps.push("nome do logradouro (ou da propriedade)");
  return gaps;
}
