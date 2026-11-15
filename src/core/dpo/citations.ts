/**
 * The model cites a provision as `[[fonte:<id>]]` (design, decision 4). The
 * platform, not the model, decides which citations stand: only an id that
 * was delivered to the model in that very call is kept; anything else is
 * taken out of the text and recorded for review. A model that invents an
 * article cannot make the screen show it as a source.
 */
const MARKER = /\[\[fonte:([a-z0-9-]+)\]\]/g;

export interface ResolvedCitations {
  /** The answer with every citation that did not stand removed. */
  text: string;
  /** Valid ids, in the order they first appear. */
  cited: string[];
  /** Ids the model wrote that were not delivered to it. */
  invalid: string[];
}

export function resolveCitations(
  text: string,
  delivered: ReadonlySet<string>,
): ResolvedCitations {
  const cited: string[] = [];
  const invalid: string[] = [];
  const cleaned = text.replace(MARKER, (marker, id: string) => {
    if (delivered.has(id)) {
      if (!cited.includes(id)) cited.push(id);
      return marker;
    }
    if (!invalid.includes(id)) invalid.push(id);
    return "";
  });
  return {
    // A removed marker can leave a space before punctuation behind.
    text: cleaned.replace(/[ \t]+([.,;:)])/g, "$1").replace(/[ \t]{2,}/g, " "),
    cited,
    invalid,
  };
}

export type AnswerSegment =
  | { kind: "text"; text: string }
  | { kind: "source"; id: string };

/** Splits an answer into text and source chips, for the screen. */
export function segmentAnswer(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKER)) {
    const start = match.index ?? 0;
    if (start > last) {
      segments.push({ kind: "text", text: text.slice(last, start) });
    }
    segments.push({ kind: "source", id: match[1] });
    last = start + match[0].length;
  }
  if (last < text.length)
    segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}
