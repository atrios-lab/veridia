// The offices the cohort form can pick from (rn-offices.ts), and the search
// over them: what the platform account types, with or without accents, in
// any case, matched word by word against the name, the municipality and the
// CNS. Pure, so the form runs it in the browser as the person types.

export interface OfficeEntry {
  /** Código Nacional de Serventia, six digits. */
  cns: string;
  /** The official name, as the CNJ lists it: what goes on the certificate. */
  name: string;
  /** "Município/UF", the cohort's city field. */
  city: string;
  /** "Titular", "Vaga (interino)"... as the CNJ lists it. */
  status?: string;
  /** Who answers for the office, suggested as the cohort's contact. */
  contactName?: string;
  contactPhone?: string;
}

/** Lower case, no accents, single spaces: "Itaú" and "ITAU" meet. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9º°/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The offices whose name, municipality or CNS hold every word typed, best
 * first: those whose municipality starts with the first word, then the
 * rest, each group in the list's order. Nothing for fewer than two
 * characters, so the list does not open on a single letter.
 */
export function searchOffices(
  offices: readonly OfficeEntry[],
  query: string,
  limit = 8,
): OfficeEntry[] {
  const words = foldText(query).split(" ").filter(Boolean);
  if (words.join("").length < 2) return [];
  const first = words[0] ?? "";
  const hits = offices.filter((office) => {
    const haystack = foldText(`${office.name} ${office.city} ${office.cns}`);
    return words.every((word) => haystack.includes(word));
  });
  const byCity = hits.filter((o) => foldText(o.city).startsWith(first));
  const rest = hits.filter((o) => !foldText(o.city).startsWith(first));
  return [...byCity, ...rest].slice(0, limit);
}
