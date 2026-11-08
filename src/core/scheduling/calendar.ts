/**
 * The office's calendar: which days it opens, written as plain "YYYY-MM-DD"
 * strings.
 *
 * Strings, not Date: a date here is a day on a wall calendar in Rio Grande do
 * Norte, not an instant. A Date carries a time zone the server picks, and the
 * server runs in UTC, which is how "today" becomes tomorrow at nine at night.
 * Nothing in this file reads the clock; the caller says what today is.
 */

import type { SupportedState } from "../transparency/rubrics.ts";
export type IsoDate = string;

const DAY_MS = 86_400_000;

/** The day, on the wall clock of the given time zone, of a real instant. */
export function toIsoDate(instant: Date, timeZone: string): IsoDate {
  // "en-CA" is the locale that formats as YYYY-MM-DD, which is the format we
  // want to store, so no reassembling of parts is needed.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(instant);
}

/** How far the wall clock of a zone runs from UTC at a given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const at = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    // Some locales render midnight as "24"; Date.UTC would roll it a day on.
    at("hour") % 24,
    at("minute"),
    at("second"),
  );
  return wall - instant.getTime();
}

/**
 * The instant a "YYYY-MM-DDTHH:mm" typed into a `datetime-local` means on the
 * office's wall clock. `new Date(local)` would read it in the server's zone,
 * and the server runs in UTC: three hours off, silently, every time.
 *
 * Two passes because the offset belongs to the instant, not to the text: the
 * first guess picks the offset, the second applies the offset that actually
 * holds there. Brazil has no DST today, so the second pass is a no-op, and it
 * is one line to stay correct the day that changes, or the day another office
 * sits in a zone that does.
 */
export function fromZonedDateTime(local: string, timeZone: string): Date {
  const guess = new Date(`${local}:00Z`);
  if (Number.isNaN(guess.getTime())) return guess;
  const first = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(first, timeZone));
}

/** The "YYYY-MM-DDTHH:mm" a `datetime-local` needs to show this instant. */
export function toZonedDateTimeInput(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${at("year")}-${at("month")}-${at("day")}T${at("hour")}:${at("minute")}`;
}

function toUtc(date: IsoDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** 0 is Sunday, as in Date.getUTCDay. */
export function weekday(date: IsoDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function isWeekend(date: IsoDate): boolean {
  const day = weekday(date);
  return day === 0 || day === 6;
}

/**
 * Easter Sunday by the Meeus/Butcher algorithm. Three national holidays hang
 * off it (carnival, Good Friday, Corpus Christi), and a hand written table
 * would need a new line every year, which is the kind of maintenance nobody
 * remembers until a citizen is offered an appointment on Good Friday.
 */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fromUtc(Date.UTC(year, month - 1, day));
}

// Fixed national holidays by federal law: month-day and the name the
// office's status line shows on the day.
const FIXED_HOLIDAYS: [suffix: string, name: string][] = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Consciência Negra"], // Lei 14.759/2023
  ["12-25", "Natal"],
];

/** Every national holiday of the year, fixed and Easter derived. */
export function nationalHolidays(year: number): Map<IsoDate, string> {
  const easter = easterSunday(year);
  return new Map([
    ...FIXED_HOLIDAYS.map(
      ([suffix, name]) => [`${year}-${suffix}`, name] as const,
    ),
    // Carnival Tuesday is not a statutory holiday, but no notary office in the
    // country opens on it.
    [addDays(easter, -47), "Carnaval"],
    [addDays(easter, -2), "Sexta-feira da Paixão"],
    [addDays(easter, 60), "Corpus Christi"],
  ]);
}

/**
 * The days the extrajudicial services of a state do not open, beyond the
 * weekend and the national holidays: what that state's Código de Normas
 * says, plus the holidays its own laws declare.
 *
 * Keyed by every supported state, so a second state in SUPPORTED_STATES does
 * not compile until someone writes its list here.
 *
 * RN: Código de Normas da CGJ/RN (Provimento 156/2016), §6º of the article
 * on opening hours: the services do not open, save the civil registry's
 * on-call duty, on the national holidays and on Carnival Monday, Ash
 * Wednesday, São João (24/06), São Pedro (29/06), Christmas Eve (24/12) and
 * New Year's Eve (31/12); and, by its item III, on the holidays of state
 * law, which today is the Mártires de Cunhaú e Uruaçu (03/10, Lei estadual
 * 8.913/2006). Municipal holidays (also item III) are per town and not
 * known here.
 */
const STATE_CLOSED_DAYS: Record<
  SupportedState,
  {
    fixed: [suffix: string, name: string][];
    fromEaster: [offset: number, name: string][];
  }
> = {
  RN: {
    fixed: [
      ["06-24", "São João"],
      ["06-29", "São Pedro"],
      ["10-03", "Mártires de Cunhaú e Uruaçu"],
      ["12-24", "Véspera de Natal"],
      ["12-31", "Véspera de Ano Novo"],
    ],
    fromEaster: [
      [-48, "Carnaval"],
      [-46, "Quarta-feira de Cinzas"],
    ],
  },
};

/**
 * The state whose calendar the platform counts by. Only one is supported
 * today (SUPPORTED_STATES); a test fails the day a second one arrives, which
 * is when `isBusinessDay` has to start taking the office's state.
 */
export const CALENDAR_STATE: SupportedState = "RN";

/** Every day of the year the office does not open, weekends aside, by name. */
export function closedDays(
  year: number,
  state: SupportedState = CALENDAR_STATE,
): Map<IsoDate, string> {
  const rules = STATE_CLOSED_DAYS[state];
  const easter = easterSunday(year);
  return new Map([
    ...nationalHolidays(year),
    ...rules.fixed.map(
      ([suffix, name]) => [`${year}-${suffix}`, name] as const,
    ),
    ...rules.fromEaster.map(
      ([offset, name]) => [addDays(easter, offset), name] as const,
    ),
  ]);
}

/** The holiday's name when the office is closed for one that day. */
export function holidayName(date: IsoDate): string | undefined {
  return closedDays(Number(date.slice(0, 4))).get(date);
}

export function isHoliday(date: IsoDate): boolean {
  return holidayName(date) !== undefined;
}

/**
 * A day the office opens: a weekday that is neither a national holiday nor a
 * day the state's Código de Normas closes the extrajudicial services.
 */
export function isBusinessDay(date: IsoDate): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/**
 * The next `count` days the office opens, starting at `from` (included when it
 * is itself a business day). The search stops after a month of calendar days,
 * which no run of holidays in Brazil comes close to.
 */
export function nextBusinessDays(from: IsoDate, count: number): IsoDate[] {
  const days: IsoDate[] = [];
  let cursor = from;
  for (let step = 0; step < 31 && days.length < count; step++) {
    if (isBusinessDay(cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAY_LONG = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];
const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/**
 * Labels are written out here rather than taken from Intl: the server's locale
 * is not the citizen's, and "Wed" on a chip would be a bug nobody sees in
 * development.
 */
export function shortWeekday(date: IsoDate): string {
  return WEEKDAY_SHORT[weekday(date)];
}

export function longWeekday(date: IsoDate): string {
  return WEEKDAY_LONG[weekday(date)];
}

export function shortMonth(date: IsoDate): string {
  return MONTH_SHORT[Number(date.slice(5, 7)) - 1];
}

export function dayOfMonth(date: IsoDate): string {
  return date.slice(8, 10);
}

/** "06/08/2026", the way a date is written and read in Brazil. */
export function formatDate(date: IsoDate): string {
  return `${dayOfMonth(date)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** "quarta, 06/08/2026" */
export function formatLongDate(date: IsoDate): string {
  return `${longWeekday(date)}, ${formatDate(date)}`;
}

/** "quarta, 06/08" */
export function formatShortDate(date: IsoDate): string {
  return `${longWeekday(date)}, ${dayOfMonth(date)}/${date.slice(5, 7)}`;
}

const MONTH_LONG = [
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
];

/**
 * "Quarta, 5 de agosto de 2026": the date written out, the way the panel's
 * header carries it. Capitalised and without the "-feira" the weekday would
 * take in full prose: it is a stamp on a header, not a sentence.
 */
export function formatFullDate(date: IsoDate): string {
  const weekdayLabel = longWeekday(date);
  const month = MONTH_LONG[Number(date.slice(5, 7)) - 1];
  return `${weekdayLabel[0].toUpperCase()}${weekdayLabel.slice(1)}, ${Number(
    date.slice(8, 10),
  )} de ${month} de ${date.slice(0, 4)}`;
}
