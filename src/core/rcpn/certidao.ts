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

const OBSERVATIONS: CertidaoField = {
  key: "observacoes",
  label: "OBSERVAÇÕES / AVERBAÇÕES",
  multiline: true,
  hint: "Transcreva as anotações e averbações do registro. Sem nenhuma, escreva o que a serventia costuma usar (por exemplo, 'Nada consta').",
};

const CPF: CertidaoField = {
  key: "cpf",
  label: "NÚMERO DE CPF",
  hint: `Sem CPF no registro, o modelo imprime "${NAO_CONSTA}".`,
};

export const CERTIDAO_MODELS: Record<RcpnKind, CertidaoModel> = {
  // Provimento nº 182, certidão de nascimento.
  nascimento: {
    title: "CERTIDÃO DE NASCIMENTO",
    fields: [
      { key: "nome", label: "NOME", required: true },
      { ...CPF, row: 1 },
      { key: "matricula", label: "MATRÍCULA", required: true, row: 1, span: 2 },
      {
        key: "dataNascimentoExtenso",
        label: "DATA DE NASCIMENTO",
        row: 2,
        span: 3,
      },
      { key: "nascimentoDia", label: "DIA", row: 2 },
      { key: "nascimentoMes", label: "MÊS", row: 2 },
      { key: "nascimentoAno", label: "ANO", row: 2 },
      { key: "hora", label: "HORÁRIO DE NASCIMENTO", row: 3 },
      {
        key: "naturalidade",
        label: "MUNICÍPIO DE NATURALIDADE",
        row: 3,
        span: 2,
      },
      { key: "naturalidadeUf", label: "UF", row: 3 },
      { key: "localNascimento", label: "LOCAL DE NASCIMENTO", row: 4, span: 2 },
      {
        key: "municipioNascimento",
        label: "MUNICÍPIO DE NASCIMENTO",
        row: 4,
        span: 2,
      },
      { key: "municipioNascimentoUf", label: "UF", row: 4 },
      { key: "sexo", label: "SEXO", row: 4 },
      { key: "genitor1", label: "NOME DO(A) GENITOR(A)", row: 5, span: 3 },
      {
        key: "genitor1Municipio",
        label: "MUNICÍPIO DE NASCIMENTO",
        row: 5,
        span: 2,
      },
      { key: "genitor1Uf", label: "UF", row: 5 },
      { key: "avos1", label: "AVÔ(Ó)(S) RESPECTIVO(S)" },
      { key: "genitor2", label: "NOME DO(A) GENITOR(A)", row: 6, span: 3 },
      {
        key: "genitor2Municipio",
        label: "MUNICÍPIO DE NASCIMENTO",
        row: 6,
        span: 2,
      },
      { key: "genitor2Uf", label: "UF", row: 6 },
      { key: "avos2", label: "AVÔ(Ó)(S) RESPECTIVO(S)" },
      {
        key: "gemeo",
        label: "GÊMEO",
        hint: `Nome e matrícula do(s) gêmeo(s); sem gêmeo, "${NAO_CONSTA}".`,
      },
      {
        key: "dataRegistroExtenso",
        label: "DATA DE REGISTRO",
        row: 7,
        span: 2,
      },
      { key: "dnv", label: "DNV", row: 7 },
      {
        key: "observacoes",
        label: "ANOTAÇÕES/AVERBAÇÕES",
        multiline: true,
        hint: "Transcreva as anotações e averbações do registro.",
      },
      {
        key: "anotacoesCadastro",
        label: "ANOTAÇÕES VOLUNTÁRIAS DE CADASTRO",
        multiline: true,
        hint: "Os documentos que a pessoa pediu para constar (RG, título de eleitor, CNS e outros), como no modelo.",
      },
    ],
  },
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
      OBSERVATIONS,
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
      OBSERVATIONS,
    ],
  },
};

const KIND_WORDS: Record<RcpnKind, string> = {
  nascimento: "NASCIMENTO",
  casamento: "CASAMENTO",
  obito: "ÓBITO",
};

/**
 * The certidão em inteiro teor (Provimento nº 182 model): name, CPF and
 * matrícula on top, then the registro transcribed word for word.
 */
function inteiroTeor(kind: RcpnKind): CertidaoModel {
  return {
    title: `CERTIDÃO EM INTEIRO TEOR DE ${KIND_WORDS[kind]}`,
    fields: [
      kind === "casamento"
        ? { key: "nomes", label: "NOMES", multiline: true, required: true }
        : { key: "nome", label: "NOME", required: true },
      { ...CPF, row: 1 },
      { key: "matricula", label: "MATRÍCULA", required: true, row: 1, span: 2 },
      {
        key: "teor",
        label: "INTEIRO TEOR",
        multiline: true,
        required: true,
        hint: "Transcreva o registro do livro, palavra por palavra, com as anotações e averbações.",
      },
    ],
  };
}

export function certidaoModel(
  kind: RcpnKind,
  form: CertidaoForm = "breve",
): CertidaoModel {
  return form === "inteiro-teor" ? inteiroTeor(kind) : CERTIDAO_MODELS[kind];
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

const parents = (p: RcpnPerson) =>
  [p.fatherName, p.motherName].filter(Boolean).join(" e ");

/** "10/08/2025" pieces: day, month (in words) and year, or blanks. */
function dateParts(iso: string): [string, string, string] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return ["", "", ""];
  return [match[3] ?? "", MONTHS[Number(match[2]) - 1] ?? "", match[1] ?? ""];
}

/**
 * What the index already knows, in the certidão's fields. The rest (hora,
 * local, avós, DNV, cause of death, the inteiro teor itself) is the
 * person's to fill from the book: the index does not keep it.
 */
export function prefillCertidao(
  record: RcpnRecord,
  form: CertidaoForm = "breve",
): Record<string, string> {
  const matricula = formatMatricula(record.matricula);
  const p = record.people[0];
  if (form === "inteiro-teor") {
    const names: Record<string, string> =
      record.kind === "casamento"
        ? {
            nomes: record.people
              .map((x) => x.name)
              .filter(Boolean)
              .join("\n"),
          }
        : { nome: p?.name ?? "" };
    return { ...names, cpf: NAO_CONSTA, matricula };
  }
  if (record.kind === "casamento") {
    const [a, b] = record.people;
    return {
      nomes: [a?.name, b?.name].filter(Boolean).join("\n"),
      matricula,
      conjuges: record.people
        .map((x) =>
          [
            x.name,
            x.birthDate && `nascido(a) em ${formatIsoDate(x.birthDate)}`,
            parents(x) && `filho(a) de ${parents(x)}`,
          ]
            .filter(Boolean)
            .join(", "),
        )
        .join("\n"),
      dataRegistroExtenso: dateInWords(record.registeredOn),
      dataRegistro: formatIsoDate(record.registeredOn),
      nomesAdotados: record.people
        .map((x) => x.marriedName)
        .filter(Boolean)
        .join("\n"),
    };
  }
  if (record.kind === "obito") {
    return {
      nome: p?.name ?? "",
      matricula,
      filiacaoResidencia: p ? parents(p) : "",
      dataFalecimento: formatIsoDate(record.eventOn),
    };
  }
  const [day, month, year] = dateParts(p?.birthDate ?? "");
  return {
    nome: p?.name ?? "",
    cpf: NAO_CONSTA,
    matricula,
    dataNascimentoExtenso: dateInWords(p?.birthDate ?? ""),
    nascimentoDia: day,
    nascimentoMes: month,
    nascimentoAno: year,
    // The model lists the mother's line first, then the father's.
    genitor1: p?.motherName ?? "",
    genitor2: p?.fatherName ?? "",
    gemeo: NAO_CONSTA,
    dataRegistroExtenso: dateInWords(record.registeredOn),
  };
}

/** Keeps only the model's fields, trimmed and bounded. */
export function cleanCertidaoFields(
  kind: RcpnKind,
  input: Record<string, unknown>,
  form: CertidaoForm = "breve",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of certidaoModel(kind, form).fields) {
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
  for (const field of certidaoModel(kind, form).fields) {
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
