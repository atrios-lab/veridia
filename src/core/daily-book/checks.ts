/**
 * What to warn about before an expense goes into the Livro Diário Auxiliar
 * (decision of 11/11/2026). A warning never refuses the entry: the holder
 * may know better, and says why in the entry's explanation, which goes into
 * the book.
 *
 * The national rule comes first (Código Nacional de Normas, Provimento CNJ
 * nº 149/2023, with the wording of the Provimento CNJ nº 259/2026); the
 * state's Código de Normas stays where it agrees with it (art. 195,
 * parágrafo único). For RN that is the Provimento nº 156/2016-CGJ/RN.
 *
 * Kept free of imports so the entry form can run it as the user types.
 */

export interface ExpenseToCheck {
  description: string;
  supplier: string;
  /** "YYYY-MM-DD": the day it was paid. */
  date: string;
}

/** Art. 191-A, § 2º: personal, or foreign to the service. */
export function looksPersonal(text: string): boolean {
  return /\b(pessoal|particular|fam[ií]lia|resid[êe]ncia|casa (?:de|do|da)|escola d[oa]s? filh|viagem de f[ée]rias|supermercado|farm[áa]cia)\b/i.test(
    text,
  );
}

/**
 * The State's funds in the fee guides (FDJ, FRMP, FCRCPN, FPGE): passed on
 * to the State, already out of the revenue. CGJ/RN, art. 25, § 3º.
 */
export function looksLikeStateFund(text: string): boolean {
  return /\b(FDJ|FRMP|FCRCPN|FPGE|Fundo de Desenvolvimento da Justi[çc]a|Fundo de Reaparelhamento do Minist[ée]rio P[úu]blico|Fundo de Compensa[çc][ãa]o aos Registradores)\b/i.test(
    text,
  );
}

/**
 * The holder's (or the interim's) own income tax, carnê-leão included: not
 * an expense of the office (art. 191-A, § 2º; CGJ/RN, art. 25, § 2º). The
 * tax withheld from the staff's pay (IRRF) is, as part of the payroll
 * (art. 191-A, § 1º, VII), so it is not caught here.
 */
export function looksLikeHolderIncomeTax(text: string): boolean {
  return /carn[êe][\s-]?le[ãa]o|\bIRPF\b|imposto de renda (?:pessoa f[íi]sica|d[oa] (?:titular|tabeli[ãa]o?|tabeli[ãa]|delegat[áa]ri[oa]|interin[oa]|oficial|registrador[a]?))/i.test(
    text,
  );
}

/** Art. 191-A: the expense of a month gone by, booked only now. */
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
 * Every warning for an expense, in plain words. `isNew` is false when an
 * entry already booked is being corrected: its month is not late then.
 */
export function expenseWarnings(
  e: ExpenseToCheck,
  today: string,
  isNew = true,
): string[] {
  const text = `${e.description} ${e.supplier}`;
  const out: string[] = [];
  if (looksLikeStateFund(text)) {
    out.push(
      "FDJ, FRMP, FCRCPN e FPGE são repasses ao Estado e não são despesa da serventia: já saem da receita no relatório de produtividade (Código de Normas da CGJ/RN, art. 25, § 3º).",
    );
  }
  if (looksLikeHolderIncomeTax(text)) {
    out.push(
      "O imposto de renda do titular ou do interino, inclusive o carnê-leão, não é despesa da serventia (art. 191-A, § 2º; CGJ/RN, art. 25, § 2º). O IRRF retido dos funcionários é, como parte da folha (inciso VII).",
    );
  }
  if (looksPersonal(text)) {
    out.push(
      "Despesa de natureza pessoal ou estranha ao serviço não pode ser lançada (art. 191-A, § 2º).",
    );
  }
  if (isNew && bookedLate(e.date, today)) {
    const month = MONTHS[Number(e.date.slice(5, 7)) - 1] ?? "";
    out.push(
      `Despesa paga em ${month} de ${e.date.slice(0, 4)}: o prazo para lançá-la era o fim daquele mês (art. 191-A). Pode lançar agora, explicando o atraso.`,
    );
  }
  return out;
}
