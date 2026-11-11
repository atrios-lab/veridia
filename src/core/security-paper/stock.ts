/**
 * Papel de segurança (decision of 11/11/2026): the office's classificador
 * of the security paper it buys and uses, as the Código de Normas of the
 * CGJ/RN asks (Provimento nº 156/2016, arts. 59 and 60):
 *
 * - art. 60, caput: a classificador of every paper on the requisition and
 *   the receipt of the paper, with the sheets received, used and in stock;
 * - art. 60, § 1º: every quarter, accounts to the Corregedoria: the stock
 *   at the start, the sheets used, lost, damaged or spoiled, and what is
 *   left;
 * - art. 59: a lost, stolen or damaged sheet is told to the Corregedoria
 *   at the end of the month, with its number, for the DJe.
 *
 * Every sheet is numbered: a lot is a range ("AB 000001 a 000500") and
 * each movement takes a range out of it. Nothing here reads a clock or the
 * database: the dates come in as "YYYY-MM-DD" and the rows as plain data.
 */

/** The kinds of paper an office buys; "outro" carries its own name. */
export const PAPER_KINDS = [
  "certidao-rcpn",
  "traslado",
  "certidao",
  "apostila",
  "etiqueta",
  "dut",
  "outro",
] as const;
export type PaperKind = (typeof PAPER_KINDS)[number];

export const PAPER_KIND_LABELS: Record<PaperKind, string> = {
  "certidao-rcpn": "Certidão do Registro Civil",
  traslado: "Traslado (Notas)",
  certidao: "Certidão (outras especialidades)",
  apostila: "Apostila",
  etiqueta: "Etiqueta de segurança (firma e autenticação)",
  dut: "DUT/ATPV (veículos)",
  outro: "Outro",
};

/** What happens to a sheet after it arrives. */
export const MOVEMENT_TYPES = [
  "utilizado",
  "inutilizado",
  "avariado",
  "extraviado",
  "subtraido",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  utilizado: "Utilizada em ato",
  inutilizado: "Inutilizada (erro de impressão ou de lavratura)",
  avariado: "Avariada (danificada)",
  extraviado: "Extraviada (perdida)",
  subtraido: "Subtraída (furto ou roubo)",
};

/** The plural, for the tables. */
export const MOVEMENT_COLUMNS: Record<MovementType, string> = {
  utilizado: "Utilizadas",
  inutilizado: "Inutilizadas",
  avariado: "Avariadas",
  extraviado: "Extraviadas",
  subtraido: "Subtraídas",
};

/** What the end-of-month ofício tells the Corregedoria (art. 59). */
export const COMMUNICABLE: readonly MovementType[] = [
  "extraviado",
  "subtraido",
  "avariado",
];

export interface PaperLot {
  id: string;
  kind: PaperKind;
  /** The name of an "outro" kind ("Folha de procuração"). */
  kindLabel: string;
  /** Letters before the number, as printed ("AB"); may be empty. */
  prefix: string;
  first: number;
  last: number;
  /** How many digits the number is printed with (zeros on the left). */
  digits: number;
  /** "YYYY-MM-DD": the day it arrived, or the day it was counted. */
  receivedOn: string;
  /**
   * Stock the office already had when it began the control here: it
   * counts in the stock at the start, never as received in the period.
   */
  opening: boolean;
  /** Optional: who printed it, and the nota fiscal (old lots have none). */
  supplier: string;
  invoice: string;
  /** The Corregedoria's requisition, when there was one. */
  requisition: string;
  notes: string;
  voided: boolean;
}

export interface PaperMovement {
  id: string;
  lotId: string;
  type: MovementType;
  first: number;
  last: number;
  /** "YYYY-MM-DD" */
  occurredOn: string;
  /** The act, the book and page, the police report. */
  reference: string;
  notes: string;
  voided: boolean;
}

/** "Traslado (Notas)", or the name given to an "outro". */
export function kindName(lot: Pick<PaperLot, "kind" | "kindLabel">): string {
  return lot.kind === "outro"
    ? lot.kindLabel.trim() || PAPER_KIND_LABELS.outro
    : PAPER_KIND_LABELS[lot.kind];
}

/** One sheet's number as printed: "AB 000123". */
export function sheetNumber(
  lot: Pick<PaperLot, "prefix" | "digits">,
  n: number,
): string {
  const digits = String(n).padStart(lot.digits, "0");
  return lot.prefix ? `${lot.prefix} ${digits}` : digits;
}

/** "AB 000101 a AB 000150", or the one sheet. */
export function rangeLabel(
  lot: Pick<PaperLot, "prefix" | "digits">,
  first: number,
  last: number,
): string {
  return first === last
    ? sheetNumber(lot, first)
    : `${sheetNumber(lot, first)} a ${sheetNumber(lot, last)}`;
}

export const sheetsIn = (r: { first: number; last: number }) =>
  r.last - r.first + 1;

/**
 * Reads a sheet number as typed ("AB 000123", "000123", "123"): the
 * prefix (letters, upper case), the number and how many digits it has.
 */
export function parseSheet(
  text: string,
): { prefix: string; n: number; digits: number } | null {
  const match = text
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{0,4})[\s.\-/]*(\d{1,12})$/);
  if (!match) return null;
  const n = Number(match[2]);
  if (!Number.isSafeInteger(n)) return null;
  return { prefix: match[1] ?? "", n, digits: (match[2] ?? "").length };
}

const live = <T extends { voided: boolean }>(rows: readonly T[]) =>
  rows.filter((row) => !row.voided);

function movementsOf(
  lot: PaperLot,
  movements: readonly PaperMovement[],
  until?: string,
): PaperMovement[] {
  return live(movements).filter(
    (m) => m.lotId === lot.id && (!until || m.occurredOn <= until),
  );
}

/** The sheets of the lot still in the drawer, as ranges, in order. */
export function freeRanges(
  lot: PaperLot,
  movements: readonly PaperMovement[],
  until?: string,
): { first: number; last: number }[] {
  const taken = movementsOf(lot, movements, until).sort(
    (a, b) => a.first - b.first,
  );
  const free: { first: number; last: number }[] = [];
  let next = lot.first;
  for (const m of taken) {
    if (m.first > next) free.push({ first: next, last: m.first - 1 });
    next = Math.max(next, m.last + 1);
  }
  if (next <= lot.last) free.push({ first: next, last: lot.last });
  return free;
}

/** How many sheets of the lot are left. */
export function remainingIn(
  lot: PaperLot,
  movements: readonly PaperMovement[],
  until?: string,
): number {
  return freeRanges(lot, movements, until).reduce(
    (sum, r) => sum + sheetsIn(r),
    0,
  );
}

/** The next sheet to use: the lowest one still free. */
export function nextSheet(
  lot: PaperLot,
  movements: readonly PaperMovement[],
): number | null {
  return freeRanges(lot, movements)[0]?.first ?? null;
}

/** Why a range cannot leave the lot, in the office's words; null if it can. */
export function checkRange(
  lot: PaperLot,
  movements: readonly PaperMovement[],
  range: { first: number; last: number },
): string | null {
  if (lot.voided) return "Este lote foi anulado.";
  if (range.last < range.first) {
    return "A última folha não pode vir antes da primeira.";
  }
  if (range.first < lot.first || range.last > lot.last) {
    return `O lote vai de ${rangeLabel(lot, lot.first, lot.last)}: confira a numeração.`;
  }
  const clash = movementsOf(lot, movements).find(
    (m) => m.first <= range.last && range.first <= m.last,
  );
  if (clash) {
    return `As folhas ${rangeLabel(lot, Math.max(clash.first, range.first), Math.min(clash.last, range.last))} já foram lançadas (${MOVEMENT_LABELS[clash.type].toLowerCase()}, em ${brDate(clash.occurredOn)}).`;
  }
  return null;
}

/**
 * The range for "usei N folhas": the next N free sheets in a row. When a
 * gap (a lost sheet already given) breaks the run, the office types the
 * numbers instead.
 */
export function rangeForQuantity(
  lot: PaperLot,
  movements: readonly PaperMovement[],
  quantity: number,
): { first: number; last: number } | string {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return "Informe quantas folhas.";
  }
  const run = freeRanges(lot, movements)[0];
  if (!run) return "Este lote não tem mais folhas.";
  if (sheetsIn(run) < quantity) {
    return `Seguidas, só restam ${sheetsIn(run)} folha(s) a partir de ${sheetNumber(lot, run.first)}: informe a numeração da primeira e da última.`;
  }
  return { first: run.first, last: run.first + quantity - 1 };
}

/** Why a new lot cannot be registered; null if it can. */
export function checkLot(
  lot: Pick<PaperLot, "kind" | "kindLabel" | "prefix" | "first" | "last">,
  others: readonly PaperLot[],
): string | null {
  if (lot.kind === "outro" && !lot.kindLabel.trim()) {
    return "Diga que papel é este (por exemplo, folha de procuração).";
  }
  if (lot.last < lot.first) {
    return "A última folha não pode vir antes da primeira.";
  }
  if (sheetsIn(lot) > 1_000_000) return "Confira a numeração do lote.";
  const clash = live(others).find(
    (o) =>
      o.kind === lot.kind &&
      kindName(o) === kindName(lot) &&
      o.prefix === lot.prefix &&
      o.first <= lot.last &&
      lot.first <= o.last,
  );
  if (clash) {
    return `Essa numeração já está no lote ${rangeLabel(clash, clash.first, clash.last)}, cadastrado em ${brDate(clash.receivedOn)}.`;
  }
  return null;
}

/* --------------------------------------------------------------- periods */

/** "15/07/2026" */
export function brDate(iso: string): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export function writtenDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

/** "outubro de 2026" for any day of it. */
export function monthLabel(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
}

export interface Period {
  start: string;
  end: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthOf(iso: string): Period {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay(year, month))}`,
  };
}

/** The month before the one `iso` is in. */
export function previousMonth(iso: string): Period {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return month === 1
    ? monthOf(`${year - 1}-12-01`)
    : monthOf(`${year}-${pad(month - 1)}-01`);
}

export interface Quarter extends Period {
  year: number;
  /** 1 to 4 */
  quarter: number;
}

export function quarterOf(iso: string): Quarter {
  const year = Number(iso.slice(0, 4));
  const quarter = Math.ceil(Number(iso.slice(5, 7)) / 3);
  const lastMonth = quarter * 3;
  return {
    year,
    quarter,
    start: `${year}-${pad(lastMonth - 2)}-01`,
    end: `${year}-${pad(lastMonth)}-${pad(lastDay(year, lastMonth))}`,
  };
}

/** The last quarter already over on `today`. */
export function previousQuarter(today: string): Quarter {
  const current = quarterOf(today);
  return current.quarter === 1
    ? quarterOf(`${current.year - 1}-12-01`)
    : quarterOf(`${current.year}-${pad((current.quarter - 1) * 3)}-01`);
}

/** "3º trimestre de 2026 (01/07/2026 a 30/09/2026)" */
export function quarterLabel(q: Quarter, withDates = true): string {
  const name = `${q.quarter}º trimestre de ${q.year}`;
  return withDates ? `${name} (${brDate(q.start)} a ${brDate(q.end)})` : name;
}

/** The quarter a period is exactly, if it is one. */
export function asQuarter(period: Period): Quarter | null {
  const q = quarterOf(period.start);
  return q.start === period.start && q.end === period.end ? q : null;
}

/** "01/07/2026 a 30/09/2026", or the quarter's or the month's name. */
export function periodLabel(period: Period): string {
  const quarter = asQuarter(period);
  if (quarter) return quarterLabel(quarter);
  const month = monthOf(period.start);
  if (month.start === period.start && month.end === period.end) {
    return monthLabel(period.start);
  }
  return `${brDate(period.start)} a ${brDate(period.end)}`;
}

/* --------------------------------------------------------------- summary */

/** The day before `iso`. */
function dayBefore(iso: string): string {
  const d = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10)) - 1,
    ),
  );
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** One kind of paper in the quarter's accounts (art. 60, § 1º). */
export interface SummaryRow {
  kind: string;
  initial: number;
  received: number;
  moved: Record<MovementType, number>;
  final: number;
}

const zeroMoves = (): Record<MovementType, number> => ({
  utilizado: 0,
  inutilizado: 0,
  avariado: 0,
  extraviado: 0,
  subtraido: 0,
});

/** Lots as the period sees them: those already there or arrived in it. */
function lotsUpTo(lots: readonly PaperLot[], end: string) {
  return live(lots).filter((lot) => lot.receivedOn <= end);
}

/**
 * The demonstrativo of a period, kind by kind: the stock the day before it
 * began, what arrived, what left and why, and what is left at its end.
 * Stock the office already had when it began the control here (`opening`)
 * counts in the stock at the start whenever it was counted.
 */
export function summarize(
  lots: readonly PaperLot[],
  movements: readonly PaperMovement[],
  period: Period,
): SummaryRow[] {
  const before = dayBefore(period.start);
  const rows = new Map<string, SummaryRow>();
  const row = (kind: string) => {
    let current = rows.get(kind);
    if (!current) {
      current = { kind, initial: 0, received: 0, moved: zeroMoves(), final: 0 };
      rows.set(kind, current);
    }
    return current;
  };
  for (const lot of lotsUpTo(lots, period.end)) {
    const r = row(kindName(lot));
    const arrivedBefore = lot.opening || lot.receivedOn <= before;
    if (arrivedBefore) r.initial += remainingIn(lot, movements, before);
    else r.received += sheetsIn(lot);
    for (const m of movementsOf(lot, movements, period.end)) {
      if (m.occurredOn >= period.start) r.moved[m.type] += sheetsIn(m);
    }
    r.final += remainingIn(lot, movements, period.end);
  }
  return [...rows.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

/** The kinds' rows added up. */
export function totalOf(rows: readonly SummaryRow[]): SummaryRow {
  const total: SummaryRow = {
    kind: "Total",
    initial: 0,
    received: 0,
    moved: zeroMoves(),
    final: 0,
  };
  for (const r of rows) {
    total.initial += r.initial;
    total.received += r.received;
    total.final += r.final;
    for (const type of MOVEMENT_TYPES) total.moved[type] += r.moved[type];
  }
  return total;
}

/** What is in the drawer now, kind by kind, with the next sheet of each lot. */
export function stockByKind(
  lots: readonly PaperLot[],
  movements: readonly PaperMovement[],
): {
  kind: string;
  remaining: number;
  lots: { lot: PaperLot; remaining: number; next: number | null }[];
}[] {
  const byKind = new Map<
    string,
    { lot: PaperLot; remaining: number; next: number | null }[]
  >();
  for (const lot of live(lots)) {
    const list = byKind.get(kindName(lot)) ?? [];
    list.push({
      lot,
      remaining: remainingIn(lot, movements),
      next: nextSheet(lot, movements),
    });
    byKind.set(kindName(lot), list);
  }
  return [...byKind.entries()]
    .map(([kind, list]) => ({
      kind,
      remaining: list.reduce((sum, l) => sum + l.remaining, 0),
      lots: list.sort((a, b) =>
        a.lot.receivedOn.localeCompare(b.lot.receivedOn),
      ),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

/* ------------------------------------------------------------- reminders */

export interface ReportRef {
  kind: "extravio" | "prestacao" | "relatorio";
  periodStart: string;
  periodEnd: string;
  movementIds: readonly string[];
}

/**
 * What the Corregedoria is still owed on `today`: the accounts of the last
 * quarter over, once the office has paper registered by then; and every
 * loss, theft or damage of a month already over not yet in an ofício.
 */
export function pendingDuties(input: {
  today: string;
  lots: readonly PaperLot[];
  movements: readonly PaperMovement[];
  reports: readonly ReportRef[];
}): { quarter: Quarter | null; occurrences: PaperMovement[] } {
  const last = previousQuarter(input.today);
  const hasPaper = lotsUpTo(input.lots, last.end).length > 0;
  const accounted = input.reports.some(
    (r) =>
      r.kind === "prestacao" &&
      r.periodStart === last.start &&
      r.periodEnd === last.end,
  );
  const told = new Set(
    input.reports
      .filter((r) => r.kind === "extravio")
      .flatMap((r) => r.movementIds),
  );
  const monthStart = monthOf(input.today).start;
  const lotIds = new Set(live(input.lots).map((l) => l.id));
  const occurrences = live(input.movements).filter(
    (m) =>
      COMMUNICABLE.includes(m.type) &&
      lotIds.has(m.lotId) &&
      m.occurredOn < monthStart &&
      !told.has(m.id),
  );
  return { quarter: hasPaper && !accounted ? last : null, occurrences };
}

/** The losses, thefts and damages of a period not told yet (or all of them). */
export function occurrencesIn(
  lots: readonly PaperLot[],
  movements: readonly PaperMovement[],
  period: Period,
): PaperMovement[] {
  const lotIds = new Set(live(lots).map((l) => l.id));
  return live(movements)
    .filter(
      (m) =>
        COMMUNICABLE.includes(m.type) &&
        lotIds.has(m.lotId) &&
        m.occurredOn >= period.start &&
        m.occurredOn <= period.end,
    )
    .sort(
      (a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.first - b.first,
    );
}

/* ------------------------------------------------------------- low stock */

/**
 * The kinds whose stock is down to the warning line (decision of
 * 11/11/2026: 200 sheets), to order a new lot in time. A kind whose lots
 * are all used up is warned too: it is the most urgent.
 */
export function lowStock(
  lots: readonly PaperLot[],
  movements: readonly PaperMovement[],
  threshold: number,
): { kind: string; paperKind: PaperKind; remaining: number }[] {
  if (threshold <= 0) return [];
  const byKind = new Map<string, { paperKind: PaperKind; remaining: number }>();
  for (const lot of live(lots)) {
    const entry = byKind.get(kindName(lot)) ?? {
      paperKind: lot.kind,
      remaining: 0,
    };
    entry.remaining += remainingIn(lot, movements);
    byKind.set(kindName(lot), entry);
  }
  return [...byKind.entries()]
    .filter(([, v]) => v.remaining <= threshold)
    .map(([kind, v]) => ({ kind, ...v }))
    .sort((a, b) => a.remaining - b.remaining);
}

/** Why a lot cannot take the new numbering; null if it can. */
export function checkLotChange(
  lot: Pick<
    PaperLot,
    "id" | "kind" | "kindLabel" | "prefix" | "first" | "last" | "digits"
  >,
  others: readonly PaperLot[],
  movements: readonly PaperMovement[],
): string | null {
  const problem = checkLot(
    lot,
    others.filter((o) => o.id !== lot.id),
  );
  if (problem) return problem;
  const outside = live(movements).find(
    (m) => m.lotId === lot.id && (m.first < lot.first || m.last > lot.last),
  );
  return outside
    ? `Há lançamentos fora da nova numeração (${rangeLabel(lot, outside.first, outside.last)}). Corrija ou exclua esses lançamentos antes.`
    : null;
}
