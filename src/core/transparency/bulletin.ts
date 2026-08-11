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

/** The four figures the office types, in centavos (actsCount is a plain count). */
export interface BulletinFigures {
  actsCount: number;
  grossRevenueCents: number;
  taxesPaidCents: number;
  expensesCents: number;
}

/**
 * Balance = what came in, minus what was owed, minus what was spent. Can go
 * negative (a month that spent more than it took) and that is a real answer,
 * not an error: the strip shows it as-is.
 */
export function bulletinBalanceCents(figures: BulletinFigures): number {
  return (
    figures.grossRevenueCents - figures.taxesPaidCents - figures.expensesCents
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

/**
 * Parses the bulletin form's raw strings into figures, or returns the field
 * errors that stop it. Money and count parsing live in the pure helpers
 * above; this only assembles them and names which field failed, so the action
 * layer stays thin and the rule is testable without a request.
 */
export function parseBulletinFigures(input: {
  actsCount: string;
  grossRevenue: string;
  taxesPaid: string;
  expenses: string;
}): { figures: BulletinFigures } | { fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const actsCount = parseCount(input.actsCount);
  if (actsCount === null) fieldErrors.actsCount = "Informe um número inteiro.";
  const grossRevenueCents = parseMoneyBRL(input.grossRevenue);
  if (grossRevenueCents === null) fieldErrors.grossRevenue = "Valor inválido.";
  const taxesPaidCents = parseMoneyBRL(input.taxesPaid);
  if (taxesPaidCents === null) fieldErrors.taxesPaid = "Valor inválido.";
  const expensesCents = parseMoneyBRL(input.expenses);
  if (expensesCents === null) fieldErrors.expenses = "Valor inválido.";

  if (
    actsCount === null ||
    grossRevenueCents === null ||
    taxesPaidCents === null ||
    expensesCents === null
  ) {
    return { fieldErrors };
  }
  return {
    figures: { actsCount, grossRevenueCents, taxesPaidCents, expensesCents },
  };
}

export function isBulletinStatus(value: string): value is BulletinStatus {
  return (BULLETIN_STATUSES as readonly string[]).includes(value);
}
