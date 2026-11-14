import {
  isMatricula,
  RCPN_KINDS,
  type RcpnKind,
  type RcpnPerson,
  type RcpnRecord,
  recordKey,
} from "./record.ts";

/**
 * What the office checks before a reading reaches the index (design,
 * decision 4): how many, of which period, what is missing, what repeats,
 * and, against the index as it is, what is new, what is the same and what
 * changed. A changed registro is only replaced when the office says so
 * (decision of 14/11/2026).
 */

export type ProblemKind =
  | "sem-nome"
  | "sem-nascimento"
  | "sem-mae"
  | "matricula-invalida"
  | "repetido";

export const PROBLEM_LABELS: Record<ProblemKind, string> = {
  "sem-nome": "Sem nome",
  "sem-nascimento": "Sem data de nascimento",
  "sem-mae": "Sem nome da mãe",
  "matricula-invalida": "Matrícula ausente ou fora do formato (32 dígitos)",
  repetido: "Repetido no próprio arquivo",
};

/** Problems that keep a registro out of the index unless the office says so. */
export const BLOCKING: readonly ProblemKind[] = ["sem-nome", "repetido"];

export function problemsOf(record: RcpnRecord): ProblemKind[] {
  const problems: ProblemKind[] = [];
  const people = record.people;
  if (people.length === 0 || people.some((p) => !p.name))
    problems.push("sem-nome");
  if (people.some((p) => !p.birthDate)) problems.push("sem-nascimento");
  if (people.some((p) => !p.motherName)) problems.push("sem-mae");
  if (!isMatricula(record.matricula)) problems.push("matricula-invalida");
  return problems;
}

export interface KindSummary {
  count: number;
  /** Óbitos only: how many are natimortos (Livro C Auxiliar). */
  natimortos: number;
  books: string[];
  firstYear: number | null;
  lastYear: number | null;
}

export type Comparison = "novo" | "igual" | "alterado";

export interface CheckedRecord {
  key: string;
  record: RcpnRecord;
  problems: ProblemKind[];
  comparison: Comparison;
  /** For "alterado": which fields differ from the index. */
  changes: string[];
  /** The same, with the value in the index and the one in the file. */
  details: ChangeDetail[];
}

export interface Conference {
  total: number;
  byKind: Record<RcpnKind, KindSummary>;
  checked: CheckedRecord[];
  counts: Record<Comparison, number> & {
    withProblems: number;
    blocked: number;
  };
}

const FIELD_LABELS: Record<keyof RcpnPerson, string> = {
  role: "papel",
  name: "nome",
  marriedName: "nome de casado",
  motherName: "mãe",
  fatherName: "pai",
  birthDate: "nascimento",
  profession: "profissão",
  fatherProfession: "profissão do pai",
  motherProfession: "profissão da mãe",
};

/** The fields a new reading changes in a registro already indexed. */
export interface ChangeDetail {
  label: string;
  before: string;
  after: string;
}

const RECORD_LABELS = {
  book: "livro",
  page: "folha",
  term: "termo",
  registeredOn: "data do registro",
  eventOn: "data do ato",
} as const;

/**
 * What a new reading changes in a registro already indexed, old and new
 * value side by side: the person decides whether to replace by seeing both.
 */
export function changeDetails(
  incoming: RcpnRecord,
  current: RcpnRecord,
): ChangeDetail[] {
  const details: ChangeDetail[] = [];
  for (const field of Object.keys(
    RECORD_LABELS,
  ) as (keyof typeof RECORD_LABELS)[]) {
    if (incoming[field] && incoming[field] !== current[field]) {
      details.push({
        label: RECORD_LABELS[field],
        before: current[field],
        after: incoming[field],
      });
    }
  }
  for (const person of incoming.people) {
    const before = current.people.find((p) => p.role === person.role);
    if (!before) {
      details.push({ label: "pessoas", before: "", after: person.name });
      continue;
    }
    for (const field of Object.keys(FIELD_LABELS) as (keyof RcpnPerson)[]) {
      if (field === "role") continue;
      // A blank in the new file never erases what the index knows: the
      // XML carga, for one, has no profession at all.
      if (person[field] && person[field] !== before[field]) {
        details.push({
          label: FIELD_LABELS[field],
          before: before[field],
          after: person[field],
        });
      }
    }
  }
  return details;
}

/** The labels of the fields a new reading changes. */
export function changedFields(
  incoming: RcpnRecord,
  current: RcpnRecord,
): string[] {
  return [...new Set(changeDetails(incoming, current).map((d) => d.label))];
}

function yearOf(iso: string): number | null {
  const year = Number(iso.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

export function conferenceOf(
  records: RcpnRecord[],
  /** The index as it is, by `recordKey`. */
  existing: ReadonlyMap<string, RcpnRecord>,
): Conference {
  const byKind = Object.fromEntries(
    RCPN_KINDS.map((kind) => [
      kind,
      {
        count: 0,
        natimortos: 0,
        books: [] as string[],
        firstYear: null,
        lastYear: null,
      },
    ]),
  ) as Record<RcpnKind, KindSummary>;
  const seen = new Map<string, number>();
  const checked: CheckedRecord[] = [];

  for (const record of records) {
    const key = `${record.kind}:${recordKey(record)}`;
    const summary = byKind[record.kind];
    summary.count++;
    if (record.subtype === "natimorto") summary.natimortos++;
    if (record.book && !summary.books.includes(record.book))
      summary.books.push(record.book);
    const year = yearOf(record.registeredOn);
    if (year !== null) {
      summary.firstYear =
        summary.firstYear === null ? year : Math.min(summary.firstYear, year);
      summary.lastYear =
        summary.lastYear === null ? year : Math.max(summary.lastYear, year);
    }
    const problems = problemsOf(record);
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const current = existing.get(key);
    const details = current ? changeDetails(record, current) : [];
    const changes = [...new Set(details.map((d) => d.label))];
    checked.push({
      key,
      record,
      problems,
      comparison: !current ? "novo" : changes.length > 0 ? "alterado" : "igual",
      changes,
      details,
    });
  }
  for (const item of checked) {
    if ((seen.get(item.key) ?? 0) > 1) item.problems.push("repetido");
  }
  for (const summary of Object.values(byKind)) {
    summary.books.sort((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true }),
    );
  }

  const counts = {
    novo: 0,
    igual: 0,
    alterado: 0,
    withProblems: 0,
    blocked: 0,
  };
  for (const item of checked) {
    counts[item.comparison]++;
    if (item.problems.length > 0) counts.withProblems++;
    if (item.problems.some((p) => BLOCKING.includes(p))) counts.blocked++;
  }
  return { total: records.length, byKind, checked, counts };
}

/**
 * What a publication writes: every new registro without a blocking
 * problem, plus the changed ones the office chose to replace. The same
 * ones are left alone.
 */
export function toPublish(
  conference: Conference,
  replace: ReadonlySet<string>,
): CheckedRecord[] {
  return conference.checked.filter((item) => {
    if (item.problems.some((p) => BLOCKING.includes(p))) return false;
    if (item.comparison === "novo") return true;
    return item.comparison === "alterado" && replace.has(item.key);
  });
}
