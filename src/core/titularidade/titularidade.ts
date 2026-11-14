import {
  addDays,
  type IsoDate,
  isBusinessDay,
  type OfficeHolidays,
} from "../scheduling/calendar.ts";
import { formatTaxId, isValidTaxId } from "../tax-id.ts";

/**
 * The communication of changes in the ownership of imóveis to the
 * prefeitura (decision of 14/11/2026), as the Código Nacional de Normas
 * (Provimento CNJ nº 149/2023) sets it in art. 184-A, included by the
 * Provimento CN nº 174/2024 to carry out art. 4º of the Resolução CNJ nº
 * 547/2024 (read on the CNJ's consolidated text, 14/11/2026):
 *
 * - notas and registro de imóveis inform the prefeitura, up to the last
 *   business day of the month after the act, every change of ownership of
 *   the period (caput);
 * - the cases are the same as the DOI's, the Declaração sobre Operações
 *   Imobiliárias sent to the Receita Federal (§ 1º): the operation types
 *   below are the DOI's own table (manual de importação da DOI, RFB,
 *   "Tabela 6");
 * - sent electronically, against a receipt: notas to the CNB/CF's
 *   platform, registro de imóveis to the ONR's (§ 2º);
 * - the act or fact that caused the acquisition is always said (§ 3º);
 * - without fees to the municipality (§ 9º, Provimento CN nº 212/2026).
 *
 * The panel reads the escritura or the registro, fills the fields, and
 * makes the month's ofício and list to the Secretaria Municipal de
 * Tributação, besides the spreadsheet for the platform. Nothing is
 * guessed: what the document does not say stays blank for the person.
 */

/** DOI "Tabela 6 – Tipo da operação imobiliária", code → description. */
export const OPERATIONS: Record<string, string> = {
  "11": "Compra e venda",
  "13": "Permuta",
  "15": "Adjudicação",
  "19": "Dação em pagamento",
  "21": "Distrato de negócio",
  "31": "Procuração em causa própria",
  "33": "Promessa de compra e venda",
  "35": "Promessa de cessão de direitos",
  "37": "Cessão de direitos",
  "41": "Alienação por iniciativa particular ou leilão judicial",
  "45": "Incorporação e loteamento",
  "47": "Integralização/subscrição de capital",
  "55": "Doação em adiantamento da legítima",
  "56": "Aforamento",
  "57": "Casamento em comunhão universal de bens",
  "58": "Cisão total ou parcial",
  "59": "Compra e venda de imóvel gravado por enfiteuse",
  "60": "Concessão de direito real de uso (CDRU)",
  "61": "Concessão de uso especial para fins de moradia (CUEM)",
  "62": "Consolidação da propriedade em nome do fiduciário",
  "63": "Desapropriação para fins de reforma agrária",
  "64": "Desapropriação, exceto para reforma agrária",
  "65": "Direito de laje",
  "66": "Direito de superfície",
  "67": "Doação, exceto em adiantamento da legítima",
  "68": "Incorporação",
  "69": "Inventário",
  "70": "Partilha em separação, divórcio ou união estável",
  "71": "Retorno de capital próprio na extinção de pessoa jurídica",
  "72": "Retorno de capital próprio, exceto na extinção de pessoa jurídica",
  "73": "Título de domínio (TD)",
  "74": "Usucapião",
  "39": "Outras operações imobiliárias",
};

export const SERVICES = {
  notas: {
    label: "Tabelionato de Notas",
    acts: { escritura: "Escritura", procuracao: "Procuração" },
    platform: "plataforma do Colégio Notarial do Brasil (CNB/CF)",
  },
  ri: {
    label: "Registro de Imóveis",
    acts: { registro: "Registro", averbacao: "Averbação" },
    platform:
      "plataforma do Operador Nacional do Sistema de Registro Eletrônico de Imóveis (ONR)",
  },
} as const;
export type Service = keyof typeof SERVICES;

export interface TransferParty {
  name: string;
  /** CPF or CNPJ as typed; blank when the title does not have one. */
  taxId: string;
  /** Share of the imóvel, as written ("50%", "1/2"); optional. */
  share: string;
}

export interface TitleTransfer {
  service: Service;
  /** escritura | procuracao | registro | averbacao */
  act: string;
  /** Lavratura, registro or averbação (ISO). */
  actDate: string;
  /** Notas: livro and folhas. RI: the R-/AV- number. */
  book: string;
  page: string;
  entry: string;
  /** DOI operation code (`OPERATIONS`). */
  operation: string;
  /** Required when `operation` is "39" (outras). */
  operationOther: string;
  /** The imóvel. */
  destination: "urbano" | "rural" | "";
  matricula: string;
  /** Registro de imóveis da matrícula (for notas: where it is registered). */
  registry: string;
  fiscalRegistration: string;
  address: string;
  description: string;
  /** Values in cents; null when the title does not say. */
  valueCents: number | null;
  taxBaseCents: number | null;
  transmitentes: TransferParty[];
  adquirentes: TransferParty[];
  notes: string;
}

export function emptyTransfer(service: Service = "notas"): TitleTransfer {
  return {
    service,
    act: service === "notas" ? "escritura" : "registro",
    actDate: "",
    book: "",
    page: "",
    entry: "",
    operation: "",
    operationOther: "",
    destination: "",
    matricula: "",
    registry: "",
    fiscalRegistration: "",
    address: "",
    description: "",
    valueCents: null,
    taxBaseCents: null,
    transmitentes: [],
    adquirentes: [],
    notes: "",
  };
}

// ---------------------------------------------------------------- parties

/**
 * One party per line, "Nome; CPF ou CNPJ; participação": the way the
 * form shows them, and the way a person would write a list.
 */
export function partiesFromText(text: string): TransferParty[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.split(/[;|\t]/).map((part) => part.trim()))
    .filter(([name]) => Boolean(name))
    .slice(0, 60)
    .map(([name = "", taxId = "", share = ""]) => {
      const digits = taxId.replace(/\D/g, "");
      return {
        name: name.replace(/\s+/g, " ").slice(0, 200),
        taxId: isValidTaxId(digits) ? formatTaxId(digits) : taxId.slice(0, 30),
        share: share.slice(0, 20),
      };
    });
}

export function partiesToText(parties: TransferParty[]): string {
  return parties
    .map((p) =>
      [p.name, p.taxId, p.share].filter((v, i) => v || i === 0).join("; "),
    )
    .join("\n");
}

// ---------------------------------------------------------------- money

/** "150.000,00" or "150000" → 15000000 cents; blank → null. */
export function centsFrom(text: string): number | null | undefined {
  const clean = text.replace(/R\$|\s/g, "");
  if (!clean) return null;
  const normal = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return undefined;
  return Math.round(Number(normal) * 100);
}

export function formatCents(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ---------------------------------------------------------------- checks

export function transferProblems(t: TitleTransfer): string[] {
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.actDate)) {
    problems.push("Informe a data da lavratura, do registro ou da averbação.");
  }
  if (!OPERATIONS[t.operation]) {
    problems.push(
      "Escolha o ato ou fato que transmitiu o imóvel: é obrigatório (Código Nacional de Normas, art. 184-A, § 3º).",
    );
  } else if (t.operation === "39" && !t.operationOther.trim()) {
    problems.push(
      "Descreva a operação, já que ela é Outras operações imobiliárias.",
    );
  }
  if (t.transmitentes.length === 0)
    problems.push("Falta quem transmite (transmitente).");
  if (t.adquirentes.length === 0)
    problems.push("Falta quem adquire (adquirente).");
  for (const p of [...t.transmitentes, ...t.adquirentes]) {
    const digits = p.taxId.replace(/\D/g, "");
    if (digits && !isValidTaxId(digits)) {
      problems.push(`${p.name}: CPF ou CNPJ inválido (${p.taxId}).`);
    }
  }
  if (
    !t.matricula.trim() &&
    !t.fiscalRegistration.trim() &&
    !t.address.trim()
  ) {
    problems.push(
      "Identifique o imóvel: matrícula, inscrição imobiliária ou endereço. A prefeitura precisa achar o cadastro.",
    );
  }
  return problems;
}

/** What the prefeitura's cadastro would miss, without stopping anything. */
export function transferWarnings(t: TitleTransfer): string[] {
  const warnings: string[] = [];
  if (t.destination !== "rural" && !t.fiscalRegistration.trim()) {
    warnings.push(
      "Sem inscrição imobiliária: a prefeitura vai procurar pelo endereço.",
    );
  }
  for (const p of [...t.transmitentes, ...t.adquirentes]) {
    if (!p.taxId.trim()) warnings.push(`${p.name}: sem CPF ou CNPJ no título.`);
  }
  return warnings;
}

// ---------------------------------------------------------------- deadline

/** "2026-10" from "2026-10-17". */
export const competenceOf = (iso: string) => iso.slice(0, 7);

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

/** "outubro de 2026". */
export function competenceLabel(competence: string): string {
  const [year, month] = competence.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} de ${year}`;
}

/**
 * The last business day of the month after the competence (art. 184-A,
 * caput): the office's own days off count, as for its other deadlines.
 */
export function deadlineOf(
  competence: string,
  holidays: OfficeHolidays = {},
): IsoDate {
  const [year, month] = competence.split("-").map(Number) as [number, number];
  // The first day of the month after next, minus one: the last day of next.
  const nextYear = month >= 11 ? year + 1 : year;
  const afterNext = ((month + 1) % 12) + 1;
  let day = addDays(`${nextYear}-${String(afterNext).padStart(2, "0")}-01`, -1);
  while (!isBusinessDay(day, holidays)) day = addDays(day, -1);
  return day;
}

// ---------------------------------------------------------------- reading

/**
 * The operation the title names, by its own words. The first that matches
 * in this order wins: the specific before the general ("doação em
 * adiantamento de legítima" before "doação").
 */
const OPERATION_WORDS: [RegExp, string][] = [
  [/adiantamento\s+(?:da|de)\s+leg[íi]tima/i, "55"],
  [/\bdoa[çc][ãa]o\b/i, "67"],
  [/\bpermuta\b/i, "13"],
  [/da[çc][ãa]o\s+em\s+pagamento/i, "19"],
  [/promessa\s+de\s+compra\s+e\s+venda/i, "33"],
  [/promessa\s+de\s+cess[ãa]o/i, "35"],
  [/cess[ãa]o\s+de\s+direitos/i, "37"],
  [/integraliza[çc][ãa]o\s+(?:de|do)\s+capital/i, "47"],
  [/usucapi[ãa]o/i, "74"],
  [
    /invent[áa]rio|partilha\s+(?:de\s+bens\s+)?(?:causa\s+mortis|dos\s+bens\s+deixados)/i,
    "69",
  ],
  [
    /(?:div[óo]rcio|separa[çc][ãa]o|dissolu[çc][ãa]o\s+de\s+uni[ãa]o\s+est[áa]vel)/i,
    "70",
  ],
  [/consolida[çc][ãa]o\s+da\s+propriedade/i, "62"],
  [/adjudica[çc][ãa]o/i, "15"],
  [/arremata[çc][ãa]o|leil[ãa]o/i, "41"],
  [/desapropria[çc][ãa]o/i, "64"],
  [/direito\s+de\s+laje/i, "65"],
  [/direito\s+de\s+superf[íi]cie/i, "66"],
  [/compra\s+e\s+venda/i, "11"],
];

export function operationIn(text: string): string {
  // The title of the act comes first: read the opening before the body.
  const opening = text.slice(0, 1500);
  for (const where of [opening, text]) {
    for (const [re, code] of OPERATION_WORDS) if (re.test(where)) return code;
  }
  return "";
}

const MONTH_NUMBER = Object.fromEntries(MONTHS.map((m, i) => [m, i + 1]));

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  primeiro: 1,
  dois: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
};

function dayFromWords(words: string): number | null {
  const n = Number(words);
  if (Number.isInteger(n) && n > 0) return n;
  let sum = 0;
  for (const part of words.toLowerCase().split(/\s+e\s+|\s+/)) {
    const value = NUMBER_WORDS[part];
    if (value === undefined) return null;
    sum += value;
  }
  return sum || null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The date the act was done: "Aos dez dias do mês de outubro do ano de dois
 * mil e vinte e seis" needs words; "em 17/10/2026" does not. Only a year
 * written in digits, or "dois mil e ...", is read.
 */
export function actDateIn(text: string): string {
  const flat = text.replace(/\s+/g, " ");
  const longForm =
    /aos?\s+([a-zà-ú\d ]{1,40}?)\s*\(?\d{0,2}\)?\s*dias?\s+do\s+m[êe]s\s+de\s+([a-zç]+)\s+(?:do\s+ano\s+)?de\s+(\d{4}|dois\s+mil(?:\s+e\s+[a-zê]+(?:\s+e\s+[a-zê]+)?)?)(?=[\s,.(]|$)/i.exec(
      flat,
    );
  if (longForm) {
    const day = dayFromWords(longForm[1]?.trim() ?? "");
    const month = MONTH_NUMBER[(longForm[2] ?? "").toLowerCase()];
    const yearText = (longForm[3] ?? "").toLowerCase();
    let year = Number(yearText);
    if (!year) {
      const rest = yearText.replace(/^dois\s+mil\s*(?:e\s+)?/, "").trim();
      year = 2000 + (rest ? (dayFromWords(rest) ?? Number.NaN) : 0);
    }
    if (day && month && year >= 1900 && year < 2200) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }
  const numeric =
    /(?:lavrad[ao]|registrad[ao]|averbad[ao]|em|data(?:do)?)\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(
      flat,
    );
  if (numeric) {
    const [, d, m, y] = numeric;
    return `${y}-${pad(Number(m))}-${pad(Number(d))}`;
  }
  return "";
}

/** "Livro 123, folhas 45/47" of the escritura. */
export function bookAndPageIn(text: string): { book: string; page: string } {
  const flat = text.replace(/\s+/g, " ");
  const match =
    /livro\s*(?:n[º°o]\.?\s*)?([\w-]{1,10})\s*[,-]?\s*(?:à?s?\s*)?(?:fls?\.?|folhas?)\s*(?:n[º°o]\.?\s*)?([\d/\-a-z ]{1,20}?)(?=[,;.)\s]|$)/i.exec(
      flat,
    );
  return {
    book: match?.[1]?.trim() ?? "",
    page: match?.[2]?.trim().replace(/\s+/g, "") ?? "",
  };
}

/** The ITBI base: "base de cálculo ... R$ 120.000,00" or "valor venal". */
export function taxBaseIn(text: string): number | null {
  const match =
    /(?:base\s+de\s+c[áa]lculo|valor\s+venal|avalia[çc][ãa]o\s+fiscal).{0,120}?R\$\s*([\d.]+,\d{2})/i.exec(
      text.replace(/\s+/g, " "),
    );
  return match?.[1] ? (centsFrom(match[1]) ?? null) : null;
}

/** The imóvel's address, after "situado"/"localizado". */
export function addressIn(text: string): string {
  const match =
    /(?:situad[oa]|localizad[oa]|sito)\s+(?:na|no|à|ao|em)\s+(.{8,200}?)(?=,\s*(?:com|medindo|contendo|matr[íi]cula|inscri)|;|\.\s)/i.exec(
      text.replace(/\s+/g, " "),
    );
  return match?.[1]?.trim() ?? "";
}

// ---------------------------------------------------------------- form

/** The form's fields, by name: what the screen sends and shows. */
export const FORM_KEYS = [
  "service",
  "act",
  "actDate",
  "book",
  "page",
  "entry",
  "operation",
  "operationOther",
  "destination",
  "matricula",
  "registry",
  "fiscalRegistration",
  "address",
  "description",
  "value",
  "taxBase",
  "transmitentes",
  "adquirentes",
  "notes",
] as const;

const line = (value: string, max = 300) =>
  value.replace(/\s+/g, " ").trim().slice(0, max);

const longText = (value: string) =>
  value.replace(/\r\n?/g, "\n").trim().slice(0, 5000);

/** "10/10/2026" or "2026-10-10" → ISO; blank stays blank; else null. */
function isoOf(value: string): string | null {
  const text = value.trim();
  if (!text) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : br
      ? [Number(br[3]), Number(br[2]), Number(br[1])]
      : [0, 0, 0];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The form typed into a communication, with what could not be read. */
export function transferFromForm(form: Record<string, string>): {
  transfer: TitleTransfer;
  problems: string[];
} {
  const problems: string[] = [];
  const get = (key: string) => form[key] ?? "";
  const service: Service = get("service") === "ri" ? "ri" : "notas";
  const acts = Object.keys(SERVICES[service].acts);
  const actDate = isoOf(get("actDate"));
  if (actDate === null) problems.push("Data do ato inválida (use dd/mm/aaaa).");
  const money = (key: string, label: string) => {
    const cents = centsFrom(get(key));
    if (cents === undefined) {
      problems.push(`${label}: escreva só o valor, como 150.000,00.`);
      return null;
    }
    return cents;
  };
  const destination = get("destination");
  return {
    transfer: {
      service,
      act: acts.includes(get("act")) ? get("act") : (acts[0] ?? ""),
      actDate: actDate ?? "",
      book: line(get("book"), 20),
      page: line(get("page"), 30),
      entry: line(get("entry"), 30),
      operation: OPERATIONS[get("operation")] ? get("operation") : "",
      operationOther: line(get("operationOther"), 120),
      destination:
        destination === "urbano" || destination === "rural" ? destination : "",
      matricula: line(get("matricula"), 40),
      registry: line(get("registry"), 200),
      fiscalRegistration: line(get("fiscalRegistration"), 60),
      address: line(get("address")),
      description: longText(get("description")).slice(0, 1000),
      valueCents: money("value", "Valor declarado"),
      taxBaseCents: money("taxBase", "Base de cálculo"),
      transmitentes: partiesFromText(get("transmitentes")),
      adquirentes: partiesFromText(get("adquirentes")),
      notes: longText(get("notes")),
    },
    problems,
  };
}

/** The communication as the form shows it. */
export function transferToForm(t: TitleTransfer): Record<string, string> {
  const money = (cents: number | null) =>
    cents === null
      ? ""
      : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  return {
    service: t.service,
    act: t.act,
    actDate: t.actDate,
    book: t.book,
    page: t.page,
    entry: t.entry,
    operation: t.operation,
    operationOther: t.operationOther,
    destination: t.destination,
    matricula: t.matricula,
    registry: t.registry,
    fiscalRegistration: t.fiscalRegistration,
    address: t.address,
    description: t.description,
    value: money(t.valueCents),
    taxBase: money(t.taxBaseCents),
    transmitentes: partiesToText(t.transmitentes),
    adquirentes: partiesToText(t.adquirentes),
    notes: t.notes,
  };
}
