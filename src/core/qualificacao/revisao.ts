import { type NormRef, normsIn, sameNorm } from "../conhecimento/base.ts";
import { maskPersonalData } from "../dpo/mask.ts";

/**
 * The review of a nota devolutiva (or any document) a clerk attaches to an
 * exigência (decision of 16/11/2026): read it, check it against the law
 * and the legal base, warn of what diverges or is revoked, suggest keeping
 * or changing, and learn from it. The clerk decides, always.
 *
 * Two layers: what the office's own legal base already knows (a norm the
 * base holds as revoked, found at once, with no AI) and what the AI finds
 * reading the document against the base and the official sites.
 */

export type FindingKind =
  | "revogada"
  | "divergente"
  | "sem-fundamento"
  | "atencao";

export const FINDING_LABELS: Record<FindingKind, string> = {
  revogada: "Norma revogada",
  divergente: "Diverge da lei",
  "sem-fundamento": "Sem fundamento",
  atencao: "Ponto de atenção",
};

export interface ReviewFinding {
  kind: FindingKind;
  /** The passage of the document it is about. */
  excerpt: string;
  /** What is wrong, in plain words. */
  problem: string;
  /** The norm or consolidated understanding behind the warning. */
  basis: string;
  /** What to do: change it to what, or why it may stay. */
  suggestion: string;
  /** The official page read, when one was. */
  url?: string;
  /** "base": the office's legal base; "ia": the AI's reading. */
  source: "base" | "ia";
}

/** An exigência learned from the document: generic, with no personal data. */
export interface LearnedRequirement {
  title: string;
  description: string;
  howToComply: string;
  basis: string;
}

export interface ReviewResult {
  recommendation: "manter" | "alterar";
  summary: string;
  findings: ReviewFinding[];
  /** What is learned from it (decision of 16/11/2026: "sempre aprenda"). */
  learned: LearnedRequirement[];
  /** How the office writes its notes: structure and wording, generic. */
  style: string[];
}

/** A source the base holds as revoked, by the norm it is. */
export interface RevokedNorm {
  norm: NormRef;
  /** "Provimento CGJ/RN nº 1/2000". */
  label: string;
  /** What revoked it, when the base says. */
  by?: string;
}

/** "Revogada por X (identificado…)" in a source's notes, as "X". */
export function revokerIn(notes: string): string | undefined {
  return /Revogad[ao] por ([^(\n]+?)\s*(?:\(|$)/m.exec(notes)?.[1]?.trim();
}

/**
 * The norms the document cites that the office's legal base holds as
 * revoked: found at once, before any AI, and certain as far as the base is.
 */
export function revokedCitations(
  text: string,
  revoked: readonly RevokedNorm[],
): ReviewFinding[] {
  const out: ReviewFinding[] = [];
  for (const cited of normsIn(text)) {
    const hit = revoked.find((r) => sameNorm(r.norm, cited));
    if (!hit || out.some((f) => f.basis.startsWith(hit.label))) continue;
    out.push({
      kind: "revogada",
      excerpt: excerptAround(text, cited.number),
      problem: `A nota cita ${hit.label}, que a base jurídica da serventia tem como revogada${hit.by ? ` por ${hit.by}` : ""}.`,
      basis: `${hit.label}${hit.by ? `, revogada por ${hit.by}` : ", revogada"} (base jurídica da serventia).`,
      suggestion: hit.by
        ? `Troque a citação pela norma em vigor (${hit.by}) e confira se a exigência continua valendo.`
        : "Troque a citação pela norma em vigor e confira se a exigência continua valendo.",
      source: "base",
    });
  }
  return out;
}

/** The line of the text where the number appears, short. */
function excerptAround(text: string, number: string): string {
  const line =
    text.split(/\n+/).find((l) => l.includes(number)) ?? text.slice(0, 200);
  const flat = line.replace(/\s+/g, " ").trim();
  return flat.length > 240 ? `${flat.slice(0, 239)}…` : flat;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The base's findings first (certain), then the AI's, without saying the
 * same thing twice. A revoked norm the base found makes the suggestion
 * "alterar" whatever the AI said.
 */
export function mergeReview(
  base: readonly ReviewFinding[],
  ai: ReviewResult | null,
): ReviewResult {
  const findings = [...base];
  for (const finding of ai?.findings ?? []) {
    const same = findings.some(
      (f) =>
        f.kind === finding.kind &&
        (fold(f.basis) === fold(finding.basis) ||
          (f.excerpt && fold(f.excerpt) === fold(finding.excerpt))),
    );
    if (!same) findings.push(finding);
  }
  const serious = findings.some(
    (f) => f.kind === "revogada" || f.kind === "divergente",
  );
  return {
    recommendation:
      serious || ai?.recommendation === "alterar" ? "alterar" : "manter",
    summary:
      ai?.summary ||
      (findings.length
        ? "A base jurídica da serventia aponta norma revogada nesta nota."
        : "Nenhuma divergência encontrada na base jurídica da serventia."),
    findings,
    learned: ai?.learned ?? [],
    style: ai?.style ?? [],
  };
}

/** One line for the screen: how the review came out. */
export function reviewHeadline(result: ReviewResult): string {
  const count = result.findings.length;
  if (count === 0) return "Nenhuma divergência encontrada";
  return count === 1 ? "1 ponto de atenção" : `${count} pontos de atenção`;
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

/** A marker the masking left ("[CPF]", "[MATRÍCULA]"): personal data was there. */
const MASKED = /\[[A-ZÀ-Ú][A-ZÀ-Ú0-9 -]+\]/;

/** Personal data out (CPF, e-mail, telefone, endereço, números…). */
const unpersonal = (text: string) => maskPersonalData(text).text;

/**
 * What may be learned (LGPD): generic exigências only, each with its
 * fundamento, personal data masked, nothing too short to mean anything.
 */
export function cleanLearned(
  items: readonly LearnedRequirement[],
): LearnedRequirement[] {
  const out: LearnedRequirement[] = [];
  for (const item of items.slice(0, 30)) {
    const clean = {
      title: clip(unpersonal(item.title), 300),
      description: clip(unpersonal(item.description), 5000),
      howToComply: clip(unpersonal(item.howToComply), 5000),
      basis: clip(unpersonal(item.basis), 1000),
    };
    if (
      clean.title.length < 5 ||
      clean.description.length < 10 ||
      clean.howToComply.length < 10 ||
      clean.basis.length < 5
    )
      continue;
    // A mask left in a model means the text was about one person: it is
    // not a model, it is that person's case.
    if (MASKED.test(Object.values(clean).join(" "))) continue;
    out.push(clean);
  }
  return out;
}

/** The learned exigências not yet in the library (by title). */
export function newLearned(
  existingTitles: readonly string[],
  items: readonly LearnedRequirement[],
): LearnedRequirement[] {
  const seen = new Set(existingTitles.map(fold));
  const out: LearnedRequirement[] = [];
  for (const item of items) {
    const key = fold(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** How the office writes (structure, wording): short, generic, no data. */
export function cleanStyle(lines: readonly string[]): string[] {
  return lines
    .map((line) => clip(unpersonal(line), 300))
    .filter((line) => line.length >= 10 && !MASKED.test(line))
    .slice(0, 8);
}
