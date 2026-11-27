import {
  addDays,
  holidayName,
  type OfficeHolidays,
  weekday,
} from "../scheduling/calendar.ts";

/**
 * The daily closing of the Protocolo (Lei nº 6.015/1973, art. 184: "O
 * Protocolo será encerrado diariamente"), as the serventia asked on
 * 26/11/2026:
 *
 * - a day still open takes prenotações with its own date, and its book
 *   comes out with them once it is closed;
 * - several days can be closed at once, each termo dated on its own day;
 * - a day without títulos says so; a holiday or a weekend says why.
 */

export type ClosingKind =
  | "movimento"
  | "sem-movimento"
  | "feriado"
  | "fim-de-semana"
  /**
   * A day of the Protocolo kept on paper and brought in by the import: it
   * was closed in the physical book, so it asks for no new termo
   * (decision of 27/11/2026).
   */
  | "livro-fisico";

export interface ClosingReason {
  kind: ClosingKind;
  /** "feriado de Natal", "sábado", for the text. */
  why: string;
}

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function weekdayName(day: string): string {
  return WEEKDAYS[weekday(day)] ?? "";
}

/** Why a day closes the way it does. */
export function closingReason(
  day: string,
  count: number,
  holidays: OfficeHolidays = {},
): ClosingReason {
  if (count > 0) return { kind: "movimento", why: "" };
  const holiday = holidayName(day, holidays);
  if (holiday) return { kind: "feriado", why: `feriado de ${holiday}` };
  const w = weekday(day);
  if (w === 0 || w === 6) {
    return { kind: "fim-de-semana", why: `fim de semana (${WEEKDAYS[w]})` };
  }
  return { kind: "sem-movimento", why: "" };
}

const br = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** The sentence that closes the day in the Livro 1. */
export function closingText(
  day: string,
  reason: ClosingReason,
  numbers: { count: number; first: number | null; last: number | null },
): string {
  if (reason.kind === "livro-fisico") {
    return `Dia ${br(day)} escriturado no livro físico do Protocolo; o encerramento consta do próprio livro (dados importados).`;
  }
  const when = `${br(day)} (${weekdayName(day)})`;
  if (reason.kind === "movimento" && numbers.first !== null) {
    const span =
      numbers.first === numbers.last
        ? `sob o nº ${numbers.first.toLocaleString("pt-BR")}`
        : `do nº ${numbers.first.toLocaleString("pt-BR")} ao nº ${(numbers.last ?? numbers.first).toLocaleString("pt-BR")}`;
    return `Encerra-se o Protocolo do dia ${when} com ${numbers.count} ${numbers.count === 1 ? "título apontado" : "títulos apontados"}, ${span}.`;
  }
  if (reason.kind === "feriado" || reason.kind === "fim-de-semana") {
    return `Encerra-se o Protocolo do dia ${when} sem movimento, em virtude do ${reason.why}.`;
  }
  return `Encerra-se o Protocolo do dia ${when} sem movimento: não houve apresentação de títulos.`;
}

/** The days from `from` to `to`, inclusive, that are not closed yet. */
export function pendingDays(
  from: string,
  to: string,
  closed: ReadonlySet<string>,
  limit = 400,
): string[] {
  const out: string[] = [];
  for (let day = from; day <= to && out.length < limit; day = addDays(day, 1)) {
    if (!closed.has(day)) out.push(day);
  }
  return out;
}

/**
 * Whether to remind the office: a day before today still open, or today
 * open from 14h on (decision of 26/11/2026).
 */
export function reminderDue(input: {
  today: string;
  hour: number;
  pending: readonly string[];
}): { due: boolean; late: string[]; today: boolean } {
  const late = input.pending.filter((d) => d < input.today);
  const todayOpen = input.pending.includes(input.today) && input.hour >= 14;
  return { due: late.length > 0 || todayOpen, late, today: todayOpen };
}
