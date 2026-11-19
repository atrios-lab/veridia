/**
 * Bold inside a paragraph of a generated document (decision of 19/11/2026):
 * the builders mark it `**like this**`, and each renderer (the PDF, the
 * Word file) draws the marked pieces in bold. A paragraph with no marks is
 * one plain piece, so every other document is drawn as before.
 */
export interface RichPiece {
  text: string;
  bold: boolean;
}

export function splitBold(text: string): RichPiece[] {
  const parts = text.split("**");
  // An even number of parts means a mark was left open: the paragraph stays
  // as typed, never with the rest of it swallowed into bold.
  if (parts.length % 2 === 0) return [{ text, bold: false }];
  const pieces: RichPiece[] = [];
  parts.forEach((part, index) => {
    if (!part) return;
    const bold = index % 2 === 1;
    const last = pieces.at(-1);
    if (last && last.bold === bold) last.text += part;
    else pieces.push({ text: part, bold });
  });
  return pieces;
}

/** The same text without the marks, where bold cannot be drawn. */
export function stripBold(text: string): string {
  return splitBold(text)
    .map((piece) => piece.text)
    .join("");
}
