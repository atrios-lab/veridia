/**
 * The Código Nacional de Matrícula (CNN, Provimento CNJ nº 149/2023, art.
 * 330): CCCCCC.L.NNNNNNN-DD, the CNS of the serventia, the book (2 Registro
 * Geral, 3 Registro Auxiliar), the number with seven digits and two check
 * digits by Módulo 97 Base 10 (ISO 7064, art. 330, § 2º).
 *
 * The CNM that counts is the one the PGV-CNM of the ONR returns (art. 333);
 * this calculation is for checking it, and for the lote the office imports
 * there with its own A3.
 */

export type CnmBook = 2 | 3;

const digits = (value: string) => value.replace(/\D/g, "");

/** The six digits of the CNS ("09.461-5" → "094615"), or null. */
export function cnsDigits(cns: string): string | null {
  const d = digits(cns);
  if (!d || d.length > 6) return null;
  return d.padStart(6, "0");
}

/** The two check digits: 98 − (base × 100 mod 97), always two digits. */
export function cnmCheckDigits(
  cns: string,
  book: CnmBook,
  number: number,
): string {
  const office = cnsDigits(cns);
  if (!office) throw new Error("CNS inválido.");
  if (!Number.isInteger(number) || number < 1 || number > 9_999_999) {
    throw new Error("Número de matrícula inválido.");
  }
  const base = BigInt(`${office}${book}${String(number).padStart(7, "0")}`);
  const rest = Number((base * BigInt(100)) % BigInt(97));
  return String(98 - rest).padStart(2, "0");
}

/** The CNM written as the ONR writes it: 094615.2.0000016-59. */
export function cnmOf(cns: string, book: CnmBook, number: number): string {
  const office = cnsDigits(cns);
  if (!office) throw new Error("CNS inválido.");
  return `${office}.${book}.${String(number).padStart(7, "0")}-${cnmCheckDigits(cns, book, number)}`;
}

export interface ParsedCnm {
  cns: string;
  book: CnmBook;
  number: number;
  check: string;
}

/** Reads a CNM with or without the dots and hyphen; null when malformed. */
export function parseCnm(value: string): ParsedCnm | null {
  const d = digits(value);
  if (d.length !== 16) return null;
  const book = Number(d[6]);
  if (book !== 2 && book !== 3) return null;
  const number = Number(d.slice(7, 14));
  if (number < 1) return null;
  return { cns: d.slice(0, 6), book, number, check: d.slice(14) };
}

/** Formats any 16 digits as CCCCCC.L.NNNNNNN-DD; the text as is otherwise. */
export function formatCnm(value: string): string {
  const d = digits(value);
  if (d.length !== 16) return value.trim();
  return `${d.slice(0, 6)}.${d[6]}.${d.slice(7, 14)}-${d.slice(14)}`;
}

export type CnmProblem =
  | "formato"
  | "digito"
  | "serventia"
  | "livro"
  | "numero";

/**
 * What is wrong with a CNM written on a matrícula, against the serventia's
 * CNS, the matrícula's book and number. Empty: it checks.
 */
export function cnmProblems(
  value: string,
  expected: { cns: string; book: CnmBook; number: number },
): CnmProblem[] {
  const parsed = parseCnm(value);
  if (!parsed) return ["formato"];
  const problems: CnmProblem[] = [];
  if (parsed.cns !== cnsDigits(expected.cns)) problems.push("serventia");
  if (parsed.book !== expected.book) problems.push("livro");
  if (parsed.number !== expected.number) problems.push("numero");
  if (parsed.check !== cnmCheckDigits(parsed.cns, parsed.book, parsed.number)) {
    problems.push("digito");
  }
  return problems;
}

export const CNM_PROBLEM_LABELS: Record<CnmProblem, string> = {
  formato: "não tem os 16 dígitos do CNM",
  digito: "o dígito verificador não confere",
  serventia: "o CNS não é o desta serventia",
  livro: "o livro não é o da matrícula",
  numero: "o número não é o da matrícula",
};
