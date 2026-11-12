/**
 * The interim's excess, the arithmetic only (CN art. 194), free of imports
 * so the calculator runs it as the numbers are typed. See excess.ts.
 */

export type ExcessPeriod = "trimestral" | "mensal";

/** 90,25%, in basis points. */
export const CEILING_RATE_BP = 9025;

/** 90,25% of the STF minister's monthly pay, rounded to the centavo. */
export function ceilingOf(subsidyCents: number): number {
  return Math.round((subsidyCents * CEILING_RATE_BP) / 10000);
}

export interface ExcessInput {
  period: ExcessPeriod;
  /** "YYYY-MM-DD", first and last day of the period. */
  start: string;
  end: string;
  /** The STF minister's monthly pay, in centavos. */
  subsidyCents: number;
  revenueCents: number;
  /** The expenses allowed (art. 194, IV), the interim's own pay left out. */
  expensesCents: number;
}

export interface ExcessResult {
  months: number;
  ceilingMonthCents: number;
  limitCents: number;
  netCents: number;
  excessCents: number;
  /** What stays with the interim: the net up to the limit. */
  interimPayCents: number;
}

/** Whole months between two days, inclusive ("2026-10-01".."2026-12-31": 3). */
export function monthsBetween(start: string, end: string): number {
  const a = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7));
  const b = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7));
  return Math.max(1, b - a + 1);
}

export function computeExcess(input: ExcessInput): ExcessResult {
  const months = monthsBetween(input.start, input.end);
  const ceilingMonthCents = ceilingOf(input.subsidyCents);
  const limitCents = ceilingMonthCents * months;
  const netCents = input.revenueCents - input.expensesCents;
  const excessCents = Math.max(0, netCents - limitCents);
  return {
    months,
    ceilingMonthCents,
    limitCents,
    netCents,
    excessCents,
    interimPayCents: Math.max(0, Math.min(netCents, limitCents)),
  };
}
