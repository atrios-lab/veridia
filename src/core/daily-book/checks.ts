/**
 * Notices shown while an expense is typed into the Livro Diário Auxiliar
 * (decision of 11/11/2026: the book follows the text of the law, with no
 * reading of our own). Each notice repeats a rule written in the law and
 * says where; none refuses the entry.
 *
 * - Código Nacional de Normas (Provimento CNJ nº 149/2023, with the wording
 *   of the Provimento CNJ nº 259/2026), art. 191-A, caput: "As despesas
 *   serão escrituradas no Livro Diário Auxiliar até o encerramento do mês em
 *   que se efetivarem".
 * - Código de Normas da CGJ/RN (Provimento nº 156/2016), art. 25, § 2º, in
 *   force where it agrees with the national code (art. 195, parágrafo
 *   único): "O Imposto de Renda devido pelo interino não é considerado como
 *   despesa da serventia."
 *
 * Kept free of imports so the entry form can run it as the user types.
 */

export interface ExpenseToCheck {
  description: string;
  supplier: string;
  /** "YYYY-MM-DD": the day it was paid. */
  date: string;
}

/** Art. 191-A, § 2º, as written: shown on every expense form. */
export const PERSONAL_EXPENSE_RULE =
  "Não poderão ser lançadas despesas de natureza exclusivamente pessoal ou estranhas à prestação do serviço delegado (art. 191-A, § 2º).";

/** Art. 191-A, § 3º, as written. */
export const RECEIPTS_RULE =
  "Os documentos comprobatórios das despesas serão conservados pelo prazo mínimo de 5 (cinco) anos, sem prejuízo de prazo superior previsto em lei (art. 191-A, § 3º).";

/**
 * The words that name income tax in an expense's description. Used only for
 * the interim's (CGJ/RN art. 25, § 2º); the tax withheld from the staff's
 * pay (IRRF) is not that tax and is not caught.
 */
export function looksLikeIncomeTax(text: string): boolean {
  return /carn[êe][\s-]?le[ãa]o|\bIRPF\b|imposto de renda (?:pessoa f[íi]sica|d[oa] (?:titular|tabeli[ãa]o?|tabeli[ãa]|delegat[áa]ri[oa]|interin[oa]|oficial|registrador[a]?))/i.test(
    text,
  );
}

/** Art. 191-A, caput: the expense of a month gone by, booked only now. */
export function bookedLate(date: string, today: string): boolean {
  return /^\d{4}-\d{2}/.test(date) && date.slice(0, 7) < today.slice(0, 7);
}

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

/**
 * The notices for an expense. `isNew` is false when an entry already booked
 * is being corrected: its month is not late then. `interim` is an office
 * run by an interim (the book's settings).
 */
export function expenseWarnings(
  e: ExpenseToCheck,
  today: string,
  options: { isNew?: boolean; interim?: boolean } = {},
): string[] {
  const { isNew = true, interim = false } = options;
  const out: string[] = [];
  if (isNew && bookedLate(e.date, today)) {
    const month = MONTHS[Number(e.date.slice(5, 7)) - 1] ?? "";
    out.push(
      `Despesa de ${month} de ${e.date.slice(0, 4)}: "As despesas serão escrituradas no Livro Diário Auxiliar até o encerramento do mês em que se efetivarem" (art. 191-A).`,
    );
  }
  if (interim && looksLikeIncomeTax(`${e.description} ${e.supplier}`)) {
    out.push(
      `"O Imposto de Renda devido pelo interino não é considerado como despesa da serventia" (Código de Normas da CGJ/RN, art. 25, § 2º).`,
    );
  }
  return out;
}
