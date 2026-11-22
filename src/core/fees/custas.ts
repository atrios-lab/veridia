/**
 * A tabela de custas e emolumentos as data (decision of 22/11/2026: "um
 * assistente virtual que refaça a tabela com nossos ajustes, por exemplo o
 * FRMP aumentou com base na lei tal"). Every amount is in cents, every sum is
 * an integer sum, and the two derived columns follow the rules the table
 * itself keeps in all its rows:
 *
 * - ISS = the rate on the emolumentos, rounded half up to the cent;
 * - Total = emolumentos + FDJ + FRMP + FCRCPN + ISS + FUNAF.
 *
 * Nothing here guesses a value: an adjustment changes only the rows and the
 * column it names, and says which rows it could not place.
 */

export const FEE_COLUMNS = [
  "emolumentos",
  "fdj",
  "frmp",
  "fcrcpn",
  "iss",
  "funaf",
  "total",
] as const;
export type FeeColumn = (typeof FEE_COLUMNS)[number];

/** The columns a law changes; ISS and Total are derived from them. */
export const ADJUSTABLE_COLUMNS = [
  "emolumentos",
  "fdj",
  "frmp",
  "fcrcpn",
  "funaf",
] as const;
export type AdjustableColumn = (typeof ADJUSTABLE_COLUMNS)[number];

export const COLUMN_LABELS: Record<FeeColumn, string> = {
  emolumentos: "Emolumentos",
  fdj: "FDJ",
  frmp: "FRMP",
  fcrcpn: "FCRCPN",
  iss: "ISS",
  funaf: "FUNAF",
  total: "Total",
};

export type FeeAmounts = Record<FeeColumn, number>;

export interface FeeRow {
  code: string;
  description: string;
  cents: FeeAmounts;
}

export type FeeBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "group"; text: string }
  | { kind: "row"; row: FeeRow }
  | { kind: "notes"; items: string[] };

export interface FeeTableMeta {
  /** "TABELA DE CUSTAS E EMOLUMENTOS 2026" */
  title: string;
  /** "SERVIÇOS EXTRAJUDICIAIS" */
  subtitle: string;
  /** "Anexo II da tabela do Tribunal de Justiça do Estado do Rio Grande do Norte" */
  source: string;
  /** "Vigência do FRMP: 19/03/2026 · Publicação: 19/03/2026 · Índice: 1,0521" */
  validity: string;
  /** Who prepared it, as the cover prints it (first line). */
  issuer: string;
  /** The footer's left text ("Fonte: ..."). */
  footer: string;
  /** "Rio Grande do Norte" */
  region: string;
  city: string;
  year: string;
  /** ISS rate in basis points: 500 is 5%. */
  issBasisPoints: number;
  /** The presentation paragraphs, as the table has them. */
  presentation: string[];
}

export interface FeeTableData {
  meta: FeeTableMeta;
  blocks: FeeBlock[];
}

export function rowsOf(data: FeeTableData): FeeRow[] {
  return data.blocks.flatMap((b) => (b.kind === "row" ? [b.row] : []));
}

/** Half up, on non-negative cents (the table has no negative amounts). */
function roundHalfUp(numerator: bigint, denominator: bigint): number {
  return Number(
    (numerator * BigInt(2) + denominator) / (BigInt(2) * denominator),
  );
}

/** The ISS of an amount of emolumentos at a rate in basis points. */
export function issOf(emolumentosCents: number, basisPoints: number): number {
  return roundHalfUp(
    BigInt(emolumentosCents) * BigInt(basisPoints),
    BigInt(10_000),
  );
}

export function totalOf(c: Omit<FeeAmounts, "total">): number {
  return c.emolumentos + c.fdj + c.frmp + c.fcrcpn + c.iss + c.funaf;
}

/** "1,0521" or "1.0521" or "5,21%" (as a raise) to millionths: 1052100. */
export function parseFactor(value: string): number | null {
  const text = value.trim().replace(/\s/g, "");
  const percent = text.endsWith("%");
  const number = Number(text.replace("%", "").replace(",", "."));
  if (!Number.isFinite(number) || number <= 0) return null;
  const factor = percent ? 1 + number / 100 : number;
  if (factor <= 0 || factor > 10) return null;
  return Math.round(factor * 1_000_000);
}

export function formatFactor(micro: number): string {
  return (micro / 1_000_000).toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

/** "R$ 1.234,56" */
export function brl(cents: number): string {
  const reais = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${reais},${String(cents % 100).padStart(2, "0")}`;
}

/** "R$ 1.234,56", "1.234,56", "1234,56" or "1234.56" to cents. */
export function parseCents(value: string): number | null {
  const text = value.replace(/R\$|\s/g, "");
  const br = /^(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,2})$/.exec(text);
  if (br?.[1] && br[2]) {
    return (
      Number(br[1].replace(/\./g, "")) * 100 + Number(br[2].padEnd(2, "0"))
    );
  }
  const dot = /^(\d+)\.(\d{1,2})$/.exec(text);
  if (dot?.[1] && dot[2]) {
    return Number(dot[1]) * 100 + Number(dot[2].padEnd(2, "0"));
  }
  return /^\d+$/.test(text) ? Number(text) * 100 : null;
}

// ------------------------------------------------------------- checking

export interface RowIssue {
  code: string;
  description: string;
  problem: string;
}

/**
 * The rows whose total is not the sum of its parts, or whose ISS is not the
 * rate on the emolumentos. A row the table itself prints with ISS zero (an
 * act exempt from it) is reported once, as a note, not as an error.
 */
export function checkTable(data: FeeTableData): {
  errors: RowIssue[];
  issExceptions: RowIssue[];
} {
  const errors: RowIssue[] = [];
  const issExceptions: RowIssue[] = [];
  for (const row of rowsOf(data)) {
    const c = row.cents;
    if (totalOf(c) !== c.total) {
      errors.push({
        code: row.code,
        description: row.description,
        problem: `total ${brl(c.total)} difere da soma ${brl(totalOf(c))}`,
      });
    }
    const expected = issOf(c.emolumentos, data.meta.issBasisPoints);
    if (c.iss !== expected) {
      issExceptions.push({
        code: row.code,
        description: row.description,
        problem: `ISS ${brl(c.iss)} (a alíquota daria ${brl(expected)})`,
      });
    }
  }
  return { errors, issExceptions };
}

// ----------------------------------------------------------- adjusting

export type Adjustment =
  | {
      column: AdjustableColumn;
      mode: "indice";
      /** Millionths: 1052100 is × 1,0521. */
      factorMicro: number;
    }
  | {
      column: AdjustableColumn;
      mode: "valores";
      /** In the order the source lists them; a code may repeat (one value
       * per range of the same code, in the table's order). */
      values: { code: string; cents: number }[];
    };

export interface RowChange {
  index: number;
  code: string;
  description: string;
  before: FeeAmounts;
  after: FeeAmounts;
}

export interface AdjustResult {
  data: FeeTableData;
  changes: RowChange[];
  /** Codes in the source that the table does not have. */
  notFound: string[];
  /** Codes whose number of values matches neither one nor the table's
   * number of rows with that code: left as they were, for a person to see. */
  ambiguous: string[];
}

/**
 * Applies the adjustments, in order, and derives ISS and Total again for
 * every row it touched. ISS is derived only for a row that followed the rate
 * before (an exempt row keeps its ISS). Returns a new table; the one passed
 * in is not changed.
 */
export function applyAdjustments(
  data: FeeTableData,
  adjustments: Adjustment[],
): AdjustResult {
  const blocks: FeeBlock[] = data.blocks.map((b) =>
    b.kind === "row"
      ? { kind: "row", row: { ...b.row, cents: { ...b.row.cents } } }
      : b,
  );
  const rate = data.meta.issBasisPoints;
  const rowIndexes = blocks.flatMap((b, i) => (b.kind === "row" ? [i] : []));
  const original = new Map(
    rowIndexes.map((i) => [
      i,
      { ...(data.blocks[i] as { row: FeeRow }).row.cents },
    ]),
  );
  const touched = new Set<number>();
  const notFound = new Set<string>();
  const ambiguous = new Set<string>();

  const byCode = new Map<string, number[]>();
  for (const i of rowIndexes) {
    const code = (blocks[i] as { row: FeeRow }).row.code;
    byCode.set(code, [...(byCode.get(code) ?? []), i]);
  }

  for (const adj of adjustments) {
    if (adj.mode === "indice") {
      for (const i of rowIndexes) {
        const row = (blocks[i] as { row: FeeRow }).row;
        const old = row.cents[adj.column];
        const next = roundHalfUp(
          BigInt(old) * BigInt(adj.factorMicro),
          BigInt(1_000_000),
        );
        if (next !== old) {
          row.cents[adj.column] = next;
          touched.add(i);
        }
      }
      continue;
    }
    const given = new Map<string, number[]>();
    for (const v of adj.values) {
      const code = v.code.replace(/\D/g, "");
      given.set(code, [...(given.get(code) ?? []), v.cents]);
    }
    for (const [code, values] of given) {
      const targets = byCode.get(code);
      if (!targets) {
        notFound.add(code);
        continue;
      }
      let plan: number[];
      if (values.length === targets.length) plan = values;
      else if (values.length === 1)
        plan = targets.map(() => values[0] as number);
      else {
        ambiguous.add(code);
        continue;
      }
      targets.forEach((i, k) => {
        const row = (blocks[i] as { row: FeeRow }).row;
        const value = plan[k] as number;
        if (row.cents[adj.column] !== value) {
          row.cents[adj.column] = value;
          touched.add(i);
        }
      });
    }
  }

  const changes: RowChange[] = [];
  for (const i of [...touched].sort((a, b) => a - b)) {
    const row = (blocks[i] as { row: FeeRow }).row;
    const before = original.get(i) as FeeAmounts;
    const followedRate = before.iss === issOf(before.emolumentos, rate);
    if (followedRate) row.cents.iss = issOf(row.cents.emolumentos, rate);
    row.cents.total = totalOf(row.cents);
    changes.push({
      index: i,
      code: row.code,
      description: row.description,
      before,
      after: { ...row.cents },
    });
  }
  return {
    data: { meta: data.meta, blocks },
    changes,
    notFound: [...notFound],
    ambiguous: [...ambiguous],
  };
}

/** What changed, column by column: rows changed and the sum of the
 * differences, for the summary the clerk reads before publishing. */
export function changeTotals(
  changes: RowChange[],
): Record<FeeColumn, { rows: number; deltaCents: number }> {
  const out = Object.fromEntries(
    FEE_COLUMNS.map((c) => [c, { rows: 0, deltaCents: 0 }]),
  ) as Record<FeeColumn, { rows: number; deltaCents: number }>;
  for (const ch of changes) {
    for (const c of FEE_COLUMNS) {
      const d = ch.after[c] - ch.before[c];
      if (d !== 0) {
        out[c].rows += 1;
        out[c].deltaCents += d;
      }
    }
  }
  return out;
}
