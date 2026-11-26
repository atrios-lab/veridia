import { cueOf, type LearnedAct, suggestAct } from "./act-learning.ts";
import { ACT_NATURES, type ActEffect } from "./acts.ts";

/**
 * From the atos asked in a prenotação to the lançamentos to make (decision
 * of 26/11/2026: "o assistente analisa e vê se é AV ou R... e a ordem"):
 * each one read against what the office taught first, then the catalog.
 * Only a proposal: the clerk confirms each ato in the matrícula.
 */

export interface PlannedAct {
  nature: string;
  kind: "R" | "AV" | null;
  effect: ActEffect | null;
  /** Why: learned from the office, the catalog, or not recognised. */
  basis: "aprendido" | "catalogo" | "desconhecido";
  /** Where the law puts it. */
  source: string;
}

// Cancel the old burdens first, update the description, then the transfer,
// and the new burdens last (the order the matrícula must read).
const ORDER: Record<ActEffect, number> = {
  cancelamento: 0,
  descricao: 1,
  outro: 1,
  titularidade: 2,
  transmissao: 2,
  onus: 3,
  encerramento: 4,
};

const CATALOG: LearnedAct[] = ACT_NATURES.filter((n) => n.kind !== "M").map(
  (n) => ({
    cue: cueOf(n.name),
    kind: n.kind === "AV" ? "AV" : "R",
    effect: n.effect,
    uses: 0,
  }),
);

const NAMES = new Map(ACT_NATURES.map((n) => [cueOf(n.name), n.name]));

export function planActs(
  summary: string,
  learned: readonly LearnedAct[] = [],
): PlannedAct[] {
  const asked = summary
    .split(/[;\n]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1);
  const out = asked.map((nature): PlannedAct => {
    const fromOffice = suggestAct(nature, learned);
    const guess =
      fromOffice && fromOffice.cue === cueOf(nature)
        ? fromOffice
        : (suggestAct(nature, CATALOG) ?? fromOffice);
    if (!guess) {
      return {
        nature,
        kind: null,
        effect: null,
        basis: "desconhecido",
        source:
          "Não reconhecido: confira no art. 167 da Lei nº 6.015/1973 se é registro (inciso I) ou averbação (inciso II).",
      };
    }
    return {
      nature: NAMES.get(guess.cue) ?? nature,
      kind: guess.kind,
      effect: guess.effect,
      basis: learned.includes(guess) ? "aprendido" : "catalogo",
      source:
        guess.kind === "R"
          ? "Registro: Lei nº 6.015/1973, art. 167, I."
          : "Averbação: Lei nº 6.015/1973, art. 167, II.",
    };
  });
  return out
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        (a.p.effect ? ORDER[a.p.effect] : 9) -
          (b.p.effect ? ORDER[b.p.effect] : 9) || a.i - b.i,
    )
    .map(({ p }) => p);
}
