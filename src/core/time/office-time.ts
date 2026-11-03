import { toIsoDate } from "../scheduling/calendar.ts";

/**
 * The office's time zone. Every office served is in Rio Grande do Norte, and
 * the server runs in UTC: without this, from nine at night a request filed
 * today reads as filed tomorrow. Fortaleza rather than Sao_Paulo because it is
 * the zone that covers the state, and would not follow São Paulo if daylight
 * saving came back.
 */
export const OFFICE_TIME_ZONE = "America/Fortaleza";

const DATE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});

const DAY_MONTH_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const MONTH_YEAR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  month: "2-digit",
  year: "numeric",
});

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  weekday: "long",
});

const MONTH = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  month: "long",
});

/*
 * These take a Date, not a string, on purpose: a day on the calendar and an
 * instant both travel as strings, and `new Date("2026-11-20")` is the evening
 * of the 19th here. Writing the conversion at the call site keeps that mistake
 * in sight. A calendar day has no zone to apply: it goes to `formatDate` in
 * scheduling/calendar.ts instead.
 */

/** "03/11/2026" */
export function formatOfficeDate(instant: Date): string {
  return DATE.format(instant);
}

/** "03/11" */
export function formatOfficeDayMonth(instant: Date): string {
  return DAY_MONTH.format(instant);
}

/** "03/11, 22:30" */
export function formatOfficeDayMonthTime(instant: Date): string {
  return DAY_MONTH_TIME.format(instant);
}

/** "03/11/2026, 22:30" */
export function formatOfficeDateTime(instant: Date): string {
  return DATE_TIME.format(instant);
}

/** "22:30" */
export function formatOfficeTime(instant: Date): string {
  return TIME.format(instant);
}

/** "11/2026" */
export function formatOfficeMonthYear(instant: Date): string {
  return MONTH_YEAR.format(instant);
}

/** "Terça-feira, 3 de novembro" */
export function formatOfficeLongDay(instant: Date): string {
  const weekday = WEEKDAY.format(instant);
  const day = Number(toIsoDate(instant, OFFICE_TIME_ZONE).slice(8, 10));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day} de ${MONTH.format(instant)}`;
}

/** The year on the office's calendar, the one a protocol number carries. */
export function officeYear(instant: Date): number {
  return Number(toIsoDate(instant, OFFICE_TIME_ZONE).slice(0, 4));
}
