import {
  addDays as addCalendarDays,
  type IsoDate,
} from "../scheduling/calendar.ts";
import { cleanText, formatIsoDate, toIsoDate } from "./record.ts";

/**
 * The habilitação para o casamento (decision of 14/11/2026: "analise tudo
 * que mandei do outro sistema e faça melhor, mais fácil e mais elegante").
 * The office's old system keeps one template per case (analfabeto,
 * procurador, divorciado, conversão...), each repeating the same data; here
 * the data is typed once, as fields, and the case is a choice in them. Every
 * document of the processo (`habilitacao-docs.ts`) comes out of these
 * fields.
 *
 * The law, as in force (read 14/11/2026):
 *
 * - Código Civil, arts. 1.517 (16 anos, com autorização), 1.520 (nunca
 *   antes da idade núbil, Lei nº 13.811/2019), 1.521 e 1.523 (impedimentos
 *   e causas suspensivas), 1.525 (requerimento e documentos), 1.526 a 1.532
 *   (processo, oposição, certificado, eficácia de 90 dias), 1.640 e 1.641
 *   (regime de bens);
 * - Lei nº 6.015/1973, art. 67 (redação da Lei nº 14.382/2022: publicidade
 *   eletrônica e certificado em até 5 dias), art. 69 (dispensa), art. 70-A
 *   (conversão de união estável) e art. 71 (casamento religioso);
 * - Código Nacional de Normas (Provimento CNJ nº 149/2023), art. 122 (o
 *   edital contém tão somente nome, estado civil, filiação, cidade e
 *   circunscrição do domicílio), art. 531 (material informativo) e
 *   arts. 549 a 552 (conversão).
 *
 * The nubentes are "1º" and "2º", never "noivo" and "noiva": the
 * habilitação is the same for two people of any sex (Resolução CNJ nº
 * 175/2013; CNN, art. 554).
 */

export const HABILITACAO_KINDS = ["civil", "religioso", "conversao"] as const;
export type HabilitacaoKind = (typeof HABILITACAO_KINDS)[number];

export const HABILITACAO_KIND_LABELS: Record<HabilitacaoKind, string> = {
  civil: "Casamento civil",
  religioso: "Casamento religioso com efeito civil",
  conversao: "Conversão de união estável em casamento",
};

export const REGIMES = [
  "comunhao-parcial",
  "comunhao-universal",
  "separacao-convencional",
  "separacao-obrigatoria",
  "participacao-aquestos",
] as const;
export type Regime = (typeof REGIMES)[number];

export const REGIME_LABELS: Record<Regime, string> = {
  "comunhao-parcial": "comunhão parcial de bens",
  "comunhao-universal": "comunhão universal de bens",
  "separacao-convencional": "separação convencional de bens",
  "separacao-obrigatoria": "separação obrigatória de bens",
  "participacao-aquestos": "participação final nos aquestos",
};

/** Why the separação is obrigatória: the three cases of CC, art. 1.641. */
export const SEPARACAO_MOTIVOS = {
  "causa-suspensiva":
    "casamento com inobservância de causa suspensiva (Código Civil, art. 1.641, I)",
  "maior-70": "nubente maior de 70 anos (Código Civil, art. 1.641, II)",
  "suprimento-judicial":
    "casamento que dependeu de suprimento judicial (Código Civil, art. 1.641, III)",
} as const;

const ESTADO_CIVIL = {
  solteiro: ["solteiro", "solteira", "solteiro(a)"],
  divorciado: ["divorciado", "divorciada", "divorciado(a)"],
  viuvo: ["viúvo", "viúva", "viúvo(a)"],
  anulado: [
    "com casamento anterior anulado",
    "com casamento anterior anulado",
    "com casamento anterior anulado",
  ],
} as const;
export type EstadoCivil = keyof typeof ESTADO_CIVIL;

export type HabilitacaoInput = "text" | "date" | "long" | "select";

export interface HabilitacaoField {
  key: string;
  label: string;
  input?: HabilitacaoInput;
  options?: { value: string; label: string }[];
  half?: boolean;
  hint?: string;
  /** Shown only for these kinds of processo. */
  only?: HabilitacaoKind[];
}

export interface HabilitacaoSection {
  title: string;
  hint?: string;
  fields: HabilitacaoField[];
}

const yesNo = [
  { value: "", label: "Sabe e pode assinar" },
  { value: "sim", label: "Não sabe ou não pode assinar" },
];

function nubente(n: 1 | 2): HabilitacaoSection {
  const p = `n${n}.`;
  return {
    title: `${n}º nubente`,
    fields: [
      { key: `${p}nome`, label: "Nome completo" },
      {
        key: `${p}nomeApos`,
        label: "Nome que passará a usar",
        hint: "Em branco, continua o mesmo. Qualquer dos nubentes pode acrescentar o sobrenome do outro (Código Civil, art. 1.565, § 1º).",
      },
      {
        key: `${p}sexo`,
        label: "Sexo",
        input: "select",
        half: true,
        options: [
          { value: "", label: "Não informar" },
          { value: "F", label: "Feminino" },
          { value: "M", label: "Masculino" },
        ],
        hint: "Só para concordar as palavras do texto (solteiro ou solteira).",
      },
      {
        key: `${p}estadoCivil`,
        label: "Estado civil",
        input: "select",
        half: true,
        options: [
          { value: "solteiro", label: "Solteiro(a)" },
          { value: "divorciado", label: "Divorciado(a)" },
          { value: "viuvo", label: "Viúvo(a)" },
          { value: "anulado", label: "Casamento anterior anulado" },
        ],
      },
      { key: `${p}nascimento`, label: "Data de nascimento", input: "date" },
      { key: `${p}nacionalidade`, label: "Nacionalidade", half: true },
      {
        key: `${p}naturalidade`,
        label: "Naturalidade",
        half: true,
        hint: "Município e UF.",
      },
      { key: `${p}profissao`, label: "Profissão", half: true },
      { key: `${p}cpf`, label: "CPF", half: true },
      {
        key: `${p}documento`,
        label: "Documento de identidade",
        hint: "Tipo, número e órgão.",
      },
      {
        key: `${p}endereco`,
        label: "Residência",
        hint: "Rua, número, bairro.",
      },
      {
        key: `${p}domicilio`,
        label: "Cidade e circunscrição do domicílio",
        hint: "É o que o edital publica (CNN, art. 122). Ex.: Ielmo Marinho/RN.",
      },
      { key: `${p}filiacao1`, label: "Filiação", half: true },
      { key: `${p}filiacao2`, label: "Filiação", half: true },
      {
        key: `${p}pais`,
        label: "Estado civil, domicílio e residência dos pais",
        input: "long",
        hint: "Se forem conhecidos (Código Civil, art. 1.525, IV).",
      },
      {
        key: `${p}dissolucao`,
        label: "Casamento anterior",
        input: "long",
        hint: "Só se divorciado(a), viúvo(a) ou com casamento anulado: o cônjuge anterior e o documento que prova o fim (certidão de óbito, sentença ou registro do divórcio; Código Civil, art. 1.525, V).",
      },
      {
        key: `${p}autorizacao`,
        label: "Autorização para casar",
        input: "long",
        hint: "Só entre 16 e 18 anos: quem autoriza, por escrito, ou a decisão judicial que supre (Código Civil, arts. 1.517 e 1.519).",
      },
      {
        key: `${p}assina`,
        label: "Assinatura",
        input: "select",
        half: true,
        options: yesNo,
      },
      {
        key: `${p}rogo`,
        label: "Quem assina a rogo",
        half: true,
        hint: "Se não sabe ou não pode assinar: nome de quem assina por ele(a), além da impressão digital.",
      },
      {
        key: `${p}procurador`,
        label: "Procurador",
        input: "long",
        hint: "Só se for representado(a): nome, qualificação e a procuração (Código Civil, art. 1.525). Na conversão de união estável, procuração pública de até 30 dias (Lei nº 6.015/1973, art. 70-A, § 2º).",
      },
    ],
  };
}

function testemunha(n: 1 | 2): HabilitacaoField[] {
  const p = `t${n}.`;
  return [
    { key: `${p}nome`, label: `${n}ª testemunha: nome` },
    { key: `${p}nacionalidade`, label: "Nacionalidade", half: true },
    { key: `${p}estadoCivil`, label: "Estado civil", half: true },
    { key: `${p}profissao`, label: "Profissão", half: true },
    { key: `${p}documento`, label: "Documento", half: true },
    { key: `${p}endereco`, label: "Residência" },
  ];
}

export const HABILITACAO_SECTIONS: HabilitacaoSection[] = [
  {
    title: "Processo",
    fields: [
      {
        key: "tipo",
        label: "Tipo",
        input: "select",
        options: HABILITACAO_KINDS.map((k) => ({
          value: k,
          label: HABILITACAO_KIND_LABELS[k],
        })),
      },
      {
        key: "requeridoEm",
        label: "Data do requerimento",
        input: "date",
        half: true,
      },
    ],
  },
  nubente(1),
  nubente(2),
  {
    title: "Regime de bens",
    hint: "O oficial esclarece os regimes aos nubentes (Código Civil, art. 1.528). Sem pacto, vale a comunhão parcial (art. 1.640).",
    fields: [
      {
        key: "regime",
        label: "Regime",
        input: "select",
        options: REGIMES.map((r) => ({
          value: r,
          label: REGIME_LABELS[r].replace(/^./, (c) => c.toUpperCase()),
        })),
      },
      {
        key: "pacto",
        label: "Pacto antenupcial",
        input: "long",
        hint: "Tabelionato, livro, folha e data da escritura. Obrigatório para regime diferente da comunhão parcial (Código Civil, arts. 1.640, parágrafo único, e 1.653).",
      },
      {
        key: "motivoSeparacao",
        label: "Por que a separação é obrigatória",
        input: "select",
        options: [
          { value: "", label: "Não se aplica" },
          ...Object.entries(SEPARACAO_MOTIVOS).map(([value, label]) => ({
            value,
            label: label.replace(/ \(Código Civil.*$/, ""),
          })),
        ],
      },
    ],
  },
  {
    title: "Testemunhas da habilitação",
    hint: "Duas pessoas maiores, parentes ou não, que conhecem os nubentes e afirmam não haver impedimento (Código Civil, art. 1.525, III).",
    fields: [...testemunha(1), ...testemunha(2)],
  },
  {
    title: "Documentos apresentados",
    fields: [
      {
        key: "documentos",
        label: "Documentos",
        input: "long",
        hint: "Um por linha: certidões de nascimento ou casamento atualizadas, documentos de identidade, comprovantes de residência, sentença ou certidão do casamento anterior.",
      },
    ],
  },
  {
    title: "Edital e certificado",
    fields: [
      {
        key: "editalEm",
        label: "Edital publicado em",
        input: "date",
        half: true,
        hint: "Preenchido ao publicar no site por aqui.",
      },
      {
        key: "certificadoEm",
        label: "Certificado extraído em",
        input: "date",
        half: true,
        hint: "Até 5 dias depois da publicação (Lei nº 6.015/1973, art. 67, § 1º).",
      },
    ],
  },
  {
    title: "Celebração",
    hint: "No dia, hora e lugar pedidos pelos nubentes e designados pelo oficial (Lei nº 6.015/1973, art. 67, § 7º).",
    fields: [
      {
        key: "celebracaoData",
        label: "Data",
        input: "date",
        half: true,
        only: ["civil", "religioso"],
      },
      {
        key: "celebracaoHora",
        label: "Hora",
        half: true,
        only: ["civil", "religioso"],
      },
      {
        key: "celebracaoLocal",
        label: "Local",
        hint: "No religioso: o templo e o culto.",
        only: ["civil", "religioso"],
      },
      {
        key: "celebrante",
        label: "Celebrante",
        hint: "Juiz de paz ou, no religioso, a autoridade ou o ministro.",
        only: ["civil", "religioso"],
      },
      {
        key: "uniaoInicio",
        label: "Início da união estável",
        input: "date",
        only: ["conversao"],
        hint: "Só com o procedimento de certificação eletrônica feito antes; sem ele, o assento não traz a data (Lei nº 6.015/1973, art. 70-A, § 6º).",
      },
    ],
  },
  {
    title: "Observações",
    fields: [{ key: "observacoes", label: "Observações", input: "long" }],
  },
];

export const HABILITACAO_FIELDS: HabilitacaoField[] =
  HABILITACAO_SECTIONS.flatMap((s) => s.fields);

const FIELD_BY_KEY = new Map(HABILITACAO_FIELDS.map((f) => [f.key, f]));

export type HabilitacaoValues = Record<string, string>;

export function kindOf(values: HabilitacaoValues): HabilitacaoKind {
  const kind = values.tipo as HabilitacaoKind;
  return HABILITACAO_KINDS.includes(kind) ? kind : "civil";
}

/** Typed text as stored: long text keeps its lines; dates in ISO. */
function clean(field: HabilitacaoField, raw: string): string | null {
  if (field.input === "long") {
    return raw
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 5000);
  }
  const text = cleanText(raw).slice(0, 500);
  if (field.input === "date") {
    if (!text) return "";
    return toIsoDate(text) || null;
  }
  if (field.input === "select") {
    const options = field.options ?? [];
    return options.some((o) => o.value === text)
      ? text
      : (options[0]?.value ?? "");
  }
  return text;
}

export interface HabilitacaoChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

/** The label a field carries in the history, with the person it is of. */
export function fieldLabel(key: string): string {
  const field = FIELD_BY_KEY.get(key);
  if (!field) return key;
  const who = /^n([12])\./.exec(key)?.[1];
  if (who) return `${who}º nubente: ${field.label.toLowerCase()}`;
  if (/^t[12]\./.test(key) && !field.label.includes("testemunha")) {
    return `${key[1]}ª testemunha: ${field.label.toLowerCase()}`;
  }
  return field.label;
}

/**
 * The typed form applied to what is stored: each field cleaned, each change
 * with its before and after (for the history), each unreadable date said.
 * A field the form did not send stays as it was.
 */
export function applyHabilitacao(
  current: HabilitacaoValues,
  typed: Record<string, string>,
): {
  values: HabilitacaoValues;
  changes: HabilitacaoChange[];
  problems: string[];
} {
  const values: HabilitacaoValues = { ...current };
  const changes: HabilitacaoChange[] = [];
  const problems: string[] = [];
  for (const field of HABILITACAO_FIELDS) {
    if (!(field.key in typed)) continue;
    const value = clean(field, typed[field.key] ?? "");
    if (value === null) {
      problems.push(
        `${fieldLabel(field.key)}: data inválida (use dd/mm/aaaa).`,
      );
      continue;
    }
    const before = current[field.key] ?? "";
    if (before === value) continue;
    changes.push({
      key: field.key,
      label: fieldLabel(field.key),
      before,
      after: value,
    });
    if (value) values[field.key] = value;
    else delete values[field.key];
  }
  if (!values.tipo) values.tipo = "civil";
  return { values, changes, problems };
}

/** How a stored value reads on screen: dates as dd/mm/aaaa, choices by name. */
export function shownValue(key: string, value: string): string {
  if (!value) return "";
  const field = FIELD_BY_KEY.get(key);
  if (field?.input === "date") return formatIsoDate(value) || value;
  if (field?.input === "select") {
    return field.options?.find((o) => o.value === value)?.label ?? value;
  }
  return value;
}

const DAY = 24 * 60 * 60 * 1000;

/** The calendar day `days` after `iso` (the calendar module's own sum). */
export function addDays(iso: string, days: number): string {
  return addCalendarDays(iso as IsoDate, days);
}

/** Whole years between two ISO dates (the age on `on`). */
export function ageOn(birth: string, on: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !/^\d{4}-\d{2}-\d{2}$/.test(on))
    return null;
  let age = Number(on.slice(0, 4)) - Number(birth.slice(0, 4));
  if (on.slice(5) < birth.slice(5)) age--;
  return age;
}

/** The certificado comes out within 5 days of the publication (LRP, art. 67, § 1º). */
export const CERTIFICADO_DAYS = 5;
/** The habilitação is good for 90 days from the certificado (CC, art. 1.532). */
export const EFICACIA_DAYS = 90;

export type HabilitacaoStatus =
  | "preparo"
  | "edital"
  | "habilitados"
  | "vencida"
  | "celebrado"
  | "cancelada";

export const STATUS_LABELS: Record<HabilitacaoStatus, string> = {
  preparo: "Em preparo",
  edital: "Edital publicado",
  habilitados: "Habilitados",
  vencida: "Habilitação vencida",
  celebrado: "Celebrado",
  cancelada: "Cancelada",
};

export interface HabilitacaoTimeline {
  status: HabilitacaoStatus;
  /** Last day to extract the certificado, while it is not out. */
  certificadoAte?: string;
  /** Last day of the habilitação's efficacy. */
  validaAte?: string;
  /** Days left until `validaAte` (or the certificado's limit). */
  diasRestantes?: number;
}

/**
 * Where the processo is and what is running against it. Calendar days: the
 * Registro Civil works every day (LRP, art. 8º, parágrafo único), and the
 * business-day counting of art. 9º, § 1º, is for the other registros.
 */
export function timelineOf(
  values: HabilitacaoValues,
  today: string,
  canceled = false,
): HabilitacaoTimeline {
  if (canceled) return { status: "cancelada" };
  const kind = kindOf(values);
  const days = (until: string) =>
    Math.round(
      (Date.parse(`${until}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
        DAY,
    );
  const celebrated = values.celebracaoData;
  if (celebrated && celebrated <= today && kind !== "conversao") {
    return { status: "celebrado" };
  }
  if (values.certificadoEm) {
    const validaAte = addDays(values.certificadoEm, EFICACIA_DAYS);
    return {
      status: today > validaAte ? "vencida" : "habilitados",
      validaAte,
      diasRestantes: days(validaAte),
    };
  }
  if (values.editalEm) {
    const certificadoAte = addDays(values.editalEm, CERTIFICADO_DAYS);
    return {
      status: "edital",
      certificadoAte,
      diasRestantes: days(certificadoAte),
    };
  }
  return { status: "preparo" };
}

/** "solteira", "solteiro" or "solteiro(a)", as the person declared the sex. */
export function estadoCivilText(estado: string, sexo: string): string {
  const forms = ESTADO_CIVIL[estado as EstadoCivil];
  if (!forms) return "";
  return forms[sexo === "M" ? 0 : sexo === "F" ? 1 : 2];
}

/** "filho(a) de A e de B", agreeing with the declared sex. */
export function filiacaoText(values: HabilitacaoValues, n: 1 | 2): string {
  const parents = [values[`n${n}.filiacao1`], values[`n${n}.filiacao2`]].filter(
    (p): p is string => Boolean(p?.trim()),
  );
  if (parents.length === 0) return "";
  const sexo = values[`n${n}.sexo`];
  const word = sexo === "M" ? "filho" : sexo === "F" ? "filha" : "filho(a)";
  return `${word} de ${parents.join(" e de ")}`;
}

export interface HabilitacaoReview {
  /** What stops the certificado until it is solved. */
  problems: string[];
  /** What the oficial must look at, without stopping anything. */
  warnings: string[];
}

/**
 * The checks the law asks before the certificado (CC, arts. 1.525 a 1.531).
 * Never a guess: only what the typed data shows.
 */
export function reviewHabilitacao(
  values: HabilitacaoValues,
  today: string,
): HabilitacaoReview {
  const problems: string[] = [];
  const warnings: string[] = [];
  const kind = kindOf(values);
  const on = values.requeridoEm || today;
  for (const n of [1, 2] as const) {
    const who = `${n}º nubente`;
    const v = (k: string) => (values[`n${n}.${k}`] ?? "").trim();
    if (!v("nome")) {
      problems.push(`${who}: falta o nome.`);
      continue;
    }
    if (!v("estadoCivil")) problems.push(`${who}: falta o estado civil.`);
    if (!v("domicilio"))
      problems.push(`${who}: falta a cidade do domicílio, que vai no edital.`);
    const age = ageOn(v("nascimento"), on);
    if (age === null) {
      problems.push(`${who}: falta a data de nascimento.`);
    } else if (age < 16) {
      problems.push(
        `${who}: tem ${age} anos. Ninguém pode casar antes dos 16 (Código Civil, art. 1.520, com a Lei nº 13.811/2019).`,
      );
    } else if (age < 18 && !v("autorizacao")) {
      problems.push(
        `${who}: tem ${age} anos e precisa da autorização dos pais ou representantes, ou do suprimento judicial (Código Civil, arts. 1.517 e 1.519).`,
      );
    }
    if (
      age !== null &&
      age >= 70 &&
      values.regime !== "separacao-obrigatoria"
    ) {
      warnings.push(
        `${who}: tem mais de 70 anos. A lei impõe a separação obrigatória (Código Civil, art. 1.641, II), que o STF admite afastar por escritura pública (Tema 1.236). Confira o pacto.`,
      );
    }
    const estado = v("estadoCivil");
    if (estado && estado !== "solteiro" && !v("dissolucao")) {
      problems.push(
        `${who}: informe o casamento anterior e o documento que prova o fim dele (Código Civil, art. 1.525, V).`,
      );
    }
    if (estado === "viuvo") {
      warnings.push(
        `${who}: viúvo(a) com filho do cônjuge falecido deve ter feito o inventário e a partilha; se não, há causa suspensiva (Código Civil, art. 1.523, I).`,
      );
    }
    if (estado === "divorciado") {
      warnings.push(
        `${who}: divorciado(a) sem partilha homologada tem causa suspensiva (Código Civil, art. 1.523, III).`,
      );
    }
    if (v("assina") === "sim" && !v("rogo")) {
      problems.push(
        `${who}: não sabe ou não pode assinar; informe quem assina a rogo.`,
      );
    }
  }
  const regime = values.regime as Regime | undefined;
  if (!regime) {
    problems.push("Falta o regime de bens.");
  } else if (
    regime !== "comunhao-parcial" &&
    regime !== "separacao-obrigatoria" &&
    !values.pacto?.trim()
  ) {
    problems.push(
      `O regime da ${REGIME_LABELS[regime]} precisa de pacto antenupcial por escritura pública (Código Civil, arts. 1.640, parágrafo único, e 1.653).`,
    );
  }
  if (regime === "separacao-obrigatoria" && !values.motivoSeparacao) {
    problems.push(
      "Diga por que a separação é obrigatória (Código Civil, art. 1.641).",
    );
  }
  for (const n of [1, 2] as const) {
    if (!values[`t${n}.nome`]?.trim()) {
      problems.push(
        `Falta a ${n}ª testemunha da habilitação (Código Civil, art. 1.525, III).`,
      );
    }
  }
  if (values.certificadoEm && !values.editalEm) {
    problems.push(
      "O certificado tem data, mas o edital não: a habilitação precisa ser publicada antes (Lei nº 6.015/1973, art. 67, § 1º).",
    );
  }
  if (
    values.certificadoEm &&
    values.editalEm &&
    values.certificadoEm < values.editalEm
  ) {
    problems.push("O certificado não pode ser anterior ao edital.");
  }
  if (kind !== "conversao" && values.celebracaoData && values.certificadoEm) {
    const valid = addDays(values.certificadoEm, EFICACIA_DAYS);
    if (values.celebracaoData > valid) {
      problems.push(
        `A celebração marcada (${formatIsoDate(values.celebracaoData)}) passa do prazo da habilitação, que vale até ${formatIsoDate(valid)} (Código Civil, art. 1.532).`,
      );
    }
  }
  return { problems, warnings };
}

/** "Processo nº 7/2026". */
export function processoNumber(year: number, sequence: number): string {
  return `${sequence}/${year}`;
}
