/**
 * The office's name ends with its place: "Ofício Único de Cruzeta / RN".
 * Left to the browser, a narrow line breaks before the state and leaves
 * "/ RN" alone on the last line (reported on 23/11/2026). The last word of
 * the town and the state go together, so the line breaks earlier and the
 * place reads whole, on any screen. Only the last word joins the state: a
 * town with many words ("São José de Mipibu") would not fit a phone line.
 */

// The town's last word, a separator (slash, hyphen or dash) and the state.
const PLACE_TAIL = /(\S+?)\s*[/\u002d\u2013\u2014]\s*[A-Za-z]{2}\.?\s*$/u;

export interface PlaceSplit {
  /** Everything before the tail, with its trailing space kept. */
  head: string;
  /** "Cruzeta / RN", as written; "" when the text has no state at the end. */
  tail: string;
}

export function splitPlaceTail(text: string): PlaceSplit {
  const match = PLACE_TAIL.exec(text);
  if (!match) {
    return { head: text, tail: "" };
  }
  return {
    head: text.slice(0, match.index),
    tail: text.slice(match.index).trimEnd(),
  };
}
