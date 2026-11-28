/**
 * The índice of the Protocolo, by book (decision of 28/11/2026): the
 * apresentantes in alphabetical order, each with the date, the natureza
 * formal do título, the número de ordem and the folha where it is. The
 * Lei nº 6.015/1973 has no model for it (its models are of the Livros 1 to
 * 5): it is an auxiliary índice of the office (Provimento nº 156/2016-
 * CGJ/RN, art. 73).
 */

export interface IndexEntry {
  presenter: string;
  presentedOn: string;
  titleKind: string;
  number: number;
  /** "74" or "74-v"; empty when the folha is unknown. */
  sheet: string;
}

const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

/** Alphabetical by apresentante, then by número. */
export function protocolIndex(entries: readonly IndexEntry[]): IndexEntry[] {
  return [...entries].sort(
    (a, b) =>
      fold(a.presenter).localeCompare(fold(b.presenter), "pt-BR") ||
      a.number - b.number,
  );
}

/** The rows whose apresentante, natureza or número match what was typed. */
export function searchIndex(
  entries: readonly IndexEntry[],
  query: string,
): IndexEntry[] {
  const q = fold(query);
  if (!q) return [...entries];
  const digits = q.replace(/\D/g, "");
  return entries.filter(
    (e) =>
      fold(e.presenter).includes(q) ||
      fold(e.titleKind).includes(q) ||
      (/^[\d.\s]+$/.test(q) && digits !== "" && String(e.number) === digits),
  );
}

/** The first letter the índice groups an apresentante under. */
export function letterOf(presenter: string): string {
  const first = fold(presenter).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}
