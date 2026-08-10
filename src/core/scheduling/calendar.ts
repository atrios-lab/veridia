/**
 * The office's calendar: which days it opens, written as plain "YYYY-MM-DD"
 * strings.
 *
 * Strings, not Date: a date here is a day on a wall calendar in Rio Grande do
 * Norte, not an instant. A Date carries a time zone the server picks, and the
 * server runs in UTC, which is how "today" becomes tomorrow at nine at night.
 * Nothing in this file reads the clock; the caller says what today is.
 */

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
 * and the server runs in UTC — three hours off, silently, every time.
 *
 * Two passes because the offset belongs to the instant, not to the text: the
 * first guess picks the offset, the second applies the offset that actually
 * holds there. Brazil has no DST today, so the second pass is a no-op — and it
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

// Fixed national holidays, month and day. Municipal and state holidays are
// not here: there is nowhere for an office to declare them yet, and guessing
// them would close a counter that is open.
const FIXED_HOLIDAYS = [
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Consciência Negra
  "12-25", // Natal
];

/** Every national holiday of the year, fixed and Easter derived. */
export function nationalHolidays(year: number): Set<IsoDate> {
  const easter = easterSunday(year);
  return new Set([
    ...FIXED_HOLIDAYS.map((suffix) => `${year}-${suffix}`),
    // Carnival Tuesday is not a statutory holiday, but no notary office in the
    // country opens on it. Ash Wednesday (Easter minus 46), when they open at
    // noon, is left in: half a day of appointments beats none.
    addDays(easter, -47),
    addDays(easter, -2), // Sexta-feira Santa
    addDays(easter, 60), // Corpus Christi
  ]);
}

export function isHoliday(date: IsoDate): boolean {
  return nationalHolidays(Number(date.slice(0, 4))).has(date);
}

/** A day the office opens: weekday, not a national holiday. */
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
 * "Quarta, 5 de agosto de 2026" — the date written out, the way the panel's
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
