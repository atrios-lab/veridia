import {
  cleanText,
  type RcpnKind,
  type RcpnPerson,
  type RcpnRecord,
  type RcpnRole,
  toIsoDate,
} from "./record.ts";

/**
 * The ficha of a registro (decision of 14/11/2026: the panel shows the
 * whole registro, separated by nascimento, casamento and óbito, and lets
 * it be corrected). Every field has a home:
 *
 * - `r.<column>`: the registro's own columns (book, page, term...);
 * - `p.<role>.<field>`: a person of the registro (name, filiação...);
 * - `d.<key>`: the rest, kept in `details`. Where a key is also a field
 *   of the certidão (core/rcpn/certidao.ts: `hora`, `dnv`, `avos1`...),
 *   it is the same value, so a correction here comes out on the
 *   certidão.
 *
 * The sections follow the order of the termo in the book (Lei nº
 * 6.015/1973, arts. 54, 70 and 80), not the screens of any system.
 */

export type FichaInput = "text" | "date" | "long";

export interface FichaField {
  key: string;
  label: string;
  input?: FichaInput;
  /** Shown beside it, half the row, when the screen is wide. */
  half?: boolean;
  hint?: string;
  /**
   * Shown, never changed in the panel (decision of 14/11/2026: "tudo é
   * editável, menos a matrícula"): the national number of the registro.
   */
  locked?: boolean;
}

export interface FichaSection {
  title: string;
  fields: FichaField[];
}

const RECORD_COLUMNS = [
  "matricula",
  "book",
  "page",
  "term",
  "registeredOn",
  "eventOn",
] as const;
type RecordColumn = (typeof RECORD_COLUMNS)[number];

const PERSON_FIELDS = [
  "name",
  "marriedName",
  "motherName",
  "fatherName",
  "birthDate",
  "profession",
  "fatherProfession",
  "motherProfession",
] as const;
type PersonField = (typeof PERSON_FIELDS)[number];

const DATE_COLUMNS = new Set(["registeredOn", "eventOn", "birthDate"]);

const f = (
  key: string,
  label: string,
  extra: Omit<FichaField, "key" | "label"> = {},
): FichaField => ({
  key,
  label,
  ...(DATE_COLUMNS.has(key.split(".").at(-1) ?? "")
    ? { input: "date" as const }
    : {}),
  ...extra,
});

const half = { half: true };
const long = { input: "long" as const };

/** Book, folha, termo and matrícula: the same in the three books. */
const registro = (extra: FichaField[]): FichaSection => ({
  title: "Registro",
  fields: [
    f("r.matricula", "Matrícula", {
      locked: true,
      hint: "32 dígitos: serventia, acervo, serviço, ano, tipo de livro, livro, folha, termo e dígito. A matrícula não se altera no painel.",
    }),
    f("r.book", "Livro", half),
    f("r.page", "Folha", half),
    f("r.term", "Termo", half),
    f("r.registeredOn", "Data do registro", half),
    ...extra,
  ],
});

const witnesses: FichaSection = {
  title: "Testemunhas",
  fields: [
    f("d.testemunha1", "Testemunha", half),
    f("d.testemunha1Qualificacao", "Qualificação", half),
    f("d.testemunha2", "Testemunha", half),
    f("d.testemunha2Qualificacao", "Qualificação", half),
    f("d.testemunhas", "Testemunhas, como estão no termo", long),
  ],
};

const notes = (extra: FichaField[] = []): FichaSection => ({
  title: "Anotações e averbações",
  fields: [
    f("d.observacoes", "Anotações e averbações", {
      ...long,
      hint: "Como estão à margem do termo, na ordem em que foram feitas.",
    }),
    ...extra,
  ],
});

/** A parent of the registrado, in the order the carga sends them. */
const genitor = (n: 1 | 2, nameKey: PersonField, job: PersonField) => ({
  title: `Filiação ${n}`,
  fields: [
    f(`p.registrado.${nameKey}`, "Nome"),
    f(`d.genitor${n}Nascimento`, "Data de nascimento", {
      ...half,
      input: "date",
    }),
    f(`d.genitor${n}Idade`, "Idade na data do registro", half),
    f(`p.registrado.${job}`, "Profissão", half),
    f(`d.genitor${n}Nacionalidade`, "Nacionalidade", half),
    f(`d.genitor${n}Municipio`, "Município de nascimento", half),
    f(`d.genitor${n}Uf`, "UF", half),
    f(`d.genitor${n}Endereco`, "Residência", long),
    f(`d.genitor${n}Documento`, "Documento", half),
  ],
});

/** A spouse, with the parents (Lei nº 6.015/1973, art. 70, 1º a 3º). */
const conjuge = (n: 1 | 2): FichaSection => {
  const p = `p.conjuge${n}`;
  return {
    title: `Cônjuge ${n}`,
    fields: [
      f(`${p}.name`, "Nome antes do casamento"),
      f(`${p}.marriedName`, "Nome adotado no casamento"),
      f(`${p}.birthDate`, "Data de nascimento", half),
      f(`d.conjuge${n}EstadoCivil`, "Estado civil anterior", half),
      f(`d.conjuge${n}Nacionalidade`, "Nacionalidade", half),
      f(`d.conjuge${n}Naturalidade`, "Naturalidade", half),
      f(`${p}.profession`, "Profissão", half),
      f(`d.conjuge${n}Cpf`, "CPF", half),
      f(`d.conjuge${n}Documento`, "Documento", half),
      f(`d.conjuge${n}Endereco`, "Residência", long),
      f(`${p}.fatherName`, "Filiação: pai ou genitor(a)", half),
      f(`${p}.fatherProfession`, "Profissão", half),
      f(`${p}.motherName`, "Filiação: mãe ou genitor(a)", half),
      f(`${p}.motherProfession`, "Profissão", half),
    ],
  };
};

export const FICHA: Record<RcpnKind, FichaSection[]> = {
  // Lei nº 6.015/1973, art. 54.
  nascimento: [
    registro([f("d.dnv", "DNV (Declaração de Nascido Vivo)", half)]),
    {
      title: "Registrado",
      fields: [
        f("p.registrado.name", "Nome"),
        f("d.sexo", "Sexo", half),
        f("p.registrado.birthDate", "Data de nascimento", half),
        f("d.hora", "Hora do nascimento", half),
        f("d.cpf", "CPF", half),
        f("d.localNascimento", "Local do nascimento"),
        f("d.municipioNascimento", "Município do nascimento", half),
        f("d.municipioNascimentoUf", "UF", half),
        f("d.naturalidade", "Naturalidade", {
          ...half,
          hint: "Município de nascimento ou de residência da mãe, à escolha do declarante (Lei nº 6.015/1973, art. 54, § 4º).",
        }),
        f("d.naturalidadeUf", "UF", half),
        f("d.nacionalidade", "Nacionalidade", half),
        f("d.cor", "Cor", half),
        f("d.gemeo", "Gêmeos", {
          hint: "Nome e matrícula do(s) irmão(s) gêmeo(s), quando houver.",
        }),
      ],
    },
    genitor(1, "motherName", "motherProfession"),
    genitor(2, "fatherName", "fatherProfession"),
    {
      title: "Avós",
      fields: [
        f("d.avos1", "Avós pela filiação 1"),
        f("d.avos2", "Avós pela filiação 2"),
      ],
    },
    {
      title: "Declarante",
      fields: [
        f("d.declarante", "Nome", half),
        f("d.declaranteQualificacao", "Qualificação", half),
      ],
    },
    witnesses,
    notes([
      f("d.anotacoesCadastro", "Anotações voluntárias de cadastro", long),
    ]),
  ],
  // Lei nº 6.015/1973, art. 70.
  casamento: [
    registro([
      f("r.eventOn", "Data do casamento", half),
      f("d.horaCasamento", "Hora", half),
      f("d.regime", "Regime de bens"),
      f("d.localCasamento", "Local da celebração"),
      f("d.juiz", "Celebrante (juiz de paz)", half),
      f("d.habilitacao", "Processo de habilitação", half),
      f("d.edital", "Edital de proclamas", half),
      f("d.dataHabilitacao", "Data da habilitação", { ...half, input: "date" }),
    ]),
    conjuge(1),
    conjuge(2),
    witnesses,
    notes(),
  ],
  // Lei nº 6.015/1973, art. 80.
  obito: [
    registro([
      f("r.eventOn", "Data do falecimento", half),
      f("d.horaFalecimento", "Hora", half),
      f("d.localFalecimento", "Local do falecimento"),
      f("d.municipioFalecimento", "Município do falecimento", half),
      f("d.municipioFalecimentoUf", "UF", half),
      f("d.causaMorte", "Causa da morte", long),
      f("d.tipoMorte", "Tipo de morte", half),
      f("d.numeroDO", "Declaração de Óbito (DO)", half),
      f("d.medico", "Médico que atestou (ou testemunhas)", half),
      f("d.medicoDocumento", "Número do documento (CRM/UF)", half),
      f("d.sepultamento", "Local de sepultamento ou cremação"),
      f("d.sepultamentoMunicipio", "Município", half),
      f("d.sepultamentoUf", "UF", half),
    ]),
    {
      title: "Falecido",
      fields: [
        f("p.falecido.name", "Nome"),
        f("d.sexo", "Sexo", half),
        f("d.cor", "Cor", half),
        f("p.falecido.birthDate", "Data de nascimento", half),
        f("d.estadoCivil", "Estado civil", half),
        f("d.idade", "Idade", half),
        f("d.cpf", "CPF", half),
        f("d.conjuge", "Último cônjuge ou convivente", half),
        f("p.falecido.profession", "Profissão", half),
        f("d.naturalidade", "Naturalidade", half),
        f("d.nacionalidade", "Nacionalidade", half),
        f("d.documento", "Documentos (RG, CPF)"),
        f("d.endereco", "Residência", long),
        f("d.eleitor", "Era eleitor", half),
        f("d.tituloEleitor", "Título, zona e seção", half),
        f("d.beneficio", "Benefício do INSS", half),
        f("d.bens", "Deixou bens", half),
        f("d.testamento", "Deixou testamento", half),
        f("d.filhos", "Filhos", long),
      ],
    },
    {
      title: "Filiação",
      fields: [
        f("p.falecido.fatherName", "Pai ou genitor(a)", half),
        f("p.falecido.fatherProfession", "Profissão", half),
        f("p.falecido.motherName", "Mãe ou genitor(a)", half),
        f("p.falecido.motherProfession", "Profissão", half),
      ],
    },
    {
      title: "Declarante",
      fields: [
        f("d.declarante", "Nome", half),
        f("d.declaranteQualificacao", "Qualificação", half),
      ],
    },
    witnesses,
    notes(),
  ],
};

export const fichaFields = (kind: RcpnKind): FichaField[] =>
  FICHA[kind].flatMap((s) => s.fields);

function parse(
  key: string,
):
  | { at: "r"; column: RecordColumn }
  | { at: "p"; role: RcpnRole; field: PersonField }
  | { at: "d"; detail: string }
  | null {
  const [at, a, b] = key.split(".");
  if (at === "r" && (RECORD_COLUMNS as readonly string[]).includes(a ?? "")) {
    return { at, column: a as RecordColumn };
  }
  if (
    at === "p" &&
    a &&
    (PERSON_FIELDS as readonly string[]).includes(b ?? "")
  ) {
    return { at, role: a as RcpnRole, field: b as PersonField };
  }
  if (at === "d" && a) return { at, detail: a };
  return null;
}

/** What the field holds now; dates in "YYYY-MM-DD". */
export function fichaValue(record: RcpnRecord, key: string): string {
  const where = parse(key);
  if (!where) return "";
  if (where.at === "r") return record[where.column] ?? "";
  if (where.at === "p") {
    return (
      record.people.find((p) => p.role === where.role)?.[where.field] ?? ""
    );
  }
  return record.details?.[where.detail] ?? "";
}

const BLANK_PERSON = (role: RcpnRole): RcpnPerson => ({
  role,
  name: "",
  marriedName: "",
  motherName: "",
  fatherName: "",
  birthDate: "",
  profession: "",
  fatherProfession: "",
  motherProfession: "",
});

/** "dd/mm/aaaa" or ISO to ISO; "" stays "", anything else is refused. */
function dateOf(value: string): string | null {
  if (!value.trim()) return "";
  const iso = toIsoDate(value);
  return iso || null;
}

/** Long text keeps its lines; any other field is one clean line. */
function clean(field: FichaField, value: string): string {
  if (field.input === "long") {
    return value
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20000);
  }
  return cleanText(value).slice(0, 500);
}

export interface FichaChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

/**
 * The registro with the ficha's values in place, and what changed. Only
 * the fields of the kind's ficha are taken; a date that is not one is
 * refused with its label, never stored half-read.
 */
export function applyFicha(
  record: RcpnRecord,
  values: Record<string, string>,
): { record: RcpnRecord; changes: FichaChange[]; problems: string[] } {
  const next: RcpnRecord = {
    ...record,
    people: record.people.map((p) => ({ ...p })),
    details: { ...(record.details ?? {}) },
  };
  const changes: FichaChange[] = [];
  const problems: string[] = [];
  for (const field of fichaFields(record.kind)) {
    if (field.locked || !(field.key in values)) continue;
    const where = parse(field.key);
    if (!where) continue;
    let value = clean(field, values[field.key] ?? "");
    if (field.input === "date") {
      const date = dateOf(value);
      if (date === null) {
        problems.push(`${field.label}: data inválida (use dd/mm/aaaa).`);
        continue;
      }
      value = date;
    }
    const before = fichaValue(record, field.key);
    if (before === value) continue;
    changes.push({ key: field.key, label: field.label, before, after: value });
    if (where.at === "r") {
      next[where.column] = value;
    } else if (where.at === "p") {
      let person = next.people.find((p) => p.role === where.role);
      if (!person) {
        person = BLANK_PERSON(where.role);
        next.people.push(person);
      }
      person[where.field] = value;
    } else if (next.details) {
      if (value) next.details[where.detail] = value;
      else delete next.details[where.detail];
    }
  }
  return { record: next, changes, problems };
}

/** How many fields of the ficha are filled, for the screen's summary. */
export function fichaFilled(record: RcpnRecord): {
  filled: number;
  total: number;
} {
  const fields = fichaFields(record.kind);
  return {
    filled: fields.filter((field) => fichaValue(record, field.key).trim())
      .length,
    total: fields.length,
  };
}
