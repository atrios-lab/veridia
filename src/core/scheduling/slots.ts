import type { IsoDate } from "./calendar.ts";

/**
 * The counter's day, cut into hour long bands.
 *
 * A band, not a minute: the office serves whoever walks in during the hour, so
 * promising "09:30" would be a promise about a queue nobody controls. The
 * citizen picks an hour and arrives inside it.
 */
export interface SchedulingWindow {
  /** First band starts here. 8 means the 8h band. */
  startHour: number;
  /** The counter closes here. 14 means the last band is 13h to 14h. */
  endHour: number;
  /** How many appointments the office takes inside one band. */
  capacityPerSlot: number;
}

/** How far ahead the office offers days on the scheduling page. */
export const OFFERED_DAYS = 10;

export type SlotState = "free" | "taken";

export interface Slot {
  hour: number;
  label: string;
  state: SlotState;
}

/** How many appointments are already asked for, keyed by band start hour. */
export type Occupancy = Record<number, number>;

export function slotHours(window: SchedulingWindow): number[] {
  const hours: number[] = [];
  for (let hour = window.startHour; hour < window.endHour; hour++) {
    hours.push(hour);
  }
  return hours;
}

/** "8h às 9h", read out loud the way the office says it at the counter. */
export function slotLabel(hour: number): string {
  return `${hour}h às ${hour + 1}h`;
}

export function slots(window: SchedulingWindow, occupancy: Occupancy): Slot[] {
  return slotHours(window).map((hour) => ({
    hour,
    label: slotLabel(hour),
    state: (occupancy[hour] ?? 0) >= window.capacityPerSlot ? "taken" : "free",
  }));
}

export function isSlotFree(
  window: SchedulingWindow,
  occupancy: Occupancy,
  hour: number,
): boolean {
  if (!slotHours(window).includes(hour)) return false;
  return (occupancy[hour] ?? 0) < window.capacityPerSlot;
}

export function hasFreeSlot(
  window: SchedulingWindow,
  occupancy: Occupancy,
): boolean {
  return slots(window, occupancy).some((slot) => slot.state === "free");
}

/**
 * The first day in the offered range that still has a band, so a full day can
 * name its way out instead of telling the citizen to try again tomorrow.
 */
export function nextDayWithSlot(
  window: SchedulingWindow,
  days: IsoDate[],
  occupancyByDay: Map<IsoDate, Occupancy>,
  after: IsoDate,
): IsoDate | undefined {
  return days
    .filter((day) => day > after)
    .find((day) => hasFreeSlot(window, occupancyByDay.get(day) ?? {}));
}

/** The first free band of a day, for the "chegue a partir das" line. */
export function firstFreeSlot(
  window: SchedulingWindow,
  occupancy: Occupancy,
): Slot | undefined {
  return slots(window, occupancy).find((slot) => slot.state === "free");
}
