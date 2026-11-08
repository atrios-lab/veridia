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

/**
 * A day off a law or a norm declares: an id that stays the same every year
 * (what an office switches off by), the name the status line shows, and
 * either a fixed month-day or an offset from Easter Sunday.
 */
type HolidayRule = {
  id: string;
  name: string;
} & ({ fixed: string } | { fromEaster: number });

// National holidays by federal law.
const NATIONAL_RULES: HolidayRule[] = [
  {
    id: "confraternizacao",
    name: "Confraternização Universal",
    fixed: "01-01",
  },
  { id: "tiradentes", name: "Tiradentes", fixed: "04-21" },
  { id: "trabalho", name: "Dia do Trabalho", fixed: "05-01" },
  { id: "independencia", name: "Independência do Brasil", fixed: "09-07" },
  { id: "aparecida", name: "Nossa Senhora Aparecida", fixed: "10-12" },
  { id: "finados", name: "Finados", fixed: "11-02" },
  { id: "republica", name: "Proclamação da República", fixed: "11-15" },
  // Lei 14.759/2023.
  { id: "consciencia-negra", name: "Consciência Negra", fixed: "11-20" },
  { id: "natal", name: "Natal", fixed: "12-25" },
  // Carnival Tuesday is not a statutory holiday, but no notary office in the
  // country opens on it.
  { id: "carnaval-terca", name: "Carnaval", fromEaster: -47 },
  { id: "paixao", name: "Sexta-feira da Paixão", fromEaster: -2 },
  { id: "corpus-christi", name: "Corpus Christi", fromEaster: 60 },
];

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
 * 8.913/2006). Municipal holidays (also item III) are per town: each office
 * declares its own in the panel (`CustomHoliday`, below).
 */
const STATE_RULES: Record<SupportedState, HolidayRule[]> = {
  RN: [
    { id: "carnaval-segunda", name: "Carnaval", fromEaster: -48 },
    { id: "cinzas", name: "Quarta-feira de Cinzas", fromEaster: -46 },
    { id: "sao-joao", name: "São João", fixed: "06-24" },
    { id: "sao-pedro", name: "São Pedro", fixed: "06-29" },
    { id: "martires", name: "Mártires de Cunhaú e Uruaçu", fixed: "10-03" },
    { id: "vespera-natal", name: "Véspera de Natal", fixed: "12-24" },
    { id: "vespera-ano-novo", name: "Véspera de Ano Novo", fixed: "12-31" },
  ],
};

/**
 * The state whose calendar the platform counts by. Only one is supported
 * today (SUPPORTED_STATES); a test fails the day a second one arrives, which
 * is when `isBusinessDay` has to start taking the office's state.
 */
export const CALENDAR_STATE: SupportedState = "RN";

/** Every id an office may switch off (see `OfficeHolidays.disabledHolidays`). */
export const LAW_HOLIDAY_IDS: readonly string[] = [
  ...NATIONAL_RULES,
  ...STATE_RULES[CALENDAR_STATE],
].map((rule) => rule.id);

/** One law or norm day off on a given year. `movable` follows Easter. */
export type LawHoliday = {
  id: string;
  name: string;
  date: IsoDate;
  movable: boolean;
};

/** The national and state days off of a year, in rule order. */
export function lawHolidays(
  year: number,
  state: SupportedState = CALENDAR_STATE,
): LawHoliday[] {
  const easter = easterSunday(year);
  return [...NATIONAL_RULES, ...STATE_RULES[state]].map((rule) =>
    "fixed" in rule
      ? {
          id: rule.id,
          name: rule.name,
          date: `${year}-${rule.fixed}`,
          movable: false,
        }
      : {
          id: rule.id,
          name: rule.name,
          date: addDays(easter, rule.fromEaster),
          movable: true,
        },
  );
}

/** Every national holiday of the year, fixed and Easter derived. */
export function nationalHolidays(year: number): Map<IsoDate, string> {
  const national = new Set(NATIONAL_RULES.map((rule) => rule.id));
  return new Map(
    lawHolidays(year)
      .filter((h) => national.has(h.id))
      .map((h) => [h.date, h.name]),
  );
}

/**
 * Every day of the year the office does not open, weekends aside, by name:
 * the national and state ones, less the ones the office switched off.
 */
export function closedDays(
  year: number,
  disabled: readonly string[] = [],
  state: SupportedState = CALENDAR_STATE,
): Map<IsoDate, string> {
  return new Map(
    lawHolidays(year, state)
      .filter((h) => !disabled.includes(h.id))
      .map((h) => [h.date, h.name]),
  );
}

/**
 * A day off the office declares itself, from the panel: a municipal holiday
 * (the town's patron saint, its anniversary), a state one the law moved, a
 * local commemoration the office closes for. `yearly` repeats it on the same
 * day and month every year; otherwise it is that date alone.
 */
export type CustomHoliday = {
  name: string;
  date: IsoDate;
  yearly: boolean;
  /** The law that creates it, when the office records one. */
  legalBasis?: string;
};

/**
 * The office's own calendar on top of the law's, as `Tenant` carries it:
 * the days it adds (`customHolidays`) and the law days it does not keep
 * (`disabledHolidays`, by rule id: some only apply in some places, and an
 * office that keeps one on another date switches it off and adds its own).
 * A `Tenant` is one of these as it stands, so callers that know the office
 * pass `officeHolidays(tenant)`.
 */
export type OfficeHolidays = {
  readonly customHolidays?: readonly CustomHoliday[];
  readonly disabledHolidays?: readonly string[];
};

/**
 * Just the two calendar fields of an office: small enough to hand to a
 * client component, where the whole tenant would be far more than it needs.
 */
export function officeHolidays(source: OfficeHolidays): OfficeHolidays {
  return {
    customHolidays: source.customHolidays ?? [],
    disabledHolidays: source.disabledHolidays ?? [],
  };
}

function customHolidayName(
  date: IsoDate,
  custom: readonly CustomHoliday[],
): string | undefined {
  return custom.find((h) =>
    h.yearly ? h.date.slice(5) === date.slice(5) : h.date === date,
  )?.name;
}

/**
 * The holiday's name when the office is closed for one that day: the
 * national and state ones it keeps first, then its own.
 */
export function holidayName(
  date: IsoDate,
  holidays: OfficeHolidays = {},
): string | undefined {
  return (
    closedDays(Number(date.slice(0, 4)), holidays.disabledHolidays).get(date) ??
    customHolidayName(date, holidays.customHolidays ?? [])
  );
}

export function isHoliday(
  date: IsoDate,
  holidays: OfficeHolidays = {},
): boolean {
  return holidayName(date, holidays) !== undefined;
}

/** One day off as a list shows it: when, what, and whose rule it is. */
export type ClosedDay = { date: IsoDate; name: string; own: boolean };

/**
 * Every day the office keeps closed from `from` (included) through `days`
 * calendar days after: the law ones it keeps (`own: false`) and its own
 * (`own: true`), in date order, weekends included so a list can say when a
 * holiday falls on one.
 */
export function upcomingClosedDays(
  from: IsoDate,
  days: number,
  holidays: OfficeHolidays = {},
): ClosedDay[] {
  const result: ClosedDay[] = [];
  let cursor = from;
  for (let step = 0; step <= days; step++) {
    const year = Number(cursor.slice(0, 4));
    const law = closedDays(year, holidays.disabledHolidays).get(cursor);
    const own = customHolidayName(cursor, holidays.customHolidays ?? []);
    if (law) result.push({ date: cursor, name: law, own: false });
    if (own) result.push({ date: cursor, name: own, own: true });
    cursor = addDays(cursor, 1);
  }
  return result;
}

/**
 * The law days off from `from` through `days` after, switched off or not,
 * with their ids: what the panel lists for the office to keep, switch off or
 * take over with its own date.
 */
export function upcomingLawHolidays(from: IsoDate, days: number): LawHoliday[] {
  const to = addDays(from, days);
  const years = [Number(from.slice(0, 4)), Number(to.slice(0, 4))];
  const seen = new Set<string>();
  return years
    .filter((year, index) => years.indexOf(year) === index)
    .flatMap((year) => lawHolidays(year))
    .filter((h) => h.date >= from && h.date <= to)
    .filter((h) => {
      const key = `${h.id}|${h.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * A day the office opens: a weekday that is neither a national holiday, nor
 * a day the state's Código de Normas closes the extrajudicial services, nor
 * one of the office's own days off (`holidays`, from the panel).
 *
 * `holidays` defaults to none so the pure helpers stay easy to call, which
 * makes forgetting it silent: every caller that knows the office passes
 * `officeHolidays(tenant)`.
 */
export function isBusinessDay(
  date: IsoDate,
  holidays: OfficeHolidays = {},
): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

/**
 * The next `count` days the office opens, starting at `from` (included when it
 * is itself a business day). The search stops after a month of calendar days,
 * which no run of holidays in Brazil comes close to.
 */
export function nextBusinessDays(
  from: IsoDate,
  count: number,
  holidays: OfficeHolidays = {},
): IsoDate[] {
  const days: IsoDate[] = [];
  let cursor = from;
  for (let step = 0; step < 31 && days.length < count; step++) {
    if (isBusinessDay(cursor, holidays)) days.push(cursor);
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
