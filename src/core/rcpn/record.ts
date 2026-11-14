/**
 * The RCPN index (change `consulta-de-registro-rcpn`): what the office's
 * own registry system says about each registro, reduced to what the search
 * and the public lookup need. Read from the files the office exports, never
 * typed here, and never more than this: no CPF, no documents, no cause of
 * death (LGPD; design, decision 5).
 */

export const RCPN_KINDS = ["nascimento", "casamento", "obito"] as const;
export type RcpnKind = (typeof RCPN_KINDS)[number];

/** The plural, for the counts: "Nascimentos", "Casamentos", "Óbitos". */
export const RCPN_KIND_PLURALS: Record<RcpnKind, string> = {
  nascimento: "Nascimentos",
  casamento: "Casamentos",
  obito: "Óbitos",
};

export const RCPN_KIND_LABELS: Record<RcpnKind, string> = {
  nascimento: "Nascimento",
  casamento: "Casamento",
  obito: "Óbito",
};

/**
 * A kind's subdivision. The only one so far: the natimorto, an óbito
 * registered in the Livro C Auxiliar (Lei 6.015/1973, art. 53, § 1º:
 * "No caso de ter a criança nascido morta, será o registro feito no livro
 * 'C Auxiliar'"). Blank for every other registro.
 */
export type RcpnSubtype = "" | "natimorto";

export const RCPN_SUBTYPE_LABELS: Record<Exclude<RcpnSubtype, "">, string> = {
  natimorto: "Natimorto",
};

/** The book is the Livro C Auxiliar: "C AUX", "C-Auxiliar", "C Aux. 3"... */
export function isLivroCAuxiliar(book: string): boolean {
  const plain = book.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /(^|[^a-z])c\s*[-.]?\s*aux/i.test(plain);
}

/** Whose the person is in the registro. */
export type RcpnRole = "registrado" | "conjuge1" | "conjuge2" | "falecido";

export const RCPN_ROLE_LABELS: Record<RcpnRole, string> = {
  registrado: "Registrado",
  conjuge1: "Cônjuge",
  conjuge2: "Cônjuge",
  falecido: "Falecido",
};

export interface RcpnPerson {
  role: RcpnRole;
  name: string;
  /** The name adopted with the marriage, when there is one. */
  marriedName: string;
  motherName: string;
  fatherName: string;
  /** "YYYY-MM-DD", or "" when the source has none. */
  birthDate: string;
  /** The person's own profession as the registro states it. */
  profession: string;
  fatherProfession: string;
  motherProfession: string;
}

export interface RcpnRecord {
  kind: RcpnKind;
  /** "natimorto" for an óbito of the Livro C Auxiliar; "" otherwise. */
  subtype?: RcpnSubtype;
  /** The CNJ matrícula, digits only; "" when the source has none. */
  matricula: string;
  book: string;
  page: string;
  term: string;
  /** "YYYY-MM-DD": the day of the registro. */
  registeredOn: string;
  /** "YYYY-MM-DD": the marriage or the death, for those kinds. */
  eventOn: string;
  people: RcpnPerson[];
  /**
   * The rest of the registro, as the certidão prints it (decision of
   * 14/11/2026: "pegar os dados para ... imprimir a Certidão já pronta"):
   * certidão field key (core/rcpn/certidao.ts) → value. Absent or blank
   * fields stay for the person to fill from the book.
   */
  details?: Record<string, string>;
}

/** The CNJ matrícula has 32 digits (CNJ rules, now in the CNN). */
export const MATRICULA_DIGITS = 32;

export function matriculaDigits(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "");
}

export function isMatricula(digits: string): boolean {
  return digits.length === MATRICULA_DIGITS;
}

/**
 * What identifies a registro across imports: its matrícula when it has a
 * whole one, else its book, page and term. The second never collides with
 * the first (it carries letters).
 */
export function recordKey(record: RcpnRecord): string {
  if (isMatricula(record.matricula)) return record.matricula;
  return `L${record.book.trim()}|F${record.page.trim()}|T${record.term.trim()}`;
}

/** "1, 2, 3" read as a text cell: blank, trimmed, without inner runs. */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A date as the sources write it, to "YYYY-MM-DD": a Date (Access date
 * columns, kept at midnight UTC), "dd/mm/aaaa" (text columns, the XML
 * cargas), "aaaammdd" (the CPF inscription) or already ISO. Anything else,
 * or an impossible day, is "": never a guess.
 */
export function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    // A year typed wrong in the source ("988" for 1988) is not a date:
    // blank, to correct in the ficha, never a guess.
    const year = value.getUTCFullYear();
    if (year < 1800 || year > new Date().getUTCFullYear() + 1) return "";
    return `${year}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  const text = cleanText(value);
  const parts =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text)?.slice(1).reverse() ??
    /^(\d{4})-(\d{2})-(\d{2})/.exec(text)?.slice(1) ??
    /^(\d{4})(\d{2})(\d{2})$/.exec(text)?.slice(1);
  if (!parts) return "";
  const [y, m, d] = parts.map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    y < 1800 ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return "";
  }
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "YYYY-MM-DD" to "dd/mm/aaaa"; "" stays "". */
export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/**
 * The same registro read from two sources of one sending (the carga XML
 * and the registry system's database, decision of 14/11/2026): one
 * registro, each source filling what the other leaves blank. The sources
 * come in order of preference: the first one's value stays where both
 * have one. Repeats inside one source are kept as they are, so the
 * conference still shows them.
 */
export function mergeSources(sources: RcpnRecord[][]): RcpnRecord[] {
  const [first = [], ...rest] = sources;
  const out: RcpnRecord[] = first.map((r) => ({
    ...r,
    people: r.people.map((p) => ({ ...p })),
    details: { ...(r.details ?? {}) },
  }));
  for (const source of rest) {
    const byKey = new Map<string, RcpnRecord>();
    for (const r of out) {
      const key = `${r.kind}:${recordKey(r)}`;
      if (!byKey.has(key)) byKey.set(key, r);
    }
    for (const incoming of source) {
      const target = byKey.get(`${incoming.kind}:${recordKey(incoming)}`);
      if (!target) {
        out.push(incoming);
        continue;
      }
      fillBlanks(target, incoming);
    }
  }
  return out;
}

function fillBlanks(target: RcpnRecord, incoming: RcpnRecord): void {
  const columns = [
    "matricula",
    "book",
    "page",
    "term",
    "registeredOn",
    "eventOn",
  ] as const;
  for (const column of columns) {
    if (!target[column] && incoming[column]) target[column] = incoming[column];
  }
  if (!target.subtype && incoming.subtype) target.subtype = incoming.subtype;
  if (!target.details) target.details = {};
  const details = target.details;
  for (const [key, value] of Object.entries(incoming.details ?? {})) {
    if (value && !details[key]?.trim()) details[key] = value;
  }
  for (const person of incoming.people) {
    const same = target.people.find((p) => p.role === person.role);
    if (!same) {
      target.people.push({ ...person });
      continue;
    }
    for (const [key, value] of Object.entries(person) as [
      keyof RcpnPerson,
      string,
    ][]) {
      if (key !== "role" && value && !same[key]) {
        (same as unknown as Record<string, string>)[key] = value;
      }
    }
  }
}
