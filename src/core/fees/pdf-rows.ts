/**
 * A PDF has no rows: a table is pieces of text placed on the page, and the
 * reader hands them out in whatever order the file drew them, cell by cell
 * or column by column. This puts each row of a table back on one line, the
 * code, the description and the amounts in their left-to-right order, so
 * the item can be read the way a person reads it.
 */

/** One piece of text as pdf.js gives it (`getTextContent().items`). */
export interface PdfTextPiece {
  str: string;
  /** [a, b, c, d, x, y]: the text's matrix on the page. */
  transform: number[];
  width: number;
  height: number;
}

interface Placed {
  text: string;
  /** Across the reading direction: equal for pieces on the same row. */
  row: number;
  /** Along the reading direction: left to right on an upright page. */
  start: number;
  end: number;
  size: number;
}

/**
 * Where a piece sits, in the direction its text runs. Upright text runs
 * along x; a table drawn turned on its side (a landscape table on a portrait
 * page) runs along y, and its rows are then columns of the page.
 */
function place(piece: PdfTextPiece): Placed {
  const [a, b, , , x, y] = piece.transform;
  const size = Math.max(1, Math.hypot(a, b) || piece.height || 1);
  if (Math.abs(b) > Math.abs(a)) {
    // Turned a quarter: up the page (b > 0) or down it (b < 0).
    const up = b > 0;
    return {
      text: piece.str,
      row: up ? -x : x,
      start: up ? y : -y,
      end: (up ? y : -y) + piece.width,
      size,
    };
  }
  const upright = a >= 0;
  return {
    text: piece.str,
    row: upright ? y : -y,
    start: upright ? x : -x,
    end: (upright ? x : -x) + piece.width,
    size,
  };
}

/** The page's text, one table row per line, top to bottom. */
export function rowsOfPage(pieces: PdfTextPiece[]): string[] {
  const placed = pieces
    .filter((piece) => piece.str.trim() !== "")
    .map(place)
    .sort((p, q) => q.row - p.row || p.start - q.start);

  // Pieces whose baselines are within half a letter of each other share a
  // row: cells of one row are drawn on the same baseline, give or take.
  const rows: Placed[][] = [];
  for (const piece of placed) {
    const current = rows.at(-1);
    const anchor = current?.[0];
    if (
      current &&
      anchor &&
      Math.abs(anchor.row - piece.row) <= Math.min(anchor.size, piece.size) / 2
    ) {
      current.push(piece);
    } else {
      rows.push([piece]);
    }
  }

  return rows
    .map((row) => {
      const sorted = row.sort((p, q) => p.start - q.start);
      let line = "";
      let end: number | undefined;
      for (const piece of sorted) {
        // A gap wider than a fifth of a letter is a space or a new cell;
        // closer than that, the file just split a word.
        const gap = end === undefined ? 0 : piece.start - end;
        if (line && gap > piece.size * 0.2) line += " ";
        line += piece.text;
        end = Math.max(end ?? piece.end, piece.end);
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}
