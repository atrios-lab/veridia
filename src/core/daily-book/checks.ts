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
 * Income tax on the person in charge, carnê-leão included. The holder is a
 * private person running a delegated public service, and the tax comes from
 * that activity: holders book it as an expense, and no national rule says
 * otherwise (decision of 11/11/2026). Only the interim is told apart, by the
 * CGJ/RN's code (art. 25, § 2º), so only an interim office is warned. The
 * tax withheld from the staff's pay (IRRF) is payroll (art. 191-A, § 1º,
 * VII) and is not caught.
 */
export function looksLikeIncomeTax(text: string): boolean {
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
 * `interim` is an office run by an interim (the book's settings).
 */
export function expenseWarnings(
  e: ExpenseToCheck,
  today: string,
  options: { isNew?: boolean; interim?: boolean } = {},
): string[] {
  const { isNew = true, interim = false } = options;
  const text = `${e.description} ${e.supplier}`;
  const out: string[] = [];
  if (looksLikeStateFund(text)) {
    out.push(
      "FDJ, FRMP, FCRCPN e FPGE são repasses ao Estado: o livro já lança só os emolumentos como receita, então o repasse não entra de novo como despesa (no RN, o art. 25, § 3º do Código de Normas diz o mesmo).",
    );
  }
  if (interim && looksLikeIncomeTax(text)) {
    out.push(
      "Na serventia sob interinidade, o imposto de renda devido pelo interino não é despesa da serventia (Código de Normas da CGJ/RN, art. 25, § 2º). O IRRF retido dos funcionários continua sendo despesa, como parte da folha.",
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
