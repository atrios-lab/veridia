import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { holderName, officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatMoneyBRL } from "../transparency/bulletin.ts";
import { type BookEntry, brDate, writtenDate } from "./book.ts";

/**
 * The semester's figures as the "Justiça Aberta" form asks for them
 * (decision of 12/11/2026), so the office copies them in instead of adding
 * up the productivity reports by hand. Provimento CNJ nº 24/2012, art. 2º:
 * "Os responsáveis pelos serviços notariais e de registro deverão alimentar
 * semestralmente e diretamente, via internet, todos os dados no sistema
 * 'Justiça Aberta' até o dia 15 dos meses de JANEIRO e JULHO (ou até o
 * próximo dia útil subsequente)"; the parágrafo único names "os dados de
 * produtividade, arrecadação".
 *
 * The fields are the form's own, in its order ("Produtividade do
 * cartório", step 4 of 7): per specialty, "Atos praticados", "Receita
 * própria - Emolumentos", "Receita terceiros - Legal", "Receita terceiros -
 * Outros" and "Receitas totais"; then "Despesas de funcionamento",
 * "Despesas legais", "Outras Despesas" and "Despesas totais"; then "Receita
 * bruta total", "(-) Despesas totais" and "Resultado Liquido".
 *
 * How the office fills them, as the office decided (12/11/2026), and as it
 * already did in the form:
 * - "Receita própria - Emolumentos": the emolumentos the book takes as
 *   revenue (CN art. 190, § 3º), by specialty;
 * - "Receita terceiros - Legal": R$ 0,00; the funds and the ISS are shown
 *   beside, for reference, and declared nowhere;
 * - "Receita terceiros - Outros": the FCRCPN repasse received in the
 *   semester, in the Registro Civil das Pessoas Naturais;
 * - "Despesas de funcionamento": every expense of the book; "legais" and
 *   "outras" R$ 0,00.
 */

export const CNJ_SPECIALTIES = [
  { id: "rcpn", label: "Registro Civil das Pessoas Naturais" },
  { id: "notas", label: "Notas" },
  { id: "ri", label: "Registro de Imóveis" },
  { id: "protesto", label: "Protesto de Títulos" },
  { id: "rtd", label: "Registro de Títulos e Documentos" },
  { id: "rcpj", label: "Registro Civil das Pessoas Jurídicas" },
] as const;
export type CnjSpecialty = (typeof CNJ_SPECIALTIES)[number]["id"];

const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The form's specialty for the name the book gives a specialty (Livro ›
 * Configurar), by the words of the name. `null` when the name says none of
 * them, or more than one (an office that books "Títulos e Documentos e
 * Pessoas Jurídicas" together has to split it): the panel says so instead
 * of guessing.
 */
export function cnjSpecialtyOf(name: string): CnjSpecialty | null {
  const n = plain(name);
  const found = new Set<CnjSpecialty>();
  if (/pessoas? naturais|\brcpn\b/.test(n)) found.add("rcpn");
  if (/pessoas? juridicas|\brcpj\b/.test(n)) found.add("rcpj");
  if (/titulos e documentos|\brtd\b/.test(n)) found.add("rtd");
  if (/protesto/.test(n)) found.add("protesto");
  if (/imoveis|\bri\b/.test(n)) found.add("ri");
  if (/\bnotas\b|tabelionato|tabeliao/.test(n)) found.add("notas");
  return found.size === 1 ? ([...found][0] ?? null) : null;
}

/* ---------------------------------------------------------------- semester */

/** "2026-1": January to June; "2026-2": July to December. */
export type SemesterId = `${number}-${1 | 2}`;

export interface Semester {
  id: SemesterId;
  start: string;
  end: string;
  /** "01/01/2026 a 30/06/2026", as the form lists its periods. */
  label: string;
  /** The months, "YYYY-MM". */
  months: string[];
}

export function parseSemester(id: string): Semester | null {
  const m = /^(\d{4})-([12])$/.exec(id);
  if (!m) return null;
  const year = Number(m[1]);
  const half = Number(m[2]) as 1 | 2;
  const start = half === 1 ? `${year}-01-01` : `${year}-07-01`;
  const end = half === 1 ? `${year}-06-30` : `${year}-12-31`;
  const first = half === 1 ? 1 : 7;
  return {
    id: `${year}-${half}`,
    start,
    end,
    label: `${brDate(start)} a ${brDate(end)}`,
    months: Array.from(
      { length: 6 },
      (_, i) => `${year}-${String(first + i).padStart(2, "0")}`,
    ),
  };
}

/**
 * The semester to fill on a day: the one that just ended (in January, the
 * second half of last year; in July, the first half of this year); later in
 * a semester, the one before it, which is the last one the form can take.
 */
export function semesterToFill(today: string): SemesterId {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return month <= 6 ? `${year - 1}-2` : `${year}-1`;
}

export function shiftSemester(id: SemesterId, by: -1 | 1): SemesterId {
  const [y, h] = id.split("-").map(Number) as [number, number];
  const index = y * 2 + (h - 1) + by;
  return `${Math.floor(index / 2)}-${((index % 2) + 1) as 1 | 2}`;
}

/* ------------------------------------------------------------------ FCRCPN */

/**
 * A repasse of the FCRCPN (the compensation of the Registro Civil's free
 * acts) received by the office. What the office types from the statement
 * of whoever paid it; the value that goes to the form is the one received,
 * since the form asks for "Valores recebidos pelo cartório".
 */
export interface FcrcpnRepasse {
  id: string;
  /** "YYYY-MM-DD": the day the money came in. */
  receivedOn: string;
  /** "YYYY-MM": the month of the acts compensated, when the statement says. */
  competence: string;
  /** Who paid it ("ANOREG/RN", say). */
  payer: string;
  /** What came into the account. */
  receivedCents: number;
  /** Income tax withheld at source, when the statement shows it. */
  withheldCents: number;
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  removedAt?: string;
  removedBy?: string;
  removeReason?: string;
}

/** What is kept: the repasses, and the semesters declared without one. */
export interface FcrcpnRecord {
  repasses: FcrcpnRepasse[];
  /** Semesters the office said had no repasse. */
  noneIn: SemesterId[];
}

export function repassesIn(
  record: FcrcpnRecord,
  semester: Pick<Semester, "start" | "end">,
): FcrcpnRepasse[] {
  return record.repasses
    .filter(
      (r) =>
        !r.removedAt &&
        r.receivedOn >= semester.start &&
        r.receivedOn <= semester.end,
    )
    .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
}

/* ----------------------------------------------------------------- figures */

export interface SpecialtyFigures {
  id: CnjSpecialty;
  label: string;
  acts: number;
  ownCents: number;
  legalCents: number;
  otherCents: number;
  totalCents: number;
}

export interface JusticaAbertaFigures {
  specialties: SpecialtyFigures[];
  expenses: {
    operatingCents: number;
    legalCents: number;
    otherCents: number;
    totalCents: number;
  };
  grossCents: number;
  netCents: number;
  /** Book specialties the form's names could not be found in. */
  unmatched: { name: string; acts: number; cents: number }[];
  /** For reference, declared nowhere. */
  fundsCents: number;
  issCents: number;
  /** The interim's deposits of the excess (CN art. 194, V). */
  deposits: { date: string; cents: number; description: string }[];
  fcrcpn: FcrcpnRepasse[];
  fcrcpnCents: number;
  /** Months of the semester with no revenue in the book. */
  monthsWithoutRevenue: string[];
}

export function justicaAbertaFigures(
  entries: readonly BookEntry[],
  semester: Semester,
  fcrcpn: readonly FcrcpnRepasse[],
): JusticaAbertaFigures {
  const inside = entries.filter(
    (e) => e.date >= semester.start && e.date <= semester.end,
  );
  const by = new Map<CnjSpecialty, { acts: number; cents: number }>();
  const unmatched = new Map<string, { acts: number; cents: number }>();
  let funds = 0;
  let iss = 0;
  let expenses = 0;
  const withRevenue = new Set<string>();
  const deposits: JusticaAbertaFigures["deposits"] = [];
  for (const e of inside) {
    if (e.kind === "deposito") {
      deposits.push({
        date: e.date,
        cents: e.amountCents,
        description: e.description,
      });
      continue;
    }
    if (e.kind === "despesa") {
      expenses += e.amountCents;
      continue;
    }
    funds += e.fundsCents;
    iss += e.issCents;
    withRevenue.add(e.date.slice(0, 7));
    const id = cnjSpecialtyOf(e.specialty);
    const bucket = id
      ? (by.get(id) ?? { acts: 0, cents: 0 })
      : (unmatched.get(e.specialty || "Sem especialidade") ?? {
          acts: 0,
          cents: 0,
        });
    bucket.acts += e.quantity;
    bucket.cents += e.amountCents;
    if (id) by.set(id, bucket);
    else unmatched.set(e.specialty || "Sem especialidade", bucket);
  }
  const fcrcpnCents = fcrcpn.reduce((sum, r) => sum + r.receivedCents, 0);
  const specialties = CNJ_SPECIALTIES.map(({ id, label }) => {
    const own = by.get(id) ?? { acts: 0, cents: 0 };
    const other = id === "rcpn" ? fcrcpnCents : 0;
    return {
      id,
      label,
      acts: own.acts,
      ownCents: own.cents,
      legalCents: 0,
      otherCents: other,
      totalCents: own.cents + other,
    };
  });
  const gross = specialties.reduce((sum, s) => sum + s.totalCents, 0);
  return {
    specialties,
    expenses: {
      operatingCents: expenses,
      legalCents: 0,
      otherCents: 0,
      totalCents: expenses,
    },
    grossCents: gross,
    netCents: gross - expenses,
    unmatched: [...unmatched].map(([name, v]) => ({ name, ...v })),
    fundsCents: funds,
    issCents: iss,
    deposits,
    fcrcpn: [...fcrcpn],
    fcrcpnCents,
    monthsWithoutRevenue: semester.months.filter((m) => !withRevenue.has(m)),
  };
}

/* -------------------------------------------------------------------- PDF */

const money = (c: number) => `R$ ${formatMoneyBRL(c)}`;

/**
 * The figures on paper, to check against the form and keep: the office's
 * own record of what it declared, signed digitally or by hand.
 */
export function buildJusticaAbertaDocument(
  tenant: Tenant,
  semester: Semester,
  f: JusticaAbertaFigures,
  issuedOn: string,
  signer: { name: string; title: string } | null,
  interim: boolean,
): RequerimentoDocument {
  const office = officialName(tenant);
  const sections: RequerimentoSection[] = [
    {
      heading: "Serventia",
      rows: [
        { label: "Serventia", value: office },
        { label: "CNS", value: tenant.cns },
        { label: "Período", value: semester.label },
      ],
    },
    {
      heading: "Especialidades",
      table: {
        columns: [
          { label: "Especialidade", weight: 2.2 },
          { label: "Atos", align: "right", weight: 0.6 },
          { label: "Receita própria: emolumentos (R$)", align: "right" },
          { label: "Terceiros: legal (R$)", align: "right" },
          { label: "Terceiros: outros (R$)", align: "right" },
          { label: "Receitas totais (R$)", align: "right" },
        ],
        rows: f.specialties.map((s) => [
          s.label,
          s.acts.toLocaleString("pt-BR"),
          formatMoneyBRL(s.ownCents),
          formatMoneyBRL(s.legalCents),
          formatMoneyBRL(s.otherCents),
          formatMoneyBRL(s.totalCents),
        ]),
      },
    },
    {
      heading: "Despesas (totais do período, todas as especialidades)",
      rows: [
        {
          label: "Despesas de funcionamento",
          value: money(f.expenses.operatingCents),
        },
        { label: "Despesas legais", value: money(f.expenses.legalCents) },
        { label: "Outras despesas", value: money(f.expenses.otherCents) },
        { label: "Despesas totais", value: money(f.expenses.totalCents) },
      ],
    },
    {
      heading: "Resultado consolidado do cartório",
      rows: [
        { label: "Receita bruta total", value: money(f.grossCents) },
        {
          label: "(-) Despesas totais",
          value: money(f.expenses.totalCents),
        },
        {
          label:
            f.netCents >= 0
              ? "Resultado líquido"
              : "Resultado líquido negativo",
          value: money(Math.abs(f.netCents)),
        },
      ],
    },
  ];
  if (f.fcrcpn.length) {
    sections.push({
      heading: "Repasse do FCRCPN (em Receita terceiros: outros, do RCPN)",
      table: {
        columns: [
          { label: "Recebido em", weight: 1 },
          { label: "Competência", weight: 1 },
          { label: "Pago por", weight: 1.4 },
          { label: "IR retido (R$)", align: "right" },
          { label: "Recebido (R$)", align: "right" },
        ],
        rows: f.fcrcpn.map((r) => [
          brDate(r.receivedOn),
          r.competence
            ? `${r.competence.slice(5, 7)}/${r.competence.slice(0, 4)}`
            : "",
          r.payer,
          formatMoneyBRL(r.withheldCents),
          formatMoneyBRL(r.receivedCents),
        ]),
        total: ["Total", "", "", "", formatMoneyBRL(f.fcrcpnCents)],
      },
    });
  }
  if (interim && f.deposits.length) {
    sections.push({
      heading: "Depósitos do excedente do interino (CN art. 194, V)",
      table: {
        columns: [
          { label: "Data", weight: 1 },
          { label: "Lançamento", weight: 3 },
          { label: "Valor (R$)", align: "right" },
        ],
        rows: f.deposits.map((d) => [
          brDate(d.date),
          d.description,
          formatMoneyBRL(d.cents),
        ]),
      },
    });
  }
  sections.push({
    heading: "Origem dos valores",
    paragraphs: [
      `Valores extraídos do Livro Diário Auxiliar da Receita e da Despesa desta serventia, para alimentar o sistema "Justiça Aberta" (Provimento CNJ nº 24/2012, art. 2º). A receita própria corresponde aos emolumentos lançados como receita do delegatário (Código Nacional de Normas, art. 190, § 3º). Fundos e ISS do período (${money(f.fundsCents + f.issCents)}) não foram lançados como receita nem declarados como receita de terceiros.`,
    ],
  });
  return {
    eyebrow: "Justiça Aberta",
    title: "Produtividade do cartório",
    subtitle: `Atos, arrecadação, despesas e resultado · ${semester.label}`,
    office: [office, tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(issuedOn)}.`,
    signee: signer?.name || holderName(tenant) || undefined,
    signature: [signer?.title || tenant.holderTitle || "Tabelião/Registrador"],
    footer: `${office} · Justiça Aberta · ${semester.label} · ${tenant.legalFooter}`,
  };
}
