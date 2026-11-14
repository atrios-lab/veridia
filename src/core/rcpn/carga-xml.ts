import {
  cleanText,
  matriculaDigits,
  type RcpnRecord,
  toIsoDate,
} from "./record.ts";

/**
 * The XML carga (`CARGAREGISTROS`, the CRC/SIRC layout: analysis of
 * 14/11/2026, files NA_INC_*, CA_INC_*, OB_INC_*): nascimento, casamento
 * and óbito. The carga has no book, folha or termo of its own: they are
 * read from the matrícula, which carries them (type of book, book, folha,
 * termo). Besides the index, the fields the certidão prints are kept
 * (`details`), so it comes out ready; a code the carga leaves as
 * "IGNORADO" or blank is left for the person to fill from the book.
 */

type Node = Record<string, unknown>;

const asList = (value: unknown): Node[] =>
  Array.isArray(value)
    ? (value as Node[])
    : value && typeof value === "object"
      ? [value as Node]
      : [];

const text = (node: Node | undefined, key: string) => cleanText(node?.[key]);

function isFemale(sex: string): boolean {
  return /^F/i.test(sex);
}

export interface CargaReading {
  records: RcpnRecord[];
  /** Movements the reader does not know yet, by tag. */
  unknownMovements: string[];
}

export function isCargaXml(tree: unknown): boolean {
  return Boolean(
    tree && typeof tree === "object" && "CARGAREGISTROS" in (tree as Node),
  );
}

/** The book's letter by the matrícula's type digit (normas do CNJ). */
const BOOK_TYPES: Record<string, string> = {
  "1": "A",
  "2": "B",
  "3": "B Auxiliar",
  "4": "C",
  "5": "C Auxiliar",
  "6": "D",
  "7": "E",
};

/**
 * Book, folha and termo from a 32-digit matrícula: CNS (6), acervo (2),
 * serviço (2), ano (4), tipo do livro (1), livro (5), folha (3), termo (7),
 * dígito (2). Blank when the matrícula is not whole.
 */
export function placeOf(matricula: string): {
  book: string;
  page: string;
  term: string;
  bookType: string;
} {
  if (!/^\d{32}$/.test(matricula)) {
    return { book: "", page: "", term: "", bookType: "" };
  }
  const type = matricula.slice(14, 15);
  const letter = BOOK_TYPES[type] ?? type;
  return {
    book: `${letter}-${Number(matricula.slice(15, 20))}`,
    page: String(Number(matricula.slice(20, 23))),
    term: String(Number(matricula.slice(23, 30))),
    bookType: type,
  };
}

const SEX: Record<string, string> = { M: "MASCULINO", F: "FEMININO" };
const REGIMES: Record<string, string> = {
  COMUNHAO_PARCIAL: "Comunhão parcial de bens",
  COMUNHAO_UNIVERSAL: "Comunhão universal de bens",
  SEPARACAO_BENS: "Separação de bens",
  PARTICIPACAO_FINAL_AQUESTOS: "Participação final nos aquestos",
};
const CIVIL: Record<string, string> = {
  SOLTEIRO: "solteiro(a)",
  CASADO: "casado(a)",
  VIUVO: "viúvo(a)",
  DIVORCIADO: "divorciado(a)",
  SEPARADO: "separado(a)",
};
const AGE_UNIT: Record<string, string> = { A: "anos", M: "meses", D: "dias" };

/** A code the carga leaves undecided: nothing to print. */
const known = (value: string) =>
  /^(IGNORAD[OA]|OUTROS?|I)$/i.test(value) ? "" : value;

const joined = (parts: string[], sep = ", ") => parts.filter(Boolean).join(sep);

function filled(details: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value.trim() !== ""),
  );
}

const hour = (value: string) => (/^\d{1,2}:\d{2}$/.test(value) ? value : "");

/** The documents of one owner ("FALECIDO", "CONJUGE1"...), as "RG 123". */
function documentsOf(r: Node, owner: string): string {
  return asList(r.DOCUMENTOS)
    .filter((d) => text(d, "DONO") === owner && text(d, "NUMERO"))
    .map((d) =>
      joined(
        [
          text(d, "TIPO_DOC").replace(/_/g, " "),
          text(d, "NUMERO"),
          joined([text(d, "CODIGOORGAOEMISSOR"), text(d, "UF_EMISSAO")], "/"),
        ],
        " ",
      ),
    )
    .join("; ");
}

function nascimento(r: Node): RcpnRecord {
  const parents = asList(r.FILIACAONASCIMENTO);
  // The carga lists the parents with their sex, not as "mother" and
  // "father": the first woman is read as the mother and the other parent
  // as the second filiação, whatever the sex.
  const motherIndex = parents.findIndex((p) => isFemale(text(p, "SEXO")));
  const mother = motherIndex >= 0 ? parents[motherIndex] : undefined;
  const other = parents.find((_, i) => i !== motherIndex);
  const matricula = matriculaDigits(r.MATRICULA);
  const place = placeOf(matricula);
  const time = hour(text(r, "HORANASCIMENTO"));
  return {
    kind: "nascimento",
    matricula,
    book: place.book,
    page: place.page,
    term: place.term,
    registeredOn: toIsoDate(r.DATAREGISTRO),
    eventOn: "",
    people: [
      {
        role: "registrado",
        name: text(r, "NOMEREGISTRADO"),
        marriedName: "",
        motherName: text(mother, "NOME"),
        fatherName: text(other, "NOME"),
        birthDate: toIsoDate(r.DATANASCIMENTO),
        profession: "",
        fatherProfession: "",
        motherProfession: "",
      },
    ],
    details: filled({
      cpf: text(r, "CPFREGISTRADO"),
      hora: time && `${time} horas`,
      sexo: SEX[text(r, "SEXO").toUpperCase()] ?? "",
      dnv: text(r, "DNV"),
      gemeo: text(r, "POSSUIGEMEOS").toUpperCase() === "S" ? "SIM" : "",
      genitor1Municipio: text(mother, "TEXTOLIVREMUNICIPIONAT"),
      genitor2Municipio: text(other, "TEXTOLIVREMUNICIPIONAT"),
      observacoes: text(r, "OBSERVACOES"),
    }),
  };
}

function casamento(r: Node): RcpnRecord {
  const matricula = matriculaDigits(r.MATRICULA);
  const place = placeOf(matricula);
  const spouse = (n: "1" | "2") => ({
    name: text(r, `NOMECONJUGE${n}`),
    married: text(r, `NOVONOMECONJUGE${n}`),
    father: text(r, `NOMEPAICONJUGE${n}`),
    mother: text(r, `NOMEMAECONJUGE${n}`),
    birth: toIsoDate(r[`DATANASCIMENTOCONJUGE${n}`]),
    natural: text(r, `TEXTOLIVREMUNNATCONJUGE${n}`),
  });
  const one = spouse("1");
  const two = spouse("2");
  const line = (s: typeof one) =>
    joined([
      s.name,
      s.birth && `nascido(a) em ${s.birth.split("-").reverse().join("/")}`,
      s.natural && `natural de ${s.natural}`,
      joined([s.father, s.mother], " e ") &&
        `filho(a) de ${joined([s.father, s.mother], " e ")}`,
    ]);
  const person = (role: "conjuge1" | "conjuge2", s: typeof one) => ({
    role,
    name: s.name,
    marriedName: s.married,
    motherName: s.mother,
    fatherName: s.father,
    birthDate: s.birth,
    profession: "",
    fatherProfession: "",
    motherProfession: "",
  });
  return {
    kind: "casamento",
    matricula,
    book: place.book,
    page: place.page,
    term: place.term,
    registeredOn: toIsoDate(r.DATAREGISTRO),
    eventOn: toIsoDate(r.DATACASAMENTO),
    people: [person("conjuge1", one), person("conjuge2", two)],
    details: filled({
      conjuges: [line(one), line(two)].filter(Boolean).join("\n"),
      regime: REGIMES[text(r, "REGIMECASAMENTO").toUpperCase()] ?? "",
      nomesAdotados: [one.married, two.married].filter(Boolean).join("\n"),
      observacoes: text(r, "OBSERVACOES"),
    }),
  };
}

function obito(r: Node): RcpnRecord {
  const matricula = matriculaDigits(r.MATRICULA);
  const place = placeOf(matricula);
  const age = text(r, "IDADE");
  const unit = AGE_UNIT[text(r, "IDADE_DIAS_MESES_ANOS").toUpperCase()] ?? "";
  const voter = text(r, "ELEITOR").toUpperCase();
  const address = joined([
    text(r, "LOGRADOURO"),
    text(r, "NUMEROLOGRADOURO"),
    text(r, "COMPLEMENTOLOGRADOURO"),
    text(r, "BAIRRO"),
  ]);
  const deathPlace = joined([
    text(r, "LUGARFALECIMENTO"),
    joined([
      text(r, "LOGRADOUROOBITO"),
      text(r, "NUMEROLOGRADOUROOBITO"),
      text(r, "COMPLEMENTOLOGRADOUROOBITO"),
      text(r, "BAIRROOBITO"),
    ]),
  ]);
  const causes = [
    "CAUSAMORTEANTECEDENTES_A",
    "CAUSAMORTEANTECEDENTES_B",
    "CAUSAMORTEANTECEDENTES_C",
    "CAUSAMORTEANTECEDENTES_D",
    "CAUSAMORTEOUTRASCOND_A",
    "CAUSAMORTEOUTRASCOND_B",
  ]
    .map((tag) => text(r, tag))
    .filter(Boolean);
  const cpf = text(r, "CPFFALECIDO");
  return {
    kind: "obito",
    subtype: place.bookType === "5" ? "natimorto" : "",
    matricula,
    book: place.book,
    page: place.page,
    term: place.term,
    registeredOn: toIsoDate(r.DATAREGISTRO),
    eventOn: toIsoDate(r.DATAOBITO),
    people: [
      {
        role: "falecido",
        name: text(r, "NOMEFALECIDO"),
        marriedName: "",
        motherName: text(r, "NOMEMAE"),
        fatherName: text(r, "NOMEPAI"),
        birthDate: toIsoDate(r.DATANASCIMENTOFALECIDO),
        profession: "",
        fatherProfession: "",
        motherProfession: "",
      },
    ],
    details: filled({
      sexo: SEX[text(r, "SEXO").toUpperCase()] ?? "",
      cor: known(text(r, "CORPELE")),
      estadoCivilIdade: joined([
        CIVIL[text(r, "ESTADOCIVIL").toUpperCase()] ?? "",
        age && unit ? `${age} ${unit}` : "",
      ]),
      naturalidade: text(r, "TEXTOLIVREMUNICIPIONAT"),
      documento: joined(
        [cpf && `CPF ${cpf}`, documentsOf(r, "FALECIDO")],
        "; ",
      ),
      eleitor: voter === "S" ? "SIM" : voter === "N" ? "NÃO" : "",
      filiacaoResidencia: joined(
        [joined([text(r, "NOMEPAI"), text(r, "NOMEMAE")], " e "), address],
        "\n",
      ),
      horaFalecimento: hour(text(r, "HORAOBITO")),
      localFalecimento: deathPlace,
      causaMorte: causes.join("; "),
      sepultamento: text(r, "LUGARSEPULTAMENTOCEMITERIO"),
      declarante: text(r, "NOMEDECLARANTE"),
      medico: joined([
        text(r, "NOMEATESTANTEPRIMARIO"),
        text(r, "CRMATESTANTEPRIMARIO") &&
          `CRM ${text(r, "CRMATESTANTEPRIMARIO")}`,
      ]),
      observacoes: text(r, "OBSERVACOES"),
    }),
  };
}

const READERS: [string, string, (r: Node) => RcpnRecord][] = [
  ["MOVIMENTONASCIMENTO", "REGISTRONASCIMENTO", nascimento],
  ["MOVIMENTOCASAMENTO", "REGISTROCASAMENTO", casamento],
  ["MOVIMENTOOBITO", "REGISTROOBITO", obito],
];

export function readCargaXml(tree: unknown): CargaReading {
  const root = (tree as Node | undefined)?.CARGAREGISTROS as Node | undefined;
  const records: RcpnRecord[] = [];
  const unknownMovements: string[] = [];
  if (!root) return { records, unknownMovements };

  for (const [tag, value] of Object.entries(root)) {
    if (!tag.startsWith("MOVIMENTO")) continue;
    const reader = READERS.find(([movement]) => tag.startsWith(movement));
    if (!reader) {
      unknownMovements.push(tag);
      continue;
    }
    const [, registro, read] = reader;
    for (const movement of asList(value)) {
      for (const [inner, registros] of Object.entries(movement)) {
        // Inclusions only: a rectification or exclusion movement is not
        // a registro to index.
        if (!inner.startsWith(registro) || !inner.endsWith("INCLUSAO"))
          continue;
        for (const r of asList(registros)) records.push(read(r));
      }
    }
  }
  return { records, unknownMovements };
}
