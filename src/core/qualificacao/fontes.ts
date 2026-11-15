import { isOfficialUrl, normsIn, sameNorm } from "../conhecimento/base.ts";

/**
 * The Assistente Virtual never invents (decision of 15/11/2026: "jamais
 * inventar nada, sempre com fontes seguras"): an exigência it proposes
 * stands only if its fundamento can be checked, because it came from the
 * office's library, or cites a norm that is in the legal base handed to
 * it, or points to the official site it read. Anything else is set aside,
 * and the summary says so, for the oficial to look at.
 */
export interface ProposedRequirement {
  biblioteca: string;
  titulo: string;
  fundamento: string;
  endereco?: string;
}

export function hasCheckedSource(
  e: ProposedRequirement,
  known: {
    libraryIds: readonly string[];
    /** The references of the legal base passages it was given. */
    references: readonly string[];
  },
): boolean {
  if (e.biblioteca && known.libraryIds.includes(e.biblioteca)) return true;
  if (e.endereco && isOfficialUrl(e.endereco)) return true;
  const cited = normsIn(e.fundamento);
  if (cited.length === 0) return false;
  const given = known.references.flatMap((r) => normsIn(r));
  return cited.some((c) => given.some((g) => sameNorm(c, g)));
}

/** The proposal split: what stands, and what was set aside and why. */
export function checkProposalSources<T extends ProposedRequirement>(
  items: readonly T[],
  known: { libraryIds: readonly string[]; references: readonly string[] },
): { kept: T[]; setAside: string[] } {
  const kept: T[] = [];
  const setAside: string[] = [];
  for (const item of items) {
    if (hasCheckedSource(item, known)) kept.push(item);
    else setAside.push(item.titulo.trim() || "exigência sem título");
  }
  return { kept, setAside };
}
