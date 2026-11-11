import type { ReportFigures } from "../iss/notaris-report.ts";

/**
 * The monthly bulletin (Transparência) filled from the same productivity
 * reports the Livro Diário Auxiliar reads (decision of 11/11/2026): one
 * upload, and the office picks the book, the bulletin or both. Nothing here
 * publishes: the figures open on the bulletin's form, which asks for the
 * check ("Conferi os valores"), offers the digital signature and publishes.
 */

export interface BookBulletinFigures {
  actsCount: number;
  issCents: number;
  /** By the bulletin's fund keys (RN: fdj, frmp, fcrcpn, funaf). */
  fundAmountsCents: Record<string, number>;
  /** [E] of the reports, when every report printed it. */
  grossRevenueCents?: number;
  /** [C] of the reports, when every report printed it. */
  expensesCents?: number;
}

export interface BookBulletin {
  /** "YYYY-MM" */
  month: string;
  figures: BookBulletinFigures;
  /** "relatorio": one report of the month; "dias": the days in the book. */
  source: "relatorio" | "dias";
  /** "YYYY-MM-DD" of each day read into the book (source "dias"). */
  days: string[];
  /** The report's period (source "relatorio"). */
  start?: string;
  end?: string;
  /** The expenses booked in the book that month, for comparison. */
  bookExpensesCents?: number;
}

/** Sums reports' totals; a total some report lacks is left out. */
export function sumReadings(
  readings: readonly ReportFigures[],
): BookBulletinFigures {
  const total: BookBulletinFigures = {
    actsCount: 0,
    issCents: 0,
    fundAmountsCents: {},
  };
  let gross = 0;
  let expenses = 0;
  let allGross = readings.length > 0;
  let allExpenses = readings.length > 0;
  for (const r of readings) {
    total.actsCount += r.actsCount ?? 0;
    total.issCents += r.issCents ?? 0;
    for (const [key, cents] of Object.entries(r.funds ?? {})) {
      total.fundAmountsCents[key] = (total.fundAmountsCents[key] ?? 0) + cents;
    }
    if (r.grossRevenueCents === undefined) allGross = false;
    else gross += r.grossRevenueCents;
    if (r.expensesCents === undefined) allExpenses = false;
    else expenses += r.expensesCents;
  }
  if (allGross) total.grossRevenueCents = gross;
  if (allExpenses) total.expensesCents = expenses;
  return total;
}

/** Two sets of totals added up (a total either lacks is left out). */
export function addFigures(
  a: BookBulletinFigures,
  b: BookBulletinFigures,
): BookBulletinFigures {
  const funds: Record<string, number> = { ...a.fundAmountsCents };
  for (const [key, cents] of Object.entries(b.fundAmountsCents)) {
    funds[key] = (funds[key] ?? 0) + cents;
  }
  return {
    actsCount: a.actsCount + b.actsCount,
    issCents: a.issCents + b.issCents,
    fundAmountsCents: funds,
    ...(a.grossRevenueCents !== undefined && b.grossRevenueCents !== undefined
      ? { grossRevenueCents: a.grossRevenueCents + b.grossRevenueCents }
      : {}),
    ...(a.expensesCents !== undefined && b.expensesCents !== undefined
      ? { expensesCents: a.expensesCents + b.expensesCents }
      : {}),
  };
}

/** The last day of "YYYY-MM". */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y ?? 2000, m ?? 1, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

/**
 * Preliminary while the month is open; consolidated once it is over and
 * the figures cover it (a report of the whole month, or the book's days).
 */
export function bulletinStatusFor(
  b: BookBulletin,
  today: string,
): "preliminary" | "consolidated" {
  return today > monthEnd(b.month) ? "consolidated" : "preliminary";
}

const br = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** One line for the bulletin's form: where the figures came from. */
export function bulletinSourceNote(b: BookBulletin): string {
  if (b.source === "relatorio") {
    return `Valores do relatório de produtividade de ${b.start ? br(b.start) : ""} a ${b.end ? br(b.end) : ""}, anexado no Livro Diário Auxiliar.`;
  }
  const days = b.days.map((d) => d.slice(8, 10)).join(", ");
  return `Soma dos relatórios de produtividade de ${b.days.length} dia(s) lançados no Livro Diário Auxiliar (dias ${days || "nenhum"}).`;
}
