import { z } from "zod";
import { integerInWords } from "../money/extenso.ts";
import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { holderName, officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatMoneyBRL } from "../transparency/bulletin.ts";

/**
 * Livro Diário Auxiliar da Receita e da Despesa, by the text of the law and
 * nothing else (decision of 11/11/2026). The law, word for word, is in
 * docs/livro-diario-auxiliar.md: the Código Nacional de Normas (Provimento
 * CNJ nº 149/2023) as the Provimento CNJ nº 259/2026 left it.
 *
 * - art. 186: the book opened, its sheets numbered, and closed by the
 *   holder; the opening term says the book's number, what it is for, how
 *   many sheets it has, that every sheet is initialled, and closes with the
 *   date, the holder's name and signature;
 * - art. 189: columns for the date, the "discriminação da receita e da
 *   despesa" and the amount;
 * - art. 190: the revenue by specialty, act by act, on the day of the act,
 *   with the act's number, or book and sheet, or protocol, when there is
 *   one; § 3º: only the emolumentos that are the holder's own;
 * - art. 191-A: the expenses by the end of the month they were made, with
 *   what identifies and proves them; § 1º lists twelve kinds "entre
 *   outras"; § 2º; § 3º;
 * - art. 192: each month, revenue and expenses added up apart, and the net
 *   balance, positive or negative;
 * - art. 193: the year's balance: revenue, expenses and net result;
 * - art. 193-A, § 2º: the expenses with a distinct tax treatment, marked;
 * - art. 194: an interim books what goes over 90,25% of the STF Ministers'
 *   pay and is deposited, with the day and the account (I), quarterly
 *   unless a state law says otherwise (VI).
 *
 * The state's code stays where it agrees with the national one (art. 195,
 * parágrafo único); for RN, the Provimento nº 156/2016-CGJ/RN: see
 * deadlines.ts and checks.ts.
 */

/** Art. 191-A, § 1º, I to XII, word for word. */
export const EXPENSE_CATEGORIES = [
  {
    id: "locacao",
    law: "I",
    label:
      "Locação de bens móveis e imóveis utilizados na prestação do serviço ou na guarda do acervo",
  },
  {
    id: "imovel",
    law: "II",
    label:
      "Obras, adaptações, conservação e manutenção dos imóveis utilizados pela serventia",
  },
  {
    id: "terceirizados",
    law: "III",
    label:
      "Limpeza, segurança e outros serviços terceirizados vinculados ao funcionamento da unidade",
  },
  {
    id: "tecnologia",
    law: "IV",
    label:
      "Aquisição, locação e manutenção de móveis, equipamentos, sistemas, programas e serviços de tecnologia da informação",
  },
  {
    id: "acervo",
    law: "V",
    label:
      "Formação, manutenção, preservação e segurança do acervo físico ou eletrônico",
  },
  {
    id: "materiais",
    law: "VI",
    label:
      "Materiais, insumos e demais bens necessários ao funcionamento da serventia",
  },
  {
    id: "pessoal",
    law: "VII",
    label:
      "Despesas trabalhistas e previdenciárias relativas aos prepostos, inclusive remuneração, encargos e benefícios",
  },
  {
    id: "saude",
    law: "VIII",
    label:
      "Planos coletivos de assistência médica ou odontológica destinados aos prepostos e seus dependentes, admitida a inclusão do delegatário e de seus dependentes no mesmo plano coletivo",
  },
  {
    id: "cursos",
    law: "IX",
    label:
      "Cursos, capacitações e atividades de aperfeiçoamento profissional relacionados à prestação do serviço",
  },
  {
    id: "iss",
    law: "X",
    label:
      "Imposto Sobre Serviços (ISS) incidente sobre a atividade, quando devido",
  },
  {
    id: "juridica",
    law: "XI",
    label:
      "Serviços de assessoria jurídica relacionados à prestação do serviço",
  },
  {
    id: "tecnicos",
    law: "XII",
    label:
      "Serviços técnicos especializados necessários à atividade, inclusive de engenharia e arquitetura",
  },
  {
    // CGJ/RN art. 26, §§ 1º and 2º: "registrado como despesa da serventia a
    // título de remuneração do interino". Offered only to an interim office.
    id: "interino",
    law: "",
    label: "Remuneração do interino (Código de Normas da CGJ/RN, art. 26)",
  },
  {
    // § 1º: "Poderão ser lançadas, entre outras, as despesas relativas a".
    id: "outra",
    law: "",
    label:
      'Outra despesa relacionada à prestação do serviço delegado (art. 191-A, caput e § 1º: "entre outras")',
  },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  const c = EXPENSE_CATEGORIES.find((x) => x.id === id);
  if (!c) return "Despesa";
  return c.law ? `${c.label} (art. 191-A, § 1º, ${c.law})` : c.label;
}

/** Art. 194, VI: quarterly, unless a state law sets another period. */
export const INTERIM_PERIODS = ["trimestral", "mensal"] as const;
export type InterimPeriod = (typeof INTERIM_PERIODS)[number];

export const SettingsSchema = z.object({
  /** "22" -> "Tabelionato de Notas": the office's own table of codes. */
  specialties: z
    .array(
      z.object({
        prefix: z
          .string()
          .trim()
          .regex(/^\d{1,4}$/),
        name: z.string().trim().min(1).max(120),
      }),
    )
    .max(40)
    .default([]),
  /** Who keeps the book for the holder (art. 187); empty, the holder. */
  responsible: z.string().trim().max(160).default(""),
  /** Art. 186, parágrafo único: the book's number and its sheets. */
  bookNumber: z.number().int().min(1).max(9999).default(1),
  sheetCount: z.number().int().min(0).max(100_000).default(0),
  /** Art. 194: an office run by an interim. */
  interim: z.boolean().default(false),
  /** 90,25% of the STF Ministers' monthly pay, in cents (art. 194, I). */
  ceilingCents: z.number().int().min(0).max(100_000_000).default(0),
  /** Art. 194, VI. */
  interimPeriod: z.enum(INTERIM_PERIODS).default("trimestral"),
});
export type BookSettings = z.infer<typeof SettingsSchema>;

/** A start for RN: the first two digits of the TJRN's table of acts. */
export const DEFAULT_SPECIALTIES = [
  { prefix: "22", name: "Tabelionato de Notas" },
  { prefix: "23", name: "Registro Civil das Pessoas Naturais" },
];

export function specialtyOf(code: string, settings: BookSettings): string {
  if (!code) return "Sem código";
  const match = [...settings.specialties]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((s) => code.startsWith(s.prefix));
  return match?.name ?? `Atos de código ${code.slice(0, 2)}`;
}

/* ---------------------------------------------------------------- entries */

/**
 * A line of the book. "deposito" is the interim's deposit of what went over
 * the ceiling (art. 194, I): booked with its day and account, neither
 * revenue nor expense.
 */
export type EntryKind = "receita" | "despesa" | "deposito";

export interface BookEntry {
  id: string;
  kind: EntryKind;
  /** "YYYY-MM-DD" */
  date: string;
  /** Revenue: the specialty. */
  specialty: string;
  /** Expense: the art. 191-A category. */
  category: string;
  actCode: string;
  description: string;
  quantity: number;
  amountCents: number;
  /** Revenue only, from the productivity report: not emolumentos (art. 190, § 3º). */
  fundsCents: number;
  issCents: number;
  supplier: string;
  /**
   * Revenue: the act's number, or book and sheet, or protocol (art. 190).
   * Expense: the paper that proves it (art. 191-A). Deposit: the account
   * (art. 194, I).
   */
  documentRef: string;
  fiscalDistinct: boolean;
  fiscalNote: string;
  explanation: string;
  hasAttachment: boolean;
}

const money = (c: number) => `R$ ${formatMoneyBRL(c)}`;
export const brDate = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

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
] as const;

export const monthLabel = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
export const writtenDate = (iso: string) =>
  `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

export interface Summary {
  revenueCents: number;
  expensesCents: number;
  balanceCents: number;
  fundsCents: number;
  issCents: number;
  depositsCents: number;
  acts: number;
  bySpecialty: { name: string; acts: number; cents: number }[];
  byCategory: { name: string; cents: number }[];
  byDay: { date: string; revenueCents: number; expensesCents: number }[];
}

/** Art. 192: the revenue and the expenses added up apart, and the balance. */
export function summarize(entries: readonly BookEntry[]): Summary {
  const s: Summary = {
    revenueCents: 0,
    expensesCents: 0,
    balanceCents: 0,
    fundsCents: 0,
    issCents: 0,
    depositsCents: 0,
    acts: 0,
    bySpecialty: [],
    byCategory: [],
    byDay: [],
  };
  const spec = new Map<string, { acts: number; cents: number }>();
  const cat = new Map<string, number>();
  const day = new Map<
    string,
    { revenueCents: number; expensesCents: number }
  >();
  for (const e of entries) {
    if (e.kind === "deposito") {
      s.depositsCents += e.amountCents;
      continue;
    }
    const d = day.get(e.date) ?? { revenueCents: 0, expensesCents: 0 };
    if (e.kind === "receita") {
      s.revenueCents += e.amountCents;
      s.fundsCents += e.fundsCents;
      s.issCents += e.issCents;
      s.acts += e.quantity;
      const x = spec.get(e.specialty) ?? { acts: 0, cents: 0 };
      x.acts += e.quantity;
      x.cents += e.amountCents;
      spec.set(e.specialty, x);
      d.revenueCents += e.amountCents;
    } else {
      s.expensesCents += e.amountCents;
      const name = categoryLabel(e.category);
      cat.set(name, (cat.get(name) ?? 0) + e.amountCents);
      d.expensesCents += e.amountCents;
    }
    day.set(e.date, d);
  }
  s.balanceCents = s.revenueCents - s.expensesCents;
  s.bySpecialty = [...spec.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => a.name.localeCompare(b.name));
  s.byCategory = [...cat.entries()]
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => a.name.localeCompare(b.name));
  s.byDay = [...day.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return s;
}

/** Art. 191-A: an expense booked after the end of the month it was made. */
export function lateExpense(
  entry: { kind: string; date: string },
  bookedOn: string,
): boolean {
  return (
    entry.kind === "despesa" && bookedOn.slice(0, 7) > entry.date.slice(0, 7)
  );
}

/* ----------------------------------------------------------------- interim */

/**
 * Art. 194 (and, for RN, arts. 26 and 27 of the CGJ/RN's code): the net
 * income of the period, without the interim's own pay (CGJ/RN art. 26, I),
 * against 90,25% of the STF Ministers' pay for each month of the period.
 */
export interface InterimSnapshot {
  ceilingCents: number;
  period: InterimPeriod;
  start: string;
  end: string;
  months: number;
  revenueCents: number;
  /** The period's expenses, the interim's pay left out. */
  expensesCents: number;
  /** Deposits booked in the period (art. 194, I). */
  depositsCents: number;
}

/** The period an interim office settles in the month that ends it. */
export function interimPeriodOf(
  month: string,
  period: InterimPeriod,
): { start: string; end: string; months: number } | null {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = (mm: number) =>
    `${y}-${String(mm).padStart(2, "0")}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, "0")}`;
  if (period === "mensal") {
    return { start: `${month}-01`, end: last(m), months: 1 };
  }
  if (m % 3 !== 0) return null;
  return {
    start: `${y}-${String(m - 2).padStart(2, "0")}-01`,
    end: last(m),
    months: 3,
  };
}

export function interimFigures(i: InterimSnapshot) {
  const netCents = i.revenueCents - i.expensesCents;
  const limitCents = i.ceilingCents * i.months;
  return {
    netCents,
    limitCents,
    excessCents: i.ceilingCents > 0 ? Math.max(0, netCents - limitCents) : 0,
  };
}

/* -------------------------------------------------------------- documents */

export const BOOK_DOC_KINDS = [
  "dia",
  "mes",
  "ano",
  "abertura",
  "encerramento",
] as const;
export type BookDocKind = (typeof BOOK_DOC_KINDS)[number];
export const BOOK_DOC_LABELS: Record<BookDocKind, string> = {
  dia: "Movimento do dia",
  mes: "Movimento e apuração do mês (art. 192)",
  ano: "Balanço anual (art. 193)",
  abertura: "Termo de abertura (art. 186)",
  encerramento: "Termo de encerramento (art. 186)",
};
/** The pages that take numbered sheets of the book (art. 186). */
export const SHEET_KINDS: readonly BookDocKind[] = ["dia", "mes", "ano"];

/** What a generated page said, frozen. */
export interface BookSnapshot {
  kind: BookDocKind;
  start: string;
  end: string;
  issuedOn: string;
  entries: BookEntry[];
  /** For the year's balance: month by month. The acts, funds and ISS came
   * later (decision of 12/11/2026): a balance generated before has none. */
  months: {
    month: string;
    revenueCents: number;
    expensesCents: number;
    acts?: number;
    fundsCents?: number;
    issCents?: number;
  }[];
  /** The year's balance: the ofício that sends it to the Corregedoria. */
  oficio?: BalanceOficio | null;
  notes: string;
  signer: { name: string; title: string; note?: string } | null;
  /** An interim office, in the month that closes its period (art. 194). */
  interim?: InterimSnapshot | { ceilingCents: number } | null;
  /** Art. 186: the book, and the sheets this page takes in it. */
  book?: {
    number: number;
    sheetCount: number;
    firstSheet?: number;
    lastSheet?: number;
  } | null;
}

function signerLines(tenant: Tenant, s: BookSnapshot) {
  const name = s.signer?.name.trim() || holderName(tenant) || "";
  return {
    signee: name || undefined,
    signature: [
      s.signer?.title || tenant.holderTitle || "Tabelião/Registrador",
      ...(s.signer?.note?.trim() ? [s.signer.note.trim()] : []),
    ],
  };
}

/** Where the law puts an expense's category. */
function categoryRef(id: string): string {
  const c = EXPENSE_CATEGORIES.find((x) => x.id === id);
  if (c?.law) return `art. 191-A, § 1º, ${c.law}`;
  if (id === "interino") return "CGJ/RN, art. 26";
  return "art. 191-A, caput";
}

function entryRows(entries: readonly BookEntry[]): string[][] {
  const order = { receita: 0, despesa: 1, deposito: 2 } as const;
  return [...entries]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        order[a.kind] - order[b.kind] ||
        a.specialty.localeCompare(b.specialty),
    )
    .map((e) => {
      if (e.kind === "deposito") {
        return [
          brDate(e.date),
          `Renda líquida excedente a 90,25% dos subsídios de ministro do STF depositada à disposição do Tribunal de Justiça (art. 194, I): ${money(e.amountCents)}, em ${brDate(e.date)}${e.documentRef ? `, conta ${e.documentRef}` : ""}${e.description ? `. ${e.description}` : ""}`,
          "",
          "",
        ];
      }
      if (e.kind === "receita") {
        return [
          brDate(e.date),
          `${e.specialty}: ${e.actCode ? `${e.actCode} - ` : ""}${e.description}${e.quantity > 1 ? ` (${e.quantity} atos)` : ""}${e.documentRef ? `; ${e.documentRef}` : ""}`,
          formatMoneyBRL(e.amountCents),
          "",
        ];
      }
      return [
        brDate(e.date),
        `Despesa (${categoryRef(e.category)}): ${e.description}${e.supplier ? `, ${e.supplier}` : ""}${e.documentRef ? ` (${e.documentRef})` : ""}${e.fiscalDistinct ? " [tratamento fiscal distinto, art. 193-A, § 2º]" : ""}`,
        "",
        formatMoneyBRL(e.amountCents),
      ];
    });
}

/** Art. 189: the date, the discriminação, and the amount. */
const COLUMNS = [
  { label: "Data", weight: 0.9 },
  { label: "Discriminação da receita e da despesa", weight: 4.2 },
  { label: "Receita (R$)", align: "right" as const, weight: 1.1 },
  { label: "Despesa (R$)", align: "right" as const, weight: 1.1 },
];

function explanations(
  entries: readonly BookEntry[],
  notes: string,
): RequerimentoSection[] {
  const lines = entries
    .filter(
      (e) => e.explanation.trim() || (e.fiscalDistinct && e.fiscalNote.trim()),
    )
    .map(
      (e) =>
        `${brDate(e.date)}, ${e.description}: ${[e.explanation.trim(), e.fiscalDistinct && e.fiscalNote.trim() ? `Tratamento fiscal distinto: ${e.fiscalNote.trim()}` : ""].filter(Boolean).join(" ")}`,
    );
  return [
    ...(lines.length
      ? [{ heading: "Explicações e retificações", paragraphs: lines }]
      : []),
    ...(notes.trim()
      ? [{ heading: "Observações", paragraphs: [notes.trim()] }]
      : []),
  ];
}

function isFullInterim(i: BookSnapshot["interim"]): i is InterimSnapshot {
  return Boolean(i && "period" in i);
}

/** Art. 194, I, IV and VI. */
function interimSection(i: InterimSnapshot): RequerimentoSection {
  const f = interimFigures(i);
  const period =
    i.period === "trimestral"
      ? `${brDate(i.start)} a ${brDate(i.end)} (trimestral, art. 194, VI)`
      : `${monthLabel(i.start)} (mensal, norma estadual; art. 194, VI)`;
  return {
    heading: "Responsável interino: renda líquida excedente (art. 194)",
    rows: [
      { label: "Período de apuração", value: period },
      { label: "Receitas do período", value: money(i.revenueCents) },
      {
        label: "Despesas abatidas (art. 194, IV)",
        value: `${money(i.expensesCents)}, sem a remuneração do interino`,
      },
      {
        label:
          f.netCents >= 0 ? "Renda líquida do período" : "Resultado negativo",
        value: money(Math.abs(f.netCents)),
      },
      {
        label: "90,25% dos subsídios de ministro do STF",
        value:
          i.ceilingCents > 0
            ? `${money(i.ceilingCents)} por mês${i.months > 1 ? ` × ${i.months} meses = ${money(f.limitCents)}` : ""}`
            : "não informado na configuração",
      },
      {
        label: "Excedente a depositar à disposição do Tribunal de Justiça",
        value: money(f.excessCents),
      },
      {
        label: "Depósitos lançados no período (art. 194, I)",
        value: money(i.depositsCents),
      },
    ],
  };
}

function bookRows(s: BookSnapshot) {
  if (!s.book) return [];
  const sheets =
    s.book.firstSheet && s.book.lastSheet
      ? s.book.firstSheet === s.book.lastSheet
        ? `folha ${s.book.firstSheet}`
        : `folhas ${s.book.firstSheet} a ${s.book.lastSheet}`
      : "";
  return [
    {
      label: "Livro",
      value: `nº ${s.book.number}${sheets ? `, ${sheets}` : ""}`,
    },
  ];
}

/** The page's sheet numbers, printed on each page (art. 186). */
function sheetOf(s: BookSnapshot) {
  return s.book?.firstSheet
    ? { first: s.book.firstSheet, label: `Livro nº ${s.book.number} · Folha` }
    : undefined;
}

/** The day's or the month's page of the book. */
export function buildBookDocument(
  tenant: Tenant,
  s: BookSnapshot,
): RequerimentoDocument {
  const office = officialName(tenant);
  const sum = summarize(s.entries);
  const isDay = s.kind === "dia";
  const period = isDay ? brDate(s.start) : monthLabel(s.start);
  const sections: RequerimentoSection[] = [
    {
      heading: "Serventia",
      rows: [
        { label: "Serventia", value: office },
        { label: "CNS", value: tenant.cns },
        ...bookRows(s),
        { label: isDay ? "Dia" : "Mês", value: period },
      ],
    },
    {
      heading: "Lançamentos (art. 189)",
      table: {
        columns: COLUMNS,
        rows: entryRows(s.entries),
        total: [
          "",
          "Total",
          formatMoneyBRL(sum.revenueCents),
          formatMoneyBRL(sum.expensesCents),
        ],
        empty: "Nenhum lançamento no período.",
      },
    },
    {
      heading: isDay ? "Resultado do dia" : "Apuração do mês (art. 192)",
      rows: [
        { label: "Receitas", value: money(sum.revenueCents) },
        { label: "Despesas", value: money(sum.expensesCents) },
        {
          label:
            sum.balanceCents >= 0
              ? "Saldo líquido positivo"
              : "Saldo líquido negativo",
          value: money(Math.abs(sum.balanceCents)),
        },
      ],
    },
  ];
  if (sum.fundsCents > 0 || sum.issCents > 0) {
    sections.push({
      heading:
        "Valores do relatório não lançados como receita (art. 190, § 3º)",
      rows: [
        ...(sum.fundsCents > 0
          ? [
              {
                label: "Fundos e repasses (FDJ, FRMP, FCRCPN, FPGE e outros)",
                value: money(sum.fundsCents),
              },
            ]
          : []),
        ...(sum.issCents > 0
          ? [
              {
                label: "ISSQN destacado no relatório",
                value: money(sum.issCents),
              },
            ]
          : []),
      ],
    });
  }
  if (!isDay && sum.bySpecialty.length) {
    sections.push({
      heading: "Receita por especialidade (art. 190)",
      table: {
        columns: [
          { label: "Especialidade", weight: 3 },
          { label: "Atos", align: "right" },
          { label: "Receita (R$)", align: "right", weight: 1.3 },
        ],
        rows: sum.bySpecialty.map((x) => [
          x.name,
          x.acts.toLocaleString("pt-BR"),
          formatMoneyBRL(x.cents),
        ]),
      },
    });
  }
  if (!isDay && sum.byCategory.length) {
    sections.push({
      heading: "Despesa por categoria (art. 191-A, § 1º)",
      table: {
        columns: [
          { label: "Categoria", weight: 4 },
          { label: "Despesa (R$)", align: "right", weight: 1.3 },
        ],
        rows: sum.byCategory.map((x) => [x.name, formatMoneyBRL(x.cents)]),
      },
    });
  }
  if (!isDay && isFullInterim(s.interim)) {
    sections.push(interimSection(s.interim));
  }
  sections.push(...explanations(s.entries, s.notes));
  sections.push({
    heading: "Encerramento",
    paragraphs: [
      isDay
        ? `Encerra-se o movimento do dia ${period}, com receitas de ${money(sum.revenueCents)} e despesas de ${money(sum.expensesCents)}.`
        : `Somadas em separado as receitas (${money(sum.revenueCents)}) e as despesas (${money(sum.expensesCents)}) de ${period}, apura-se o saldo líquido ${sum.balanceCents >= 0 ? "positivo" : "negativo"} de ${money(Math.abs(sum.balanceCents))} do período (art. 192 do Código Nacional de Normas, Provimento CNJ nº 149/2023).`,
    ],
  });
  return {
    eyebrow: "Livro Diário Auxiliar da Receita e da Despesa",
    title: `Movimento de ${period}`,
    subtitle: isDay ? "Lançamentos do dia" : "Lançamentos e apuração do mês",
    office: [office, tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(s.issuedOn)}.`,
    ...signerLines(tenant, s),
    footer: `${office} · Livro Diário Auxiliar · ${period} · ${tenant.legalFooter}`,
    sheet: sheetOf(s),
  };
}

/** The year's figures, added up from the months. */
export function annualTotals(s: Pick<BookSnapshot, "months">) {
  const sum = (pick: (m: BookSnapshot["months"][number]) => number) =>
    s.months.reduce((a, m) => a + pick(m), 0);
  const revenue = sum((m) => m.revenueCents);
  const expenses = sum((m) => m.expensesCents);
  // Acts, funds and ISS: only when every month carries them.
  const detailed =
    s.months.length > 0 && s.months.every((m) => m.acts !== undefined);
  const third = sum((m) => (m.fundsCents ?? 0) + (m.issCents ?? 0));
  return {
    revenue,
    expenses,
    net: revenue - expenses,
    detailed,
    acts: sum((m) => m.acts ?? 0),
    thirdPartyCents: third,
    grossCents: revenue + third,
  };
}

const signed = (cents: number) =>
  `${cents < 0 ? "-" : ""}${formatMoneyBRL(Math.abs(cents))}`;

function monthTable(s: BookSnapshot): RequerimentoSection["table"] {
  const t = annualTotals(s);
  if (!t.detailed) {
    return {
      columns: [
        { label: "Mês", weight: 1.6 },
        { label: "Receita (R$)", align: "right" },
        { label: "Despesa (R$)", align: "right" },
        { label: "Saldo (R$)", align: "right" },
      ],
      rows: s.months.map((m) => [
        monthLabel(`${m.month}-01`),
        formatMoneyBRL(m.revenueCents),
        formatMoneyBRL(m.expensesCents),
        signed(m.revenueCents - m.expensesCents),
      ]),
      total: [
        "Total do exercício",
        formatMoneyBRL(t.revenue),
        formatMoneyBRL(t.expenses),
        signed(t.net),
      ],
    };
  }
  // The columns the office already sends the Corregedoria (decision of
  // 12/11/2026): acts, what was collected, what went to funds and ISS, the
  // emolumentos that are the delegatário's revenue, expenses and net.
  return {
    columns: [
      { label: "Mês", weight: 1.25 },
      { label: "Atos", align: "right", weight: 0.6 },
      { label: "Arrecadação bruta (R$)", align: "right" },
      { label: "Fundos e ISS (R$)", align: "right" },
      { label: "Emolumentos (R$)", align: "right" },
      { label: "Despesas (R$)", align: "right" },
      { label: "Líquido (R$)", align: "right" },
    ],
    rows: s.months.map((m) => {
      const third = (m.fundsCents ?? 0) + (m.issCents ?? 0);
      return [
        monthLabel(`${m.month}-01`),
        (m.acts ?? 0).toLocaleString("pt-BR"),
        formatMoneyBRL(m.revenueCents + third),
        formatMoneyBRL(third),
        formatMoneyBRL(m.revenueCents),
        formatMoneyBRL(m.expensesCents),
        signed(m.revenueCents - m.expensesCents),
      ];
    }),
    total: [
      "Total",
      t.acts.toLocaleString("pt-BR"),
      formatMoneyBRL(t.grossCents),
      formatMoneyBRL(t.thirdPartyCents),
      formatMoneyBRL(t.revenue),
      formatMoneyBRL(t.expenses),
      signed(t.net),
    ],
  };
}

/** Art. 193: the year's revenue, expenses and net result. */
export function buildAnnualDocument(
  tenant: Tenant,
  s: BookSnapshot,
): RequerimentoDocument {
  const office = officialName(tenant);
  const year = s.start.slice(0, 4);
  const t = annualTotals(s);
  const revenue = t.revenue;
  const expenses = t.expenses;
  const net = t.net;
  return {
    eyebrow: "Livro Diário Auxiliar da Receita e da Despesa",
    title: `Balanço anual de ${year}`,
    subtitle: "Receitas, despesas e resultado líquido (art. 193)",
    office: [office, tenant.subtitle],
    sections: [
      {
        heading: "Serventia",
        rows: [
          { label: "Serventia", value: office },
          { label: "CNS", value: tenant.cns },
          ...bookRows(s),
          { label: "Exercício", value: year },
        ],
      },
      {
        heading: "Balanço (art. 193)",
        rows: [
          ...(t.detailed
            ? [
                {
                  label: "Atos praticados",
                  value: t.acts.toLocaleString("pt-BR"),
                },
                {
                  label: "Arrecadação bruta (emolumentos, fundos e ISS)",
                  value: money(t.grossCents),
                },
                {
                  label: "Fundos e ISS (não lançados como receita)",
                  value: money(t.thirdPartyCents),
                },
              ]
            : []),
          {
            label: "Receitas: emolumentos (art. 190, § 3º)",
            value: money(revenue),
          },
          { label: "Despesas", value: money(expenses) },
          {
            label:
              net >= 0
                ? "Resultado líquido positivo"
                : "Resultado líquido negativo",
            value: money(Math.abs(net)),
          },
        ],
      },
      { heading: "Mês a mês", table: monthTable(s) },
      {
        heading: "Resultado",
        paragraphs: [
          `Ao final do exercício de ${year}, elabora-se o balanço anual da unidade, com receitas de ${money(revenue)}, despesas de ${money(expenses)} e resultado líquido ${net >= 0 ? "positivo" : "negativo"} de ${money(Math.abs(net))} (art. 193 do Código Nacional de Normas, com a redação do Provimento CNJ nº 259/2026).`,
          ...(tenant.location.state === "RN"
            ? [
                "No Rio Grande do Norte: balanço até o dia 15 de janeiro, remetido à Corregedoria Geral de Justiça até 5 (cinco) dias depois de sua conclusão (Código de Normas da CGJ/RN, art. 62), e livro visado pelo Juiz Corregedor Permanente até o 15º dia útil de fevereiro (art. 61, parágrafo único).",
              ]
            : []),
        ],
      },
      ...(s.notes.trim()
        ? [{ heading: "Observações", paragraphs: [s.notes.trim()] }]
        : []),
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(s.issuedOn)}.`,
    ...signerLines(tenant, s),
    footer: `${office} · Livro Diário Auxiliar · Balanço de ${year} · ${tenant.legalFooter}`,
    sheet: sheetOf(s),
  };
}

/* ---------------------------------------------------------------- ofício */

/**
 * The ofício that sends the year's balance to the Corregedoria (decision of
 * 12/11/2026). In RN the balance is "remetido à Corregedoria Geral de
 * Justiça até 5 dias depois de sua conclusão" (CGJ/RN art. 62); the office
 * sends it through the Tribunal's own channels, so the platform writes the
 * ofício and leaves the sending to them.
 */
export interface BalanceOficio {
  /** As the office numbers its ofícios: "04/2026". */
  number: string;
  /** One line per line of the address. */
  addressee: string;
  /** "YYYY-MM-DD" */
  date: string;
}

export function buildBalanceOficio(
  tenant: Tenant,
  s: BookSnapshot,
  options: {
    /** The portal's address, when every month of the year is published. */
    transparencyUrl?: string;
  } = {},
): RequerimentoDocument {
  const office = officialName(tenant);
  const year = s.start.slice(0, 4);
  const t = annualTotals(s);
  const oficio = s.oficio;
  const number = oficio?.number.trim() || "";
  const rn = tenant.location.state === "RN";
  const sheets =
    s.book?.firstSheet && s.book.lastSheet
      ? `, lavrado no Livro nº ${s.book.number}, ${s.book.firstSheet === s.book.lastSheet ? `folha ${s.book.firstSheet}` : `folhas ${s.book.firstSheet} a ${s.book.lastSheet}`}`
      : "";
  const addressee = (oficio?.addressee ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    eyebrow: number ? `Ofício nº ${number}` : "Ofício",
    title: `Encaminhamento do balanço anual de ${year}`,
    subtitle: "Livro Diário Auxiliar da Receita e da Despesa",
    office: [office, tenant.subtitle],
    sections: [
      {
        heading: "Destinatário",
        paragraphs: addressee.length
          ? [addressee.join("\n")]
          : ["Corregedoria Geral da Justiça"],
      },
      {
        heading: "Encaminhamento",
        paragraphs: [
          "Excelentíssimo(a) Senhor(a) Corregedor(a)-Geral,",
          `Encaminho a Vossa Excelência o balanço anual do exercício de ${year} desta serventia (CNS ${tenant.cns}), elaborado nos termos do art. 193 do Código Nacional de Normas da Corregedoria Nacional de Justiça (Provimento CNJ nº 149/2023, com a redação do Provimento CNJ nº 259/2026)${rn ? " e remetido na forma do art. 62 do Código de Normas da Corregedoria Geral de Justiça do Estado do Rio Grande do Norte (Provimento nº 156/2016-CGJ/RN)" : ""}.`,
          `No exercício, a serventia registrou receitas de ${money(t.revenue)}, despesas de ${money(t.expenses)} e resultado líquido ${t.net >= 0 ? "positivo" : "negativo"} de ${money(Math.abs(t.net))}, conforme o demonstrativo mês a mês que acompanha este ofício.`,
          `Os valores foram extraídos do Livro Diário Auxiliar da Receita e da Despesa, escriturado na forma dos arts. 189 a 192 do mesmo Código${sheets}.${options.transparencyUrl ? ` Os boletins mensais de receita do exercício estão publicados no Portal da Transparência da serventia, em ${options.transparencyUrl}.` : ""}`,
          "O referido é verdade e dou fé. Aproveito a oportunidade para renovar a Vossa Excelência os protestos de elevada estima e consideração.",
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(oficio?.date || s.issuedOn)}.`,
    ...signerLines(tenant, s),
    footer: `${office} · ${number ? `Ofício nº ${number} · ` : ""}Balanço anual de ${year} · ${tenant.legalFooter}`,
  };
}

/** What the ofício form starts with: the Corregedoria as the office keeps
 * it for the papel de segurança, when it has. */
export function defaultOficioAddressee(parts: {
  headName?: string;
  headTitle?: string;
  authority?: string;
}): string {
  return [
    "A Sua Excelência",
    [
      parts.headName?.trim(),
      parts.headTitle?.trim() || "Corregedor(a)-Geral da Justiça",
    ]
      .filter(Boolean)
      .join(", "),
    parts.authority?.trim() || "Corregedoria Geral da Justiça",
  ].join("\n");
}

/** Art. 186: opened and closed by the holder, who signs. */
function holderLines(tenant: Tenant) {
  return {
    signee: holderName(tenant) || undefined,
    signature: [tenant.holderTitle || "Delegatário"],
  };
}

/**
 * Art. 186, parágrafo único: "O termo de abertura deverá conter o número do
 * livro, o fim a que se destina, o número de folhas que contém, a
 * declaração de que todas as suas folhas estão rubricadas e o fecho, com
 * data, nome do delegatário e assinatura."
 */
export function buildOpeningDocument(
  tenant: Tenant,
  s: BookSnapshot,
): RequerimentoDocument {
  const office = officialName(tenant);
  const n = s.book?.number ?? 1;
  const sheets = s.book?.sheetCount ?? 0;
  return {
    eyebrow: "Livro Diário Auxiliar da Receita e da Despesa",
    title: "Termo de abertura",
    subtitle: `Livro nº ${n}`,
    office: [office, tenant.subtitle],
    sections: [
      {
        heading: "Livro",
        rows: [
          { label: "Número do livro", value: String(n) },
          {
            label: "Fim a que se destina",
            value: `Livro Diário Auxiliar da Receita e da Despesa da serventia ${office}, CNS ${tenant.cns} (Código Nacional de Normas, arts. 185, II, e 189 a 194)`,
          },
          {
            label: "Número de folhas",
            value: sheets
              ? `${sheets} (${integerInWords(sheets)})`
              : "não informado na configuração",
          },
        ],
      },
      {
        heading: "Termo",
        paragraphs: [
          `Este livro nº ${n} contém ${sheets ? `${sheets} (${integerInWords(sheets)})` : "___"} folhas e destina-se à escrituração do Livro Diário Auxiliar da Receita e da Despesa da serventia ${office}. Declaro que todas as suas folhas estão rubricadas.`,
          ...(s.notes.trim() ? [s.notes.trim()] : []),
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(s.issuedOn)}.`,
    ...holderLines(tenant),
    footer: `${office} · Livro Diário Auxiliar nº ${n} · Termo de abertura · ${tenant.legalFooter}`,
  };
}

/** Art. 186: the book closed by the holder. */
export function buildClosingDocument(
  tenant: Tenant,
  s: BookSnapshot,
): RequerimentoDocument {
  const office = officialName(tenant);
  const n = s.book?.number ?? 1;
  const sheets = s.book?.sheetCount ?? 0;
  const last = s.book?.lastSheet ?? 0;
  return {
    eyebrow: "Livro Diário Auxiliar da Receita e da Despesa",
    title: "Termo de encerramento",
    subtitle: `Livro nº ${n}`,
    office: [office, tenant.subtitle],
    sections: [
      {
        heading: "Livro",
        rows: [
          { label: "Número do livro", value: String(n) },
          {
            label: "Número de folhas",
            value: sheets ? String(sheets) : "não informado na configuração",
          },
          ...(last
            ? [{ label: "Última folha escriturada", value: String(last) }]
            : []),
        ],
      },
      {
        heading: "Termo",
        paragraphs: [
          `Encerra-se o livro nº ${n} do Livro Diário Auxiliar da Receita e da Despesa da serventia ${office}, CNS ${tenant.cns}${sheets ? `, com ${sheets} (${integerInWords(sheets)}) folhas` : ""}${last ? `, escrituradas até a folha nº ${last}` : ""}.`,
          ...(s.notes.trim() ? [s.notes.trim()] : []),
        ],
      },
    ],
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(s.issuedOn)}.`,
    ...holderLines(tenant),
    footer: `${office} · Livro Diário Auxiliar nº ${n} · Termo de encerramento · ${tenant.legalFooter}`,
  };
}

export function buildBookPdfDocument(tenant: Tenant, s: BookSnapshot) {
  if (s.kind === "ano") return buildAnnualDocument(tenant, s);
  if (s.kind === "abertura") return buildOpeningDocument(tenant, s);
  if (s.kind === "encerramento") return buildClosingDocument(tenant, s);
  return buildBookDocument(tenant, s);
}

/** The same lines as a spreadsheet, for the accountant. */
export function bookCsv(s: BookSnapshot): string {
  const cell = (v: string | number) => {
    const t = String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines: (string | number)[][] = [
    [
      "Data",
      "Tipo",
      "Especialidade/Categoria",
      "Código",
      "Discriminação",
      "Quantidade",
      "Receita",
      "Despesa",
      "Depósito (art. 194, I)",
      "Fundos e repasses",
      "ISS",
      "Fornecedor",
      "Identificação/Documento/Conta",
      "Trat. fiscal distinto",
      "Explicação",
    ],
    ...s.entries.map((e) => [
      brDate(e.date),
      e.kind,
      e.kind === "receita"
        ? e.specialty
        : e.kind === "despesa"
          ? categoryLabel(e.category)
          : "",
      e.actCode,
      e.description,
      e.quantity,
      e.kind === "receita" ? formatMoneyBRL(e.amountCents) : "",
      e.kind === "despesa" ? formatMoneyBRL(e.amountCents) : "",
      e.kind === "deposito" ? formatMoneyBRL(e.amountCents) : "",
      formatMoneyBRL(e.fundsCents),
      formatMoneyBRL(e.issCents),
      e.supplier,
      e.documentRef,
      e.fiscalDistinct ? "sim" : "",
      [e.explanation, e.fiscalNote].filter(Boolean).join(" | "),
    ]),
  ];
  return `﻿${lines.map((l) => l.map(cell).join(";")).join("\r\n")}\r\n`;
}
