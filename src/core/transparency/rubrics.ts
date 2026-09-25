/**
 * The public share of what an office collects, as art. 6º, § 3º, of Res. CNJ
 * 215/2015 (as rewritten by Res. CNJ 670/2025) wants it shown: grouped into
 * four rubrics. The rubrics are national; the funds that fill them are not.
 * Each state's fee table adds its own funds on top of the emolument, under its
 * own names, so the map from fund to rubric is per state.
 *
 * The bulletin stores the amount per fund, never per rubric. The rubric is
 * read from this map when the bulletin is shown, because § 3º-C lets each
 * state's Corregedoria reclassify a fund: when it does, this map changes and
 * every bulletin, old and new, reads the new way. What was paid into each
 * fund never changes.
 */

/** The four rubrics, in the resolution's own order and words. */
export const RUBRICS = {
  I: "Emolumentos (parcela pública)",
  II: "Fundo de Reaparelhamento da Justiça",
  III: "Fundo de Compensação",
  IV: "Outros Fundos Especiais",
} as const;
export type Rubric = keyof typeof RUBRICS;

const RUBRIC_ORDER: readonly Rubric[] = ["I", "II", "III", "IV"];

/** A fund as the state's fee table names it, and the rubric it falls under. */
export interface Fund {
  /** Stable storage key, lower case: what the bulletin row is keyed by. */
  key: string;
  /** The fee table's own column name, which is what the operator reads. */
  label: string;
  rubric: Rubric;
}

/** The states whose fund map exists. An office elsewhere fails validation. */
export const SUPPORTED_STATES = ["RN"] as const;
export type SupportedState = (typeof SUPPORTED_STATES)[number];

/**
 * Per state, in the order of the fee table's columns, which is also the order
 * of the fields on the form.
 *
 * RN: FDJ is the TJRN's fund (II); FCRCPN is by name the civil registry's
 * compensation fund (III); FRMP (the Ministério Público's) and FUNAF are read
 * as "other special funds" (IV). No RN column is a public share inside the
 * emolument itself, so rubric I has no fund here and is not shown. The
 * CGJ-RN has not classified these under § 3º-C yet: this is our reading, and
 * correcting it is a change to this array alone.
 */
export const FUNDS_BY_STATE: Record<SupportedState, readonly Fund[]> = {
  RN: [
    { key: "fdj", label: "FDJ", rubric: "II" },
    { key: "frmp", label: "FRMP", rubric: "IV" },
    { key: "fcrcpn", label: "FCRCPN", rubric: "III" },
    { key: "funaf", label: "FUNAF", rubric: "IV" },
  ],
};

/** Centavos paid into each fund in the month, keyed by `Fund.key`. */
export type FundAmounts = Record<string, number>;

export interface RubricGroup {
  rubric: Rubric;
  title: string;
  subtotalCents: number;
  funds: { key: string; label: string; amountCents: number }[];
}

/**
 * The funds of a month, grouped as the resolution lists them. A rubric no
 * fund of the state falls under is left out, not shown as zero: a zero would
 * claim the office collected nothing under it, when it has nothing to collect.
 * The total is the funds' alone; ISS is a municipal tax, outside the rubrics.
 */
export function groupByRubric(
  state: SupportedState,
  amounts: FundAmounts,
): { rubrics: RubricGroup[]; totalCents: number } {
  const funds = FUNDS_BY_STATE[state];
  const rubrics: RubricGroup[] = [];
  for (const rubric of RUBRIC_ORDER) {
    const members = funds.filter((f) => f.rubric === rubric);
    if (members.length === 0) continue;
    const lines = members.map((f) => ({
      key: f.key,
      label: f.label,
      amountCents: amounts[f.key] ?? 0,
    }));
    rubrics.push({
      rubric,
      title: RUBRICS[rubric],
      subtotalCents: lines.reduce((sum, l) => sum + l.amountCents, 0),
      funds: lines,
    });
  }
  const totalCents = rubrics.reduce((sum, r) => sum + r.subtotalCents, 0);
  return { rubrics, totalCents };
}

/**
 * Reads a stored or submitted set of amounts, or null if it is not exactly
 * the state's funds with a whole, non-negative number of centavos each. A
 * missing fund is not read as zero: an amount nobody typed must never reach a
 * public record as if it had been.
 */
export function parseFundAmounts(
  state: SupportedState,
  value: unknown,
): FundAmounts | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const keys = FUNDS_BY_STATE[state].map((f) => f.key);
  if (Object.keys(record).length !== keys.length) return null;
  const amounts: FundAmounts = {};
  for (const key of keys) {
    const amount = record[key];
    if (
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) ||
      amount < 0
    ) {
      return null;
    }
    amounts[key] = amount;
  }
  return amounts;
}
