import type { ActEffect } from "./acts.ts";

/**
 * What the office teaches by writing and correcting its atos (decision of
 * 26/11/2026: "cada alteração que editar e alterar nos atos, que o sistema
 * vá aprendendo"). Only the words of the natureza are kept, without any
 * number, name or document (LGPD), tied to whether it was a registro or an
 * averbação and what it did in the matrícula.
 */

export interface LearnedAct {
  cue: string;
  kind: "R" | "AV";
  effect: ActEffect;
  uses: number;
}

const STOP = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "a",
  "o",
  "as",
  "os",
  "para",
  "por",
  "com",
  "no",
  "na",
]);

/** The words that say what the ato is: "compra e venda" → "compra venda". */
export function cueOf(nature: string): string {
  return nature
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .slice(0, 6)
    .join(" ");
}

/**
 * The best learned guess for a natureza: the same words first, then the
 * one sharing most words, the most used breaking ties. Null when nothing
 * fits.
 */
export function suggestAct(
  nature: string,
  learned: readonly LearnedAct[],
): LearnedAct | null {
  const cue = cueOf(nature);
  if (!cue) return null;
  const exact = learned.find((l) => l.cue === cue);
  if (exact) return exact;
  const list = cue.split(" ");
  const words = new Set(list);
  let best: { l: LearnedAct; score: number } | null = null;
  for (const l of learned) {
    const own = l.cue.split(" ");
    const shared = own.filter((w) => words.has(w)).length;
    if (shared === 0) continue;
    // "Cancelamento de hipoteca" is a cancelamento: the first word leads.
    const leads = own.includes(list[0] ?? "") ? 500 : 0;
    const score = shared * 1000 + leads + Math.min(l.uses, 499);
    if (!best || score > best.score) best = { l, score };
  }
  return best?.l ?? null;
}
