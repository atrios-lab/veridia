import { integerInWords } from "../money/extenso.ts";
import {
  formatIsoDate,
  isMatricula,
  type RcpnKind,
  type RcpnPerson,
  type RcpnRecord,
} from "./record.ts";

/**
 * The certidões of the Registro Civil (decision of 14/11/2026: "já saia no
 * padrão com matrícula"). The certidão de nascimento and the certidão em
 * inteiro teor follow the models of the Provimento nº 182 the office sent
 * on 14/11/2026 (the ones every registry office uses): the same labels, in
 * the same rows. Casamento and óbito keep the models of the office's
 * system until their Provimento 182 models arrive. The index prefills what
 * it knows; the person completes the rest from the book and confirms it was
 * checked against it. A field the index does not have stays blank.
 */

export interface CertidaoField {
  key: string;
  label: string;
  multiline?: boolean;
  /** Short help shown under the field. */
  hint?: string;
  required?: boolean;
  /**
   * Fields with the same row sit side by side, as in the model; `span` is
   * the share of the row each one takes. No row: the field takes the line.
   */
  row?: number;
  span?: number;
  /**
   * Drawn as the model draws the name and the matrícula: centered, with
   * the small label above and no box ("name": in capitals).
   */
  heading?: "name" | "matricula";
  /** The value centered in its box (the CPF of the models). */
  center?: boolean;
  /**
   * "Só deve aparecer quando existir" (Provimento nº 182/2024, Anexos IV
   * a VI): the row leaves the certidão when all its fields are blank.
   */
  optional?: boolean;
}

export interface CertidaoModel {
  title: string;
  fields: CertidaoField[];
}

/** Breve relato (the usual certidão) or inteiro teor (the whole registro). */
export const CERTIDAO_FORMS = ["breve", "inteiro-teor"] as const;
export type CertidaoForm = (typeof CERTIDAO_FORMS)[number];
export const CERTIDAO_FORM_LABELS: Record<CertidaoForm, string> = {
  breve: "Breve relato",
  "inteiro-teor": "Inteiro teor",
};

export const isCertidaoForm = (value: unknown): value is CertidaoForm =>
  (CERTIDAO_FORMS as readonly unknown[]).includes(value);

/** What the models print when the registro does not have the data. */
export const NAO_CONSTA = "NÃO CONSTA";

const NAME: CertidaoField = {
  key: "nome",
  label: "Nome",
  required: true,
  heading: "name",
  hint: "Nome atual, como o modelo imprime: em caixa alta.",
};

const CPF: CertidaoField = {
  key: "cpf",
  label: "Número do CPF",
  center: true,
  hint: `Sem CPF no registro, o modelo imprime "${NAO_CONSTA}".`,
};

const MATRICULA: CertidaoField = {
  key: "matricula",
  label: "Matrícula",
  required: true,
  heading: "matricula",
};

const NOTES: CertidaoField = {
  key: "observacoes",
  label: "Anotações/Averbações",
  multiline: true,
  hint: "As anotações e averbações registrais, na ordem em que foram feitas.",
};

const VOLUNTARY: CertidaoField = {
  key: "anotacoesCadastro",
  label: "Anotações voluntárias de cadastro",
  multiline: true,
  optional: true,
  hint: "Só aparece quando existir: os documentos que a pessoa pediu para constar (RG, título de eleitor, CNS e outros).",
};

/** Day, month and year boxes after a date in words, as in the models. */
const dayMonthYear = (prefix: string, row: number): CertidaoField[] => [
  { key: `${prefix}Dia`, label: "Dia", row },
  { key: `${prefix}Mes`, label: "Mês", row },
  { key: `${prefix}Ano`, label: "Ano", row },
];

const spouse = (n: 1 | 2, row: number): CertidaoField[] => [
  {
    key: `conjuge${n}Nome`,
    label: `${n}º Cônjuge`,
    row,
    span: 6,
    hint: "Nome no momento da habilitação.",
  },
  ...dayMonthYear(`conjuge${n}Nascimento`, row),
  {
    key: `conjuge${n}Nacionalidade`,
    label: "Nacionalidade",
    row: row + 1,
    span: 2,
  },
  {
    key: `conjuge${n}EstadoCivil`,
    label: "Estado Civil",
    row: row + 1,
    span: 2,
  },
  {
    key: `conjuge${n}Naturalidade`,
    label: "Município da naturalidade",
    row: row + 1,
    span: 4,
  },
  { key: `conjuge${n}Uf`, label: "UF", row: row + 1 },
  {
    key: `conjuge${n}Genitores`,
    label: "Genitor(es)",
    hint: "Separe o nome dos genitores com ;",
  },
  {
    key: `conjuge${n}NomeAdotado`,
    label: "Nome que o passou a utilizar",
    hint: "O nome que passou a utilizar após o casamento.",
  },
];

/**
 * The models of the Provimento nº 182/2024 of the CNJ (Anexos IV, V and
 * VI, sent by the office on 14/11/2026): the same fields, labels and
 * order, which the panel never changes (decision of 14/11/2026: "o
 * modelo da certidão tem que ser o nacional, não pode modificar,
 * inclusive os campos"). Only the values come from the registro.
 */
export const CERTIDAO_MODELS: Record<RcpnKind, CertidaoModel> = {
  // Anexo IV: certidão de nascimento.
  nascimento: {
    title: "CERTIDÃO DE NASCIMENTO",
    fields: [
      NAME,
      CPF,
      MATRICULA,
      {
        key: "dataNascimentoExtenso",
        label: "Data de nascimento",
        row: 1,
        span: 7,
      },
      ...dayMonthYear("nascimento", 1),
      { key: "hora", label: "Horário de nascimento", row: 2, span: 2 },
      {
        key: "naturalidade",
        label: "Município da naturalidade",
        row: 2,
        span: 7,
      },
      { key: "naturalidadeUf", label: "UF", row: 2 },
      { key: "localNascimento", label: "Local de nascimento", row: 3, span: 3 },
      {
        key: "municipioNascimento",
        label: "Município de nascimento",
        row: 3,
        span: 3,
      },
      { key: "municipioNascimentoUf", label: "UF", row: 3 },
      { key: "sexo", label: "Sexo", row: 3, span: 2 },
      { key: "genitor1", label: "Nome do(a) Genitor(a)", row: 4, span: 4 },
      {
        key: "genitor1Municipio",
        label: "Município de nascimento",
        row: 4,
        span: 2,
      },
      { key: "genitor1Uf", label: "UF", row: 4, span: 2 },
      {
        key: "avos1",
        label: "Avô(ó)(s) respectivo(s)",
        hint: "Separe o nome dos avós com ;",
      },
      {
        key: "genitor2",
        label: "Genitor(a)",
        row: 5,
        span: 4,
        optional: true,
        hint: "Só aparece quando existir.",
      },
      {
        key: "genitor2Municipio",
        label: "Município de nascimento",
        row: 5,
        span: 2,
        optional: true,
      },
      { key: "genitor2Uf", label: "UF", row: 5, span: 2, optional: true },
      {
        key: "avos2",
        label: "Avô(ó)(s) respectivo(s)",
        optional: true,
        hint: "Só aparece quando existir o genitor respectivo. Separe com ;",
      },
      {
        key: "gemeo",
        label: "Gêmeo",
        optional: true,
        hint: "Só aparece quando existir: nome e matrícula de cada gêmeo.",
      },
      {
        key: "dataRegistroExtenso",
        label: "Data de registro",
        row: 6,
        span: 3,
      },
      { key: "dnv", label: "DNV", row: 6, span: 2 },
      NOTES,
      VOLUNTARY,
    ],
  },
  // Anexo V: certidão de casamento.
  casamento: {
    title: "CERTIDÃO DE CASAMENTO",
    fields: [
      {
        key: "nomes",
        label: "Nome atual dos cônjuges",
        multiline: true,
        required: true,
        row: 1,
        span: 3,
        hint: "Um por linha: o nome que cada um passou a utilizar após o casamento.",
      },
      {
        key: "cpfs",
        label: "Número do CPF",
        multiline: true,
        center: true,
        row: 1,
        span: 2,
        hint: "Um por linha, na ordem dos nomes.",
      },
      MATRICULA,
      ...spouse(1, 2),
      ...spouse(2, 4),
      {
        key: "dataCelebracaoExtenso",
        label:
          "Data da celebração do casamento ou, se for o caso de conversão da união estável, data do registro.",
        row: 6,
        span: 6,
      },
      ...dayMonthYear("celebracao", 6),
      { key: "regime", label: "Regime de Bens" },
      {
        key: "dataRegistroExtenso",
        label: "Data de registro do casamento",
        row: 7,
        span: 6,
      },
      ...dayMonthYear("registro", 7),
      NOTES,
      VOLUNTARY,
    ],
  },
  // Anexo VI: certidão de óbito ou natimorto.
  obito: {
    title: "CERTIDÃO DE ÓBITO",
    fields: [
      NAME,
      CPF,
      MATRICULA,
      {
        key: "dataFalecimentoExtenso",
        label: "Data do falecimento",
        row: 1,
        span: 5,
      },
      ...dayMonthYear("falecimento", 1),
      {
        key: "horaFalecimento",
        label: "Horário do falecimento",
        row: 1,
        span: 2,
      },
      {
        key: "localFalecimento",
        label: "Local de falecimento",
        row: 2,
        span: 5,
      },
      {
        key: "municipioFalecimento",
        label: "Município de falecimento",
        row: 2,
        span: 3,
      },
      { key: "municipioFalecimentoUf", label: "UF", row: 2 },
      { key: "sexo", label: "Sexo", row: 3, span: 2 },
      { key: "estadoCivil", label: "Estado civil", row: 3, span: 2 },
      {
        key: "conjuge",
        label: "Nome do último cônjuge ou convivente",
        row: 3,
        span: 4,
      },
      { key: "idade", label: "Idade", row: 4 },
      ...dayMonthYear("nascimento", 4),
      {
        key: "naturalidade",
        label: "Município da naturalidade",
        row: 4,
        span: 4,
      },
      { key: "naturalidadeUf", label: "UF", row: 4 },
      {
        key: "genitores",
        label: "Nome do(a)s Genitor(es)",
        hint: "Separe o nome dos genitores com ;",
      },
      {
        key: "causaMorte",
        label: "Causa da morte",
        multiline: true,
        hint: "Separe a descrição das causas com ;",
      },
      {
        key: "medico",
        label:
          "Nome do médico que atestou o óbito ou, se for o caso, das testemunhas",
        row: 5,
        span: 3,
      },
      { key: "medicoDocumento", label: "Número do documento", row: 5, span: 2 },
      {
        key: "sepultamento",
        label: "Local de sepultamento / Cremação",
        row: 6,
        span: 3,
      },
      { key: "sepultamentoMunicipio", label: "Município", row: 6, span: 3 },
      { key: "sepultamentoUf", label: "UF", row: 6 },
      {
        key: "dataRegistroExtenso",
        label: "Data de registro",
        row: 7,
        span: 6,
      },
      ...dayMonthYear("registro", 7),
      { key: "declarante", label: "Nome do Declarante", row: 8, span: 3 },
      { key: "bens", label: "Existência de bens", row: 8, span: 2 },
      {
        key: "filhos",
        label: "Existência de filhos",
        row: 8,
        span: 3,
        multiline: true,
        hint: 'Use "não" quando negativo; ou relacione o nome e a idade de cada filho.',
      },
      NOTES,
      VOLUNTARY,
    ],
  },
};

/**
 * The models the panel used before the Provimento nº 182/2024 ones for
 * casamento and óbito: a certidão issued with them is reprinted and
 * corrected in its own model, never with its data lost.
 */
const LEGACY_MODELS: Partial<Record<RcpnKind, CertidaoModel>> = {
  casamento: {
    title: "CERTIDÃO DE CASAMENTO",
    fields: [
      { key: "nomes", label: "NOMES", multiline: true, required: true },
      { key: "matricula", label: "MATRÍCULA", required: true },
      {
        key: "conjuges",
        label:
          "NOMES COMPLETOS DE SOLTEIROS, DATAS E LOCAIS DE NASCIMENTO, NACIONALIDADE E FILIAÇÕES DOS CÔNJUGES",
        multiline: true,
      },
      {
        key: "dataRegistroExtenso",
        label: "DATA DE REGISTRO DO CASAMENTO (POR EXTENSO)",
        row: 1,
        span: 3,
      },
      { key: "dataRegistro", label: "DIA MÊS ANO", row: 1 },
      { key: "regime", label: "REGIME DE BENS DO CASAMENTO" },
      {
        key: "nomesAdotados",
        label:
          "NOME QUE CADA UM DOS CÔNJUGES PASSOU A UTILIZAR (QUANDO HOUVER ALTERAÇÃO)",
        multiline: true,
      },
      {
        key: "observacoes",
        label: "OBSERVAÇÕES / AVERBAÇÕES",
        multiline: true,
      },
    ],
  },
  obito: {
    title: "CERTIDÃO DE ÓBITO",
    fields: [
      { key: "nome", label: "NOME", required: true },
      { key: "matricula", label: "MATRÍCULA", required: true },
      { key: "sexo", label: "SEXO", row: 1 },
      { key: "cor", label: "COR", row: 1 },
      {
        key: "estadoCivilIdade",
        label: "ESTADO CIVIL E IDADE",
        row: 1,
        span: 2,
      },
      { key: "naturalidade", label: "NATURALIDADE", row: 2 },
      { key: "documento", label: "DOCUMENTO DE IDENTIFICAÇÃO", row: 2 },
      { key: "eleitor", label: "ELEITOR", row: 2 },
      {
        key: "filiacaoResidencia",
        label: "FILIAÇÃO E RESIDÊNCIA",
        multiline: true,
      },
      {
        key: "dataHoraFalecimento",
        label: "DATA E HORA DE FALECIMENTO",
        row: 3,
        span: 3,
      },
      { key: "dataFalecimento", label: "DIA MÊS ANO", row: 3 },
      { key: "localFalecimento", label: "LOCAL DE FALECIMENTO" },
      { key: "causaMorte", label: "CAUSA DA MORTE", multiline: true },
      {
        key: "sepultamento",
        label: "SEPULTAMENTO/CREMAÇÃO MUNICÍPIO E CEMITÉRIO SE CONHECIDO",
      },
      { key: "declarante", label: "DECLARANTE" },
      {
        key: "medico",
        label: "NOME E NÚMERO DO DOCUMENTO DO MÉDICO QUE ATESTOU O ÓBITO",
      },
      {
        key: "observacoes",
        label: "OBSERVAÇÕES / AVERBAÇÕES",
        multiline: true,
      },
    ],
  },
};

/** Keys only the old models had: a certidão with them was issued in one. */
const LEGACY_KEYS: Partial<Record<RcpnKind, string[]>> = {
  casamento: ["conjuges", "nomesAdotados", "dataRegistro"],
  obito: ["filiacaoResidencia", "estadoCivilIdade", "dataHoraFalecimento"],
};

const KIND_WORDS: Record<RcpnKind, string> = {
  nascimento: "NASCIMENTO",
  casamento: "CASAMENTO",
  obito: "ÓBITO",
};

/**
 * Anexo VII, certidão em inteiro teor: name, CPF and matrícula on top,
 * then the registro typed word for word.
 */
function inteiroTeor(kind: RcpnKind): CertidaoModel {
  return {
    title: `CERTIDÃO EM INTEIRO TEOR DE ${KIND_WORDS[kind]}`,
    fields: [
      kind === "casamento"
        ? {
            key: "nomes",
            label: "Nome",
            multiline: true,
            required: true,
            heading: "name",
            hint: "Nome atual de cada cônjuge, um por linha.",
          }
        : NAME,
      CPF,
      MATRICULA,
      {
        key: "teor",
        label: "Texto do registro",
        multiline: true,
        required: true,
        hint: "Transcreva o registro do livro, palavra por palavra, com as anotações e averbações.",
      },
    ],
  };
}

/**
 * The model of the certidão. With the stored `fields` of one already
 * issued, the model it was issued in (an old casamento or óbito keeps
 * its own).
 */
export function certidaoModel(
  kind: RcpnKind,
  form: CertidaoForm = "breve",
  fields?: Record<string, unknown>,
): CertidaoModel {
  if (form === "inteiro-teor") return inteiroTeor(kind);
  const legacy = LEGACY_MODELS[kind];
  if (legacy && fields && LEGACY_KEYS[kind]?.some((key) => key in fields)) {
    return legacy;
  }
  return CERTIDAO_MODELS[kind];
}

/**
 * The custas lines of the office's own Provimento 182 model (RN), offered
 * as the first text of the emolumentos field: the office changes it when
 * the act is not exempt.
 */
export const RN_FEES_NOTE =
  "Foram recolhidas para o referido ato as custas constantes dos selos digitais que podem ser conferidas em https://selodigital.tjrn.jus.br/. A obrigatoriedade das custas nos atos ficou dispensada por meio da Portaria Conjunta nº 10 - TJRN de 04/03/2022 em seu parágrafo único. Isento de emolumentos, conforme Art. 10 do Provimento 07/2026 da CGJ/TJRN.";

/** The matrícula in its nine blocks: 6 2 2 4 1 5 3 7 2 digits. */
export function formatMatricula(digits: string): string {
  if (!isMatricula(digits)) return digits;
  const sizes = [6, 2, 2, 4, 1, 5, 3, 7, 2];
  const parts: string[] = [];
  let at = 0;
  for (const size of sizes) {
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  return parts.join(" ");
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2025-08-10" → "dez de agosto de dois mil e vinte e cinco"; "" stays "". */
export function dateInWords(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const dayWords = day === 1 ? "primeiro" : integerInWords(day);
  return `${dayWords} de ${MONTHS[month - 1]} de ${integerInWords(year)}`;
}

/** The genitors as the models ask: separated by ";". */
const genitors = (p: RcpnPerson | undefined) =>
  [p?.fatherName, p?.motherName].filter(Boolean).join("; ");

/** "10/08/2025" pieces: day, month and year in numbers, or blanks. */
function dateParts(iso: string): [string, string, string] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return ["", "", ""];
  return [match[3] ?? "", match[2] ?? "", match[1] ?? ""];
}

/** The date in words and in day, month and year boxes, under `prefix`. */
function dated(
  extenso: string,
  prefix: string,
  iso: string,
): Record<string, string> {
  const [day, month, year] = dateParts(iso);
  const out: Record<string, string> = {};
  if (extenso) out[extenso] = dateInWords(iso);
  if (prefix) {
    out[`${prefix}Dia`] = day;
    out[`${prefix}Mes`] = month;
    out[`${prefix}Ano`] = year;
  }
  return out;
}

/** "Natal/RN" → ["Natal", "RN"]; a place without "/UF" stays whole. */
function placeAndState(text: string): [string, string] {
  const match = /^(.*\S)\s*[/-]\s*([A-Z]{2})$/.exec(text.trim());
  return match ? [match[1] ?? "", match[2] ?? ""] : [text.trim(), ""];
}

/** "07:30" → "07:30 horas", as the models write the time. */
const hours = (time: string) =>
  /^\d{1,2}:\d{2}$/.test(time.trim()) ? `${time.trim()} horas` : time;

/**
 * What the index already knows, in the certidão's fields. The rest is the
 * person's to fill from the book.
 */
export function prefillCertidao(
  record: RcpnRecord,
  form: CertidaoForm = "breve",
): Record<string, string> {
  const base = prefillFromIndex(record, form);
  // What the book sent (the whole registro): every field of the model it
  // has, so the certidão comes out ready (decision of 14/11/2026). The
  // index's own values and a "NÃO CONSTA" give way to the book's.
  const keys = new Set(
    certidaoModel(record.kind, form).fields.map((f) => f.key),
  );
  for (const [key, value] of Object.entries(record.details ?? {})) {
    if (!keys.has(key) || !value.trim()) continue;
    if (!base[key]?.trim() || base[key] === NAO_CONSTA) base[key] = value;
  }
  return base;
}

function prefillFromIndex(
  record: RcpnRecord,
  form: CertidaoForm,
): Record<string, string> {
  const matricula = formatMatricula(record.matricula);
  const d = record.details ?? {};
  const p = record.people[0];
  const currentName = (x: RcpnPerson | undefined) =>
    (x?.marriedName || x?.name || "").toUpperCase();
  if (form === "inteiro-teor") {
    const names: Record<string, string> =
      record.kind === "casamento"
        ? {
            nomes: record.people.map(currentName).filter(Boolean).join("\n"),
          }
        : { nome: currentName(p) };
    return { ...names, cpf: d.cpf || NAO_CONSTA, matricula };
  }
  if (record.kind === "casamento") {
    const [a, b] = record.people;
    const spouse = (n: 1 | 2, x: RcpnPerson | undefined) => {
      const [place, state] = placeAndState(d[`conjuge${n}Naturalidade`] ?? "");
      return {
        [`conjuge${n}Nome`]: x?.name ?? "",
        ...dated("", `conjuge${n}Nascimento`, x?.birthDate ?? ""),
        [`conjuge${n}Naturalidade`]: place,
        [`conjuge${n}Uf`]: state,
        [`conjuge${n}Genitores`]: genitors(x),
        [`conjuge${n}NomeAdotado`]: x?.marriedName || x?.name || "",
      };
    };
    const out: Record<string, string> = {
      nomes: [currentName(a), currentName(b)].filter(Boolean).join("\n"),
      cpfs: [d.conjuge1Cpf || NAO_CONSTA, d.conjuge2Cpf || NAO_CONSTA].join(
        "\n",
      ),
      matricula,
      ...spouse(1, a),
      ...spouse(2, b),
      ...dated("dataCelebracaoExtenso", "celebracao", record.eventOn),
      ...dated("dataRegistroExtenso", "registro", record.registeredOn),
    };
    return out;
  }
  if (record.kind === "obito") {
    const [place, state] = placeAndState(d.naturalidade ?? "");
    // A registro read before the Anexo VI fields kept "casado(a), 80 anos".
    const [oldCivil = "", oldAge = ""] = (d.estadoCivilIdade ?? "").split(", ");
    const [cemetery, cemeteryState] = placeAndState(d.sepultamento ?? "");
    return {
      nome: currentName(p),
      cpf: d.cpf || NAO_CONSTA,
      matricula,
      ...dated("dataFalecimentoExtenso", "falecimento", record.eventOn),
      horaFalecimento: hours(d.horaFalecimento ?? ""),
      estadoCivil: d.estadoCivil || oldCivil,
      idade: d.idade || oldAge,
      ...dated("", "nascimento", p?.birthDate ?? ""),
      naturalidade: place,
      naturalidadeUf: state,
      genitores: genitors(p),
      sepultamento: cemetery,
      sepultamentoUf: cemeteryState,
      ...dated("dataRegistroExtenso", "registro", record.registeredOn),
    };
  }
  return {
    nome: currentName(p),
    cpf: d.cpf || NAO_CONSTA,
    matricula,
    ...dated("dataNascimentoExtenso", "nascimento", p?.birthDate ?? ""),
    // The model lists the first genitor's line, then the second's.
    genitor1: p?.motherName ?? "",
    genitor2: p?.fatherName ?? "",
    ...dated("dataRegistroExtenso", "", record.registeredOn),
  };
}

/** Keeps only the model's fields, trimmed and bounded. */
export function cleanCertidaoFields(
  kind: RcpnKind,
  input: Record<string, unknown>,
  form: CertidaoForm = "breve",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of certidaoModel(kind, form, input).fields) {
    const value = String(input[field.key] ?? "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, field.key === "teor" ? 20000 : field.multiline ? 5000 : 500);
    out[field.key] = value;
  }
  return out;
}

/** What still keeps a certidão from being issued, in plain words. */
export function certidaoProblems(
  kind: RcpnKind,
  fields: Record<string, string>,
  form: CertidaoForm = "breve",
): string[] {
  const problems: string[] = [];
  for (const field of certidaoModel(kind, form, fields).fields) {
    if (field.required && !fields[field.key]?.trim()) {
      problems.push(`Preencha ${field.label.toLowerCase()}.`);
    }
  }
  const digits = (fields.matricula ?? "").replace(/\D/g, "");
  if (fields.matricula && !isMatricula(digits)) {
    problems.push("A matrícula precisa ter 32 dígitos.");
  }
  return problems;
}
