/**
 * The monthly revenue bulletin, as arithmetic. Money never touches a float
 * here: every value is an integer count of centavos, parsed once at the edge
 * and formatted once at the other, so `48.230,10 − 9.612,44 − 21.480,00`
 * lands on exactly `17.137,66` and not `17.137,659999`.
 *
 * The balance is the whole reason this file is pure and tested: the screen
 * promises the operator a number they never type, and a number nobody types
 * is a number nobody proofreads. It has to be right by construction.
 */

import {
  FUNDS_BY_STATE,
  type FundAmounts,
  groupByRubric,
  type RubricGroup,
  type SupportedState,
} from "./rubrics.ts";

/** A bulletin is preliminary until the month's figures are closed. */
export const BULLETIN_STATUSES = ["preliminary", "consolidated"] as const;
export type BulletinStatus = (typeof BULLETIN_STATUSES)[number];

export const BULLETIN_STATUS_LABELS: Record<BulletinStatus, string> = {
  preliminary: "Preliminar",
  consolidated: "Consolidado",
};

export const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/**
 * What a month's bulletin holds. The funds and ISS are the public share
 * Res. CNJ 670/2025 requires on the site; gross revenue and expenses are the
 * office's own figures, which it may publish or not (see
 * `publishBulletinPrivateFigures`), so they are null when it chose not to.
 */
export interface BulletinFigures {
  actsCount: number;
  fundAmountsCents: FundAmounts;
  issCents: number;
  grossRevenueCents: number | null;
  expensesCents: number | null;
}

/** What went out as taxes: every fund plus the municipal ISS. */
export function bulletinTaxesCents(figures: BulletinFigures): number {
  const funds = Object.values(figures.fundAmountsCents).reduce(
    (sum, cents) => sum + cents,
    0,
  );
  return funds + figures.issCents;
}

/**
 * Balance = what came in, minus the taxes, minus what was spent. Can go
 * negative (a month that spent more than it took) and that is a real answer,
 * not an error: the strip shows it as-is. Null when either private figure is
 * missing, because a balance of half the numbers is not a balance.
 */
export function bulletinBalanceCents(figures: BulletinFigures): number | null {
  if (figures.grossRevenueCents === null || figures.expensesCents === null) {
    return null;
  }
  return (
    figures.grossRevenueCents -
    bulletinTaxesCents(figures) -
    figures.expensesCents
  );
}

/**
 * "48.230,10" or "48230,10" or "48230.10" → 4823010 centavos. Accepts the
 * pt-BR the operator actually types: thousands dots optional, comma or dot as
 * the decimal mark, at most two decimal places. Returns null on anything it
 * cannot read as money, so the caller reports a field error instead of
 * guessing a value into an audited public record.
 */
export function parseMoneyBRL(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Strip a leading R$ and spaces the operator may paste in.
  const cleaned = trimmed.replace(/^R\$\s*/i, "").replace(/\s/g, "");
  // Reject anything that is not digits with one optional decimal mark and
  // grouping dots: no letters, no two commas, no stray signs.
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  // Normalise to a plain "integer.fraction". A comma is always the decimal
  // mark, dots grouping. With no comma, a dot is grouping when it splits the
  // number into thousands ("1.000" is a thousand, pt-BR) and decimal only
  // when it is not ("48230.10" is the dot-decimal an operator may still
  // type): the difference is whether every dotted group is exactly 3 digits.
  let normalized: string;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents =
    Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  return Number.isFinite(cents) ? cents : null;
}

/** A whole non-negative count, for "atos praticados". Null if not that. */
export function parseCount(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

/** 4823010 → "48.230,10". No currency symbol: callers add "R$" where wanted. */
export function formatMoneyBRL(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const grouped = whole.toLocaleString("pt-BR");
  return `${negative ? "-" : ""}${grouped},${fraction}`;
}

/** "Agosto de 2026" from a 1-based month and a year. */
export function formatMonthYear(month: number, year: number): string {
  return `${MONTHS_PT[month - 1]} de ${year}`;
}

/** "01/08 a 31/08/2026": the period a bulletin covers. */
export function bulletinPeriod(month: number, year: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return `01/${mm} a ${String(lastDay).padStart(2, "0")}/${mm}/${year}`;
}

/** The form field that carries a fund's amount. */
export function fundFieldName(key: string): string {
  return `fund-${key}`;
}

/**
 * Parses the bulletin form's raw strings into figures, or returns the field
 * errors that stop it. Every fund of the office's state and the ISS are
 * required, zero included: a month with nothing paid into FUNAF is "0,00",
 * typed, not a blank read as zero. Gross revenue and expenses are required
 * when the office publishes them and ignored when it does not, so a stale
 * value left in a hidden field can never reach the site.
 */
export function parseBulletinFigures(
  state: SupportedState,
  input: {
    actsCount: string;
    funds: Record<string, string>;
    iss: string;
    grossRevenue: string;
    expenses: string;
  },
  options: { privateFigures: boolean },
): { figures: BulletinFigures } | { fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const actsCount = parseCount(input.actsCount);
  if (actsCount === null) fieldErrors.actsCount = "Informe um número inteiro.";

  const fundAmountsCents: FundAmounts = {};
  for (const fund of FUNDS_BY_STATE[state]) {
    const cents = parseMoneyBRL(input.funds[fund.key] ?? "");
    if (cents === null)
      fieldErrors[fundFieldName(fund.key)] = "Valor inválido.";
    else fundAmountsCents[fund.key] = cents;
  }

  const issCents = parseMoneyBRL(input.iss);
  if (issCents === null) fieldErrors.iss = "Valor inválido.";

  let grossRevenueCents: number | null = null;
  let expensesCents: number | null = null;
  if (options.privateFigures) {
    grossRevenueCents = parseMoneyBRL(input.grossRevenue);
    if (grossRevenueCents === null)
      fieldErrors.grossRevenue = "Valor inválido.";
    expensesCents = parseMoneyBRL(input.expenses);
    if (expensesCents === null) fieldErrors.expenses = "Valor inválido.";
  }

  if (
    actsCount === null ||
    issCents === null ||
    Object.keys(fieldErrors).length
  ) {
    return { fieldErrors };
  }
  return {
    figures: {
      actsCount,
      fundAmountsCents,
      issCents,
      grossRevenueCents,
      expensesCents,
    },
  };
}

/** "ISS, tributo municipal (Canguaretama)": the line outside the rubrics. */
export function issLabel(city: string): string {
  return `ISS, tributo municipal (${city})`;
}

export const BALANCE_LABEL = "Saldo final (emolumentos e outras receitas)";

/** The rule the bulletin answers to, printed at its foot. */
export const BULLETIN_LEGAL_BASIS =
  "Receitas públicas discriminadas na forma do art. 6º, § 3º, da Resolução CNJ nº 215/2015, com a redação da Resolução CNJ nº 670/2025.";

/**
 * Everything the preview and the PDF draw, from the same figures and the
 * same rule, so the two never disagree. The private block is there only when
 * the office publishes it now and the month has both figures: switching the
 * option off takes them off every month at once, and a month published while
 * it was off stays without them until it is published again.
 */
export interface BulletinView {
  actsCount: number;
  rubrics: RubricGroup[];
  fundsTotalCents: number;
  issCents: number;
  privateFigures: {
    grossRevenueCents: number;
    taxesCents: number;
    expensesCents: number;
    balanceCents: number;
  } | null;
}

export function bulletinView(
  state: SupportedState,
  figures: BulletinFigures,
  publishPrivateFigures: boolean,
): BulletinView {
  const { rubrics, totalCents } = groupByRubric(
    state,
    figures.fundAmountsCents,
  );
  const balanceCents = bulletinBalanceCents(figures);
  const privateFigures =
    publishPrivateFigures &&
    figures.grossRevenueCents !== null &&
    figures.expensesCents !== null &&
    balanceCents !== null
      ? {
          grossRevenueCents: figures.grossRevenueCents,
          taxesCents: bulletinTaxesCents(figures),
          expensesCents: figures.expensesCents,
          balanceCents,
        }
      : null;
  return {
    actsCount: figures.actsCount,
    rubrics,
    fundsTotalCents: totalCents,
    issCents: figures.issCents,
    privateFigures,
  };
}

/**
 * A bulletin published before Res. CNJ 670/2025: the taxes as one total,
 * no funds. Kept as it was published, because only the office's own guides
 * could split that total into funds; republishing the month in the current
 * format replaces it.
 */
export interface LegacyBulletinFigures {
  actsCount: number;
  grossRevenueCents: number;
  taxesPaidCents: number;
  expensesCents: number;
}

export const LEGACY_BULLETIN_NOTE =
  "Boletim publicado antes da Resolução CNJ nº 670/2025, com os tributos num valor só.";

/** "Tributos pagos (FDJ, FRMP, FCRCPN, FUNAF, ISS)": what the old total held. */
export function legacyTaxesLabel(state: SupportedState): string {
  const names = [...FUNDS_BY_STATE[state].map((f) => f.label), "ISS"];
  return `Tributos pagos (${names.join(", ")})`;
}

export interface LegacyBulletinView {
  actsCount: number;
  taxesCents: number;
  privateFigures: {
    grossRevenueCents: number;
    expensesCents: number;
    balanceCents: number;
  } | null;
}

/**
 * The old bulletin, drawn the way it was published. The same option governs
 * its private figures as the current one's: switching it off takes gross
 * revenue, expenses and balance off the old months too.
 */
export function legacyBulletinView(
  figures: LegacyBulletinFigures,
  publishPrivateFigures: boolean,
): LegacyBulletinView {
  return {
    actsCount: figures.actsCount,
    taxesCents: figures.taxesPaidCents,
    privateFigures: publishPrivateFigures
      ? {
          grossRevenueCents: figures.grossRevenueCents,
          expensesCents: figures.expensesCents,
          balanceCents:
            figures.grossRevenueCents -
            figures.taxesPaidCents -
            figures.expensesCents,
        }
      : null,
  };
}

export function isBulletinStatus(value: string): value is BulletinStatus {
  return (BULLETIN_STATUSES as readonly string[]).includes(value);
}
