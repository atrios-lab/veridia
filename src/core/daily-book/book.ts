import { z } from "zod";
import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { holderName, officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatMoneyBRL } from "../transparency/bulletin.ts";
import { interimSplit } from "./deadlines.ts";

/**
 * Livro Diário Auxiliar da Receita e da Despesa (decision of 11/11/2026),
 * as the Código Nacional de Normas (Provimento CNJ nº 149/2023) has it,
 * with the wording of the Provimento CNJ nº 259/2026, which revoked the
 * Provimento nº 45/2015:
 *
 * - art. 189: columns for the date, the description of the revenue and of
 *   the expense, and the amount;
 * - art. 190: the revenue booked by specialty, act by act, on the day of
 *   the act, even before the emolumentos are received;
 * - art. 191-A: the expenses booked by the end of the month they were
 *   paid, with what proves them, related to the service (§ 1º lists them;
 *   § 2º forbids personal ones; § 3º keeps the papers 5 years);
 * - art. 192: each month, revenue and expenses added up apart, and the
 *   balance;
 * - art. 193: the year's balance;
 * - art. 193-A, § 2º: the expenses whose tax treatment differs, marked.
 *
 * The state's Código de Normas stays where it agrees (art. 195, parágrafo
 * único). In RN (Provimento nº 156/2016-CGJ/RN): the balance by 15 January
 * and sent to the CGJ in 5 days (art. 62), the judge's visto by the 15th
 * business day of February (art. 61), the interim's ceiling (arts. 19 and
 * 26-27) and the interim's income tax, not an expense (art. 25, § 2º:
 * the holder's is, decision of 11/11/2026); see
 * checks.ts and deadlines.ts.
 *
 * The State's funds (FDJ, FRMP, FCRCPN, FPGE in RN) are someone else's
 * money: shown, never revenue nor expense of the office.
 */

/** Art. 191-A, § 1º, I to XII, and the way out. */
export const EXPENSE_CATEGORIES = [
  { id: "locacao", law: "I", label: "Locação de bens móveis e imóveis" },
  {
    id: "imovel",
    law: "II",
    label: "Obras, adaptações, conservação e manutenção do imóvel",
  },
  {
    id: "terceirizados",
    law: "III",
    label: "Limpeza, segurança e serviços terceirizados",
  },
  {
    id: "tecnologia",
    law: "IV",
    label: "Móveis, equipamentos, sistemas e tecnologia",
  },
  {
    id: "acervo",
    law: "V",
    label: "Formação, preservação e segurança do acervo",
  },
  {
    id: "materiais",
    law: "VI",
    label: "Materiais, insumos e bens de funcionamento",
  },
  {
    id: "pessoal",
    law: "VII",
    label: "Despesas trabalhistas e previdenciárias dos prepostos",
  },
  {
    id: "saude",
    law: "VIII",
    label: "Plano coletivo de saúde ou odontológico",
  },
  { id: "cursos", law: "IX", label: "Cursos e capacitação" },
  { id: "iss", law: "X", label: "ISS sobre a atividade" },
  { id: "juridica", law: "XI", label: "Assessoria jurídica" },
  {
    id: "tecnicos",
    law: "XII",
    label: "Serviços técnicos especializados (engenharia, arquitetura)",
  },
  {
    id: "interino",
    law: "",
    label: "Remuneração do interino (até o teto, CGJ/RN art. 26)",
  },
  { id: "outra", law: "", label: "Outra despesa do serviço (explique)" },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  const c = EXPENSE_CATEGORIES.find((x) => x.id === id);
  if (!c) return "Despesa";
  return c.law ? `${c.label} (art. 191-A, § 1º, ${c.law})` : c.label;
}

export { looksPersonal } from "./checks.ts";

/** The office's specialties, by the first two digits of the act's code. */
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
  /** Who is responsible for the book; empty, the holder. */
  responsible: z.string().trim().max(160).default(""),
  /**
   * An office run by an interim (CGJ/RN arts. 19 to 27): the month's page
   * splits the net result between the interim's pay and the FDJ.
   */
  interim: z.boolean().default(false),
  /** The interim's ceiling: 90,25% of the STF Ministers' pay, in cents. */
  ceilingCents: z.number().int().min(0).max(100_000_000).default(0),
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

export interface BookEntry {
  id: string;
  kind: "receita" | "despesa";
  /** "YYYY-MM-DD" */
  date: string;
  /** Revenue: the specialty; expense: the category's label. */
  specialty: string;
  category: string;
  actCode: string;
  description: string;
  quantity: number;
  amountCents: number;
  /** Revenue only: what went to the State's funds, and the ISS. */
  fundsCents: number;
  issCents: number;
  supplier: string;
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
  acts: number;
  bySpecialty: { name: string; acts: number; cents: number }[];
  byCategory: { name: string; cents: number }[];
  byDay: { date: string; revenueCents: number; expensesCents: number }[];
}

/** Art. 192: the revenue and the expenses apart, and the balance. */
export function summarize(entries: readonly BookEntry[]): Summary {
  const s: Summary = {
    revenueCents: 0,
    expensesCents: 0,
    balanceCents: 0,
    fundsCents: 0,
    issCents: 0,
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

/** Art. 191-A: an expense booked after the end of the month it was paid. */
export function lateExpense(
  entry: { kind: string; date: string },
  bookedOn: string,
): boolean {
  return (
    entry.kind === "despesa" && bookedOn.slice(0, 7) > entry.date.slice(0, 7)
  );
}

/* -------------------------------------------------------------- documents */

export const BOOK_DOC_KINDS = ["dia", "mes", "ano"] as const;
export type BookDocKind = (typeof BOOK_DOC_KINDS)[number];
export const BOOK_DOC_LABELS: Record<BookDocKind, string> = {
  dia: "Movimento do dia",
  mes: "Movimento e apuração do mês (art. 192)",
  ano: "Balanço anual (art. 193)",
};

/** What a generated page said, frozen. */
export interface BookSnapshot {
  kind: BookDocKind;
  start: string;
  end: string;
  issuedOn: string;
  entries: BookEntry[];
  /** For the year's balance: month by month. */
  months: { month: string; revenueCents: number; expensesCents: number }[];
  notes: string;
  signer: { name: string; title: string; note?: string } | null;
  /** A month of an interim office: the ceiling in force when generated. */
  interim?: { ceilingCents: number } | null;
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

function entryRows(entries: readonly BookEntry[]): string[][] {
  return [...entries]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.kind === b.kind ? 0 : a.kind === "receita" ? -1 : 1) ||
        a.specialty.localeCompare(b.specialty),
    )
    .map((e) => [
      brDate(e.date),
      e.kind === "receita"
        ? `${e.specialty}: ${e.actCode ? `${e.actCode} - ` : ""}${e.description}${e.quantity > 1 ? ` (${e.quantity} atos)` : ""}`
        : `${categoryLabel(e.category)}: ${e.description}${e.supplier ? `, ${e.supplier}` : ""}${e.documentRef ? ` (${e.documentRef})` : ""}${e.fiscalDistinct ? " [trat. fiscal distinto]" : ""}`,
      e.kind === "receita" ? formatMoneyBRL(e.amountCents) : "",
      e.kind === "despesa" ? formatMoneyBRL(e.amountCents) : "",
    ]);
}

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

/**
 * CGJ/RN arts. 26 and 27: first the month without the interim's pay, then
 * the net result split between the pay (up to the ceiling) and the FDJ.
 */
function interimSection(s: BookSnapshot, sum: Summary): RequerimentoSection {
  const ceiling = s.interim?.ceilingCents ?? 0;
  const pay = s.entries
    .filter((e) => e.kind === "despesa" && e.category === "interino")
    .reduce((a, e) => a + e.amountCents, 0);
  const before = sum.balanceCents + pay;
  const split = interimSplit(before, ceiling);
  const [y, m] = s.start.split("-").map(Number);
  const next = new Date(Date.UTC(y ?? 2000, m ?? 1, 10));
  const tenth = `10/${String(next.getUTCMonth() + 1).padStart(2, "0")}/${next.getUTCFullYear()}`;
  return {
    heading: "Interinidade (CGJ/RN, arts. 19, 26 e 27)",
    rows: [
      {
        label: "Receita líquida antes da remuneração do interino",
        value: money(before),
      },
      {
        label: "Teto (90,25% do subsídio dos Ministros do STF)",
        value: ceiling > 0 ? money(ceiling) : "não informado na configuração",
      },
      {
        label: "Remuneração do interino (lançar como despesa)",
        value: `${money(split.payCents)}${pay ? `, lançado: ${money(pay)}` : ""}`,
      },
      {
        label: "Excedente a recolher ao FDJ",
        value:
          split.excessCents > 0
            ? `${money(split.excessCents)}, até ${tenth}`
            : "nenhum",
      },
    ],
  };
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
        { label: isDay ? "Dia" : "Mês", value: period },
      ],
    },
    {
      heading: "Lançamentos",
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
        { label: "Receita (emolumentos)", value: money(sum.revenueCents) },
        { label: "Despesa", value: money(sum.expensesCents) },
        {
          label: sum.balanceCents >= 0 ? "Saldo positivo" : "Saldo negativo",
          value: money(Math.abs(sum.balanceCents)),
        },
        { label: "Atos praticados", value: sum.acts.toLocaleString("pt-BR") },
        {
          label: "Repasses (fundos do Estado)",
          value: `${money(sum.fundsCents)}, não são receita da serventia`,
        },
        { label: "ISS dos atos", value: money(sum.issCents) },
      ],
    },
  ];
  if (!isDay && s.interim) sections.push(interimSection(s, sum));
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
  sections.push(...explanations(s.entries, s.notes));
  sections.push({
    heading: "Encerramento",
    paragraphs: [
      isDay
        ? `Encerra-se o movimento do dia ${period}, com receita de ${money(sum.revenueCents)} e despesa de ${money(sum.expensesCents)}.`
        : `Encerra-se o movimento de ${period}, com receita total de ${money(sum.revenueCents)}, despesa total de ${money(sum.expensesCents)} e saldo ${sum.balanceCents >= 0 ? "positivo" : "negativo"} de ${money(Math.abs(sum.balanceCents))}, nos termos do art. 192 do Código Nacional de Normas (Provimento CNJ nº 149/2023).`,
    ],
  });
  return {
    eyebrow: "Livro Diário Auxiliar da Receita e da Despesa",
    title: isDay ? `Movimento de ${period}` : `Movimento de ${period}`,
    subtitle: isDay ? "Lançamentos do dia" : "Lançamentos e apuração do mês",
    office: [office, tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(s.issuedOn)}.`,
    ...signerLines(tenant, s),
    footer: `${office} · Livro Diário Auxiliar · ${period} · ${tenant.legalFooter}`,
  };
}

/** Art. 193: the year, month by month, and the net result. */
export function buildAnnualDocument(
  tenant: Tenant,
  s: BookSnapshot,
): RequerimentoDocument {
  const office = officialName(tenant);
  const year = s.start.slice(0, 4);
  const revenue = s.months.reduce((a, m) => a + m.revenueCents, 0);
  const expenses = s.months.reduce((a, m) => a + m.expensesCents, 0);
  const net = revenue - expenses;
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
          { label: "Exercício", value: year },
        ],
      },
      {
        heading: "Mês a mês",
        table: {
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
            `${m.revenueCents - m.expensesCents < 0 ? "-" : ""}${formatMoneyBRL(Math.abs(m.revenueCents - m.expensesCents))}`,
          ]),
          total: [
            "Total do exercício",
            formatMoneyBRL(revenue),
            formatMoneyBRL(expenses),
            `${net < 0 ? "-" : ""}${formatMoneyBRL(Math.abs(net))}`,
          ],
        },
      },
      {
        heading: "Resultado",
        paragraphs: [
          `No exercício de ${year}, a serventia teve receita de ${money(revenue)} e despesa de ${money(expenses)}, com resultado líquido ${net >= 0 ? "positivo" : "negativo"} de ${money(Math.abs(net))}, nos termos do art. 193 do Código Nacional de Normas (Provimento CNJ nº 149/2023, com a redação do Provimento CNJ nº 259/2026).`,
          ...(tenant.location.state === "RN"
            ? [
                "Balanço elaborado na forma do art. 62 do Código de Normas da Corregedoria Geral de Justiça do Rio Grande do Norte (Provimento nº 156/2016-CGJ/RN), a ser remetido à Corregedoria Geral de Justiça até 5 (cinco) dias depois de sua conclusão, e o livro, visado pelo Juiz Corregedor Permanente até o 15º dia útil de fevereiro (art. 61, parágrafo único).",
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
  };
}

export function buildBookPdfDocument(tenant: Tenant, s: BookSnapshot) {
  return s.kind === "ano"
    ? buildAnnualDocument(tenant, s)
    : buildBookDocument(tenant, s);
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
      "Repasses",
      "ISS",
      "Fornecedor",
      "Documento",
      "Trat. fiscal distinto",
      "Explicação",
    ],
    ...s.entries.map((e) => [
      brDate(e.date),
      e.kind,
      e.kind === "receita" ? e.specialty : categoryLabel(e.category),
      e.actCode,
      e.description,
      e.quantity,
      e.kind === "receita" ? formatMoneyBRL(e.amountCents) : "",
      e.kind === "despesa" ? formatMoneyBRL(e.amountCents) : "",
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
