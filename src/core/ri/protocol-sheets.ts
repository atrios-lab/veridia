/**
 * The folhas of the Livro 1 (Protocolo) printed from the system, for the
 * book kept in folhas or in the hybrid form (Lei nº 6.015/1973, arts. 3º,
 * § 2º, 175 and 184; Provimento nº 156/2016-CGJ/RN, arts. 259, § 3º, 260,
 * parágrafo único, and 261).
 *
 * How the book is laid out (decision of 27/11/2026):
 * - the títulos go in the order of the número, one after the other, with a
 *   dividing line between them (art. 260, parágrafo único);
 * - the termo de encerramento of each day comes right after the last título
 *   of the day, on the same folha (art. 261); the next day goes on below it.
 *   The office may choose instead to begin every day on a new face;
 * - a título or a termo never splits between two faces: when it does not
 *   fit, it goes to the next face, and the space left is cancelled with a
 *   line ("inutilizado");
 * - each face holds a fixed number of lines, and each título reserves the
 *   same lines (room for the atos written later), so the folha of a título
 *   is known the moment it is protocolado and does not move afterwards.
 *
 * Everything here is pure: the same numbers go to the screen ("folha 75,
 * verso") and to the PDF printed for the physical book.
 */

export type Side = "frente" | "verso";

export interface PagingSettings {
  /** The first número the system lays out (the ones before are on paper). */
  fromItem: number | null;
  /** The folha and face it begins on. */
  fromSheet: number;
  fromSide: Side;
  /** Printed on both faces (frente e verso) or on the frente only. */
  bothSides: boolean;
  /** Lines each título reserves (at least); more when its text needs. */
  entryLines: number;
  /** "continuo": the next day goes on below the termo; "dia": new face. */
  dayBreak: "continuo" | "dia";
}

export const DEFAULT_PAGING: PagingSettings = {
  fromItem: null,
  fromSheet: 1,
  fromSide: "frente",
  bothSides: true,
  entryLines: 3,
  dayBreak: "continuo",
};

/**
 * The face of an A4 page in the model annexed to the Lei nº 6.015/1973
 * (Modelo do Livro nº 1 · Protocolo): "REGISTRO DE IMÓVEIS · PROTOCOLO",
 * "Livro nº 1", "ANO:", and the columns Nº de ordem, Data, NOME DO
 * APRESENTANTE, Natureza formal do título and ANOTAÇÕES (art. 175). The
 * models of the law are the rule for every book (decision of 27/11/2026).
 * The termo of each day takes about four lines.
 */
export const SHEET_LAYOUT = {
  /** Ruled lines on each face, below the heading. */
  linesPerSide: 42,
  /** The termo of each day (title, text, date and signature). */
  termLines: 4,
  /** Characters per line of each column (conservative, so text never spills). */
  columns: [
    { key: "number", label: "Nº de ordem", chars: 9, width: 54 },
    { key: "date", label: "Data", chars: 10, width: 62 },
    { key: "presenter", label: "NOME DO APRESENTANTE", chars: 27, width: 150 },
    {
      key: "titleKind",
      label: "Natureza formal do título",
      chars: 18,
      width: 104,
    },
    { key: "acts", label: "ANOTAÇÕES", chars: 29, width: 161 },
  ],
} as const;

export type ColumnKey = (typeof SHEET_LAYOUT.columns)[number]["key"];

/** Reads what was saved, with the defaults for what is missing. */
export function pagingOf(raw: unknown): PagingSettings {
  const v = (raw ?? {}) as Partial<Record<keyof PagingSettings, unknown>>;
  const int = (x: unknown, min: number, max: number, fallback: number) => {
    const n = Number(x);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    fromItem:
      v.fromItem === null || v.fromItem === undefined || v.fromItem === ""
        ? null
        : int(v.fromItem, 1, 99_999_999, 0) || null,
    fromSheet: int(v.fromSheet, 1, 100_000, 1),
    fromSide: v.fromSide === "verso" ? "verso" : "frente",
    bothSides: v.bothSides !== false,
    entryLines: int(v.entryLines, 1, 20, DEFAULT_PAGING.entryLines),
    dayBreak: v.dayBreak === "dia" ? "dia" : "continuo",
  };
}

/** Word wrap by characters; a word longer than the line is cut. */
export function wrap(text: string, chars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word;
      while (rest.length > chars) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(rest.slice(0, chars));
        rest = rest.slice(chars);
      }
      if (!line) line = rest;
      else if (line.length + 1 + rest.length <= chars) line = `${line} ${rest}`;
      else {
        lines.push(line);
        line = rest;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

export interface SheetEntry {
  number: number;
  presentedOn: string;
  presenter: string;
  titleKind: string;
  acts: string;
  voided: boolean;
}

export interface SheetClosing {
  day: string;
  /** The termo as printed (already says how many títulos and ocorrências). */
  text: string;
}

export interface Place {
  sheet: number;
  side: Side;
  /** First line on the face (0-based) and how many lines it takes. */
  line: number;
  lines: number;
  /** For a text longer than a face: the first of its lines drawn here. */
  offset: number;
}

export type SheetItem =
  | ({
      kind: "entry";
      entry: SheetEntry;
      cells: Record<ColumnKey, string[]>;
    } & Place)
  | ({ kind: "termo"; closing: SheetClosing; text: string[] } & Place)
  | ({ kind: "inutilizado" } & Place);

/** "75" or "75-v": how the book names a face. */
export function faceLabel(sheet: number, side: Side): string {
  return `${sheet.toLocaleString("pt-BR")}${side === "verso" ? "-v" : ""}`;
}

/** The cells of a título, wrapped to its columns. */
export function cellsOf(e: SheetEntry): Record<ColumnKey, string[]> {
  const text: Record<ColumnKey, string> = {
    number: e.number.toLocaleString("pt-BR"),
    date: e.presentedOn.split("-").reverse().join("/"),
    presenter: e.presenter,
    titleKind: e.titleKind,
    acts: e.voided ? "Lançado por engano (anulado)." : e.acts,
  };
  const out = {} as Record<ColumnKey, string[]>;
  for (const c of SHEET_LAYOUT.columns) out[c.key] = wrap(text[c.key], c.chars);
  return out;
}

/** The lines a título takes: its reserve, or more when its text needs. */
export function entryLinesOf(e: SheetEntry, paging: PagingSettings): number {
  const cells = cellsOf(e);
  const needed = Math.max(...Object.values(cells).map((l) => l.length));
  return Math.max(paging.entryLines, needed);
}

/** The termo is written across NOME DO APRESENTANTE and Natureza formal do título. */
export const TERM_CHARS = 44;

export interface Pagination {
  items: SheetItem[];
  /** Where the next título goes. */
  next: { sheet: number; side: Side; line: number };
  /** Faces used, in order. */
  faces: { sheet: number; side: Side }[];
}

/**
 * Lays out the títulos and the termos of each day on the faces of the
 * book. `entries` and `closings` are those from `fromItem` on; a day with
 * a termo and no título still gets its termo (art. 261, parágrafo único).
 */
export function paginate(
  entries: SheetEntry[],
  closings: SheetClosing[],
  paging: PagingSettings,
): Pagination {
  const per = SHEET_LAYOUT.linesPerSide;
  let sheet = paging.fromSheet;
  let side: Side = paging.bothSides ? paging.fromSide : "frente";
  let line = 0;
  const items: SheetItem[] = [];
  const faces: { sheet: number; side: Side }[] = [{ sheet, side }];
  const turn = () => {
    if (line > 0 && line < per) {
      items.push({
        kind: "inutilizado",
        sheet,
        side,
        line,
        lines: per - line,
        offset: 0,
      });
    }
    if (paging.bothSides && side === "frente") side = "verso";
    else {
      sheet += 1;
      side = "frente";
    }
    line = 0;
    faces.push({ sheet, side });
  };
  /** The places of an item: one, or several when it is longer than a face. */
  const place = (lines: number): Place[] => {
    if (line + lines > per && line > 0) turn();
    const out: Place[] = [];
    let offset = 0;
    while (lines - offset > per - line) {
      const here = per - line;
      out.push({ sheet, side, line, lines: here, offset });
      offset += here;
      line = per;
      turn();
    }
    out.push({ sheet, side, line, lines: lines - offset, offset });
    line += lines - offset;
    if (line >= per) turn();
    return out;
  };
  const byDay = new Map<string, SheetEntry[]>();
  for (const e of [...entries].sort((a, b) => a.number - b.number)) {
    const list = byDay.get(e.presentedOn) ?? [];
    list.push(e);
    byDay.set(e.presentedOn, list);
  }
  const closed = new Map(closings.map((c) => [c.day, c]));
  const days = [...new Set([...byDay.keys(), ...closed.keys()])].sort();
  for (const [i, day] of days.entries()) {
    if (i > 0 && paging.dayBreak === "dia" && line > 0) turn();
    for (const entry of byDay.get(day) ?? []) {
      const cells = cellsOf(entry);
      for (const at of place(entryLinesOf(entry, paging))) {
        items.push({ kind: "entry", entry, cells, ...at });
      }
    }
    const closing = closed.get(day);
    if (closing) {
      const text = wrap(closing.text, TERM_CHARS);
      for (const at of place(
        Math.max(SHEET_LAYOUT.termLines, text.length + 1),
      )) {
        items.push({ kind: "termo", closing, text, ...at });
      }
    }
  }
  return { items, next: { sheet, side, line }, faces };
}

/** How many títulos fit on a face and on a folha with the reserve. */
export function capacityOf(paging: PagingSettings): {
  perSide: number;
  perSheet: number;
  /** A day with its termo, on one face. */
  perSideWithTerm: number;
} {
  const per = SHEET_LAYOUT.linesPerSide;
  const perSide = Math.floor(per / paging.entryLines);
  return {
    perSide,
    perSheet: perSide * (paging.bothSides ? 2 : 1),
    perSideWithTerm: Math.max(
      0,
      Math.floor((per - SHEET_LAYOUT.termLines) / paging.entryLines),
    ),
  };
}

/** Where a número was laid out. */
export function placeOf(p: Pagination, number: number): Place | null {
  const item = p.items.find(
    (i) => i.kind === "entry" && i.entry.number === number,
  );
  return item
    ? {
        sheet: item.sheet,
        side: item.side,
        line: item.line,
        lines: item.lines,
        offset: item.offset,
      }
    : null;
}

/** The faces whose lines are all written: ready to print for the book. */
export function fullFaces(p: Pagination): { sheet: number; side: Side }[] {
  return p.faces.filter(
    (f) => !(f.sheet === p.next.sheet && f.side === p.next.side),
  );
}
