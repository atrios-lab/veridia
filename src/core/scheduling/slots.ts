import {
  type AgendaConfig,
  closedDate,
  type SlotTime,
  timesForWeekday,
} from "./agenda.ts";
import { addDays, type IsoDate, isBusinessDay, weekday } from "./calendar.ts";

export type { SlotTime };

/**
 * What the citizen may still take, out of what the office declared.
 *
 * Two inputs and no clock: the grid the serventia configured, and the times
 * already booked on a given day. One citizen per time: a time that is taken
 * is simply not offered, which is why nothing here counts capacity.
 */

/** How many open days the page offers at a time. */
export const OFFERED_DAYS = 10;

/**
 * How far the search walks to find them. An office that only receives on
 * Tuesdays needs ten weeks to show ten days; past that the citizen would be
 * booking a visit neither side can plan for.
 */
const SEARCH_HORIZON_DAYS = 70;

/** Times already booked on a day, as taken from the office's records. */
export type TakenTimes = ReadonlySet<SlotTime>;

/** The times the office declared for the weekday this date falls on. */
export function gridTimes(config: AgendaConfig, date: IsoDate): SlotTime[] {
  return timesForWeekday(config, weekday(date));
}

/**
 * Whether the office receives on this date at all: a day it opens, a weekday
 * it declared times for, and not a date it has closed.
 */
export function isOfferedDay(config: AgendaConfig, date: IsoDate): boolean {
  return (
    isBusinessDay(date) &&
    gridTimes(config, date).length > 0 &&
    !closedDate(config, date)
  );
}

/**
 * The next days the office receives, starting at `from` (included when it
 * qualifies). Empty when the office has configured no grid, which the caller
 * shows as the "agende pelo telefone" state rather than as a full agenda.
 */
export function offeredDays(
  config: AgendaConfig,
  from: IsoDate,
  count: number = OFFERED_DAYS,
): IsoDate[] {
  const days: IsoDate[] = [];
  let cursor = from;
  for (
    let step = 0;
    step < SEARCH_HORIZON_DAYS && days.length < count;
    step++
  ) {
    if (isOfferedDay(config, cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/**
 * The office's own wall clock at the moment of the request, so today stops
 * offering times that have already started. Passed in, never read here: this
 * module has no time zone and no clock, same discipline as `calendar.ts`.
 */
export interface AgendaNow {
  date: IsoDate;
  time: SlotTime;
}

/** Whether a time on a date is still in the future, per the office's clock. */
function isAhead(date: IsoDate, time: SlotTime, now?: AgendaNow): boolean {
  if (!now || date > now.date) return true;
  if (date < now.date) return false;
  // Zero padded "HH:mm" compares correctly as text.
  return time > now.time;
}

/** What is still bookable on a date: declared, not taken, not already past. */
export function freeSlots(
  config: AgendaConfig,
  date: IsoDate,
  taken: TakenTimes,
  now?: AgendaNow,
): SlotTime[] {
  if (!isOfferedDay(config, date)) return [];
  return gridTimes(config, date).filter(
    (time) => !taken.has(time) && isAhead(date, time, now),
  );
}

/** Whether one specific time may still be booked, the server's own check
 * before writing, not a courtesy repeated from the page. */
export function isSlotFree(
  config: AgendaConfig,
  date: IsoDate,
  time: SlotTime,
  taken: TakenTimes,
  now?: AgendaNow,
): boolean {
  return freeSlots(config, date, taken, now).includes(time);
}

export function hasFreeSlot(
  config: AgendaConfig,
  date: IsoDate,
  taken: TakenTimes,
  now?: AgendaNow,
): boolean {
  return freeSlots(config, date, taken, now).length > 0;
}

/** The first time still open on a date, for the "a partir das" line. */
export function firstFreeSlot(
  config: AgendaConfig,
  date: IsoDate,
  taken: TakenTimes,
  now?: AgendaNow,
): SlotTime | undefined {
  return freeSlots(config, date, taken, now)[0];
}

const NO_TAKEN: TakenTimes = new Set<SlotTime>();

/**
 * The first day after `after` that still has a time, so a full day can name
 * its way out instead of telling the citizen to try again tomorrow.
 */
export function nextDayWithSlot(
  config: AgendaConfig,
  days: readonly IsoDate[],
  takenByDay: ReadonlyMap<IsoDate, TakenTimes>,
  after: IsoDate,
  now?: AgendaNow,
): IsoDate | undefined {
  return days
    .filter((day) => day > after)
    .find((day) =>
      hasFreeSlot(config, day, takenByDay.get(day) ?? NO_TAKEN, now),
    );
}
