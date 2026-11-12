import type {
  RequerimentoDocument,
  RequerimentoSection,
} from "../request/requerimento.ts";
import { holderName, officialName } from "../tenant/identification.ts";
import type { Tenant } from "../tenant/schema.ts";
import { formatMoneyBRL } from "../transparency/bulletin.ts";
import { brDate, writtenDate } from "./book.ts";
import { computeExcess, type ExcessInput } from "./excess-calc.ts";

/**
 * The interim's excess over the ceiling (decision of 12/11/2026): the
 * calculator and its "memória de cálculo". The rule is the national code's
 * art. 194 (Provimento CNJ nº 149/2023): an interim keeps the net income of
 * the vacant office up to 90,25% of the pay ("subsídio") of a minister of
 * the STF; what goes over is deposited at the disposal of the Tribunal de
 * Justiça (I), after the expenses the rules allow (IV), every quarter
 * unless a state law sets another period (VI). In RN the Código de Normas
 * sets the month (arts. 19, 26 and 27).
 *
 * For a period of several months the ceiling is the month's ceiling times
 * the months: the receipts and expenses of the quarter are added up (VI),
 * so the ceiling is too.
 */

export {
  CEILING_RATE_BP,
  ceilingOf,
  computeExcess,
  type ExcessInput,
  type ExcessResult,
  monthsBetween,
} from "./excess-calc.ts";

/* ------------------------------------------------------------------ saved */

export interface ExcessCalc extends ExcessInput {
  id: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  removedAt?: string;
  removedBy?: string;
  removeReason?: string;
}

const money = (c: number) => `R$ ${formatMoneyBRL(c)}`;

export function periodLabel(c: Pick<ExcessInput, "start" | "end">): string {
  return `${brDate(c.start)} a ${brDate(c.end)}`;
}

/** The "memória de cálculo", to print and sign or sign digitally. */
export function buildExcessDocument(
  tenant: Tenant,
  c: ExcessCalc,
  issuedOn: string,
): RequerimentoDocument {
  const office = officialName(tenant);
  const r = computeExcess(c);
  const sections: RequerimentoSection[] = [
    {
      heading: "Serventia",
      rows: [
        { label: "Serventia", value: office },
        { label: "CNS", value: tenant.cns },
        {
          label: "Período",
          value: `${periodLabel(c)} (${c.period === "trimestral" ? "trimestral, art. 194, VI" : "mensal, norma estadual"})`,
        },
      ],
    },
    {
      heading: "Cálculo (Código Nacional de Normas, art. 194)",
      rows: [
        { label: "1. Receitas do período", value: money(c.revenueCents) },
        {
          label: "2. Despesas abatidas (art. 194, IV)",
          value: money(c.expensesCents),
        },
        {
          label:
            r.netCents >= 0
              ? "3. Renda líquida (1 - 2)"
              : "3. Resultado negativo (1 - 2)",
          value: money(Math.abs(r.netCents)),
        },
        {
          label: "4. Subsídio mensal de ministro do STF",
          value: money(c.subsidyCents),
        },
        {
          label: "5. Teto do mês: 90,25% de 4",
          value: money(r.ceilingMonthCents),
        },
        {
          label: `6. Teto do período: 5 × ${r.months} ${r.months === 1 ? "mês" : "meses"}`,
          value: money(r.limitCents),
        },
        {
          label: "7. Excedente a depositar (3 - 6, se positivo)",
          value: money(r.excessCents),
        },
        {
          label: "8. Fica com o interino (3, até o limite de 6)",
          value: money(r.interimPayCents),
        },
      ],
    },
    {
      heading: "Resultado",
      paragraphs: [
        r.excessCents > 0
          ? `A renda líquida do período (${money(r.netCents)}) passou do teto (${money(r.limitCents)}) em ${money(r.excessCents)}. Esse valor é depositado à disposição do Tribunal de Justiça e lançado no Livro Diário Auxiliar com a data do depósito e a conta (art. 194, I).`
          : `A renda líquida do período (${money(Math.max(0, r.netCents))}) não passou do teto (${money(r.limitCents)}): não há excedente a depositar.`,
        ...(c.notes.trim() ? [c.notes.trim()] : []),
      ],
    },
  ];
  return {
    eyebrow: "Responsável interino",
    title: "Memória de cálculo do excedente",
    subtitle: `90,25% dos subsídios de ministro do STF · ${periodLabel(c)}`,
    office: [office, tenant.subtitle],
    sections,
    dateLine: `${tenant.location.city}/${tenant.location.state}, ${writtenDate(issuedOn)}.`,
    signee: holderName(tenant) || undefined,
    signature: [tenant.holderTitle || "Responsável interino"],
    footer: `${office} · Excedente do interino · ${periodLabel(c)} · ${tenant.legalFooter}`,
  };
}
