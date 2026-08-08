import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  easterSunday,
  formatFullDate,
  formatLongDate,
  isBusinessDay,
  nextBusinessDays,
  shortMonth,
  shortWeekday,
  toIsoDate,
} from "./calendar.ts";
import {
  firstFreeSlot,
  hasFreeSlot,
  isSlotFree,
  nextDayWithSlot,
  type Occupancy,
  type SchedulingWindow,
  slotLabel,
  slots,
} from "./slots.ts";

const window: SchedulingWindow = {
  startHour: 8,
  endHour: 14,
  capacityPerSlot: 2,
};

test("a day is the day on the office's wall, not the server's", () => {
  // Nine at night in Natal is already the next day in UTC.
  const instant = new Date("2026-08-06T23:30:00Z");
  assert.equal(toIsoDate(instant, "America/Sao_Paulo"), "2026-08-06");
  assert.equal(toIsoDate(instant, "UTC"), "2026-08-06");
  assert.equal(
    toIsoDate(new Date("2026-08-07T01:30:00Z"), "America/Sao_Paulo"),
    "2026-08-06",
  );
});

test("Easter is computed, not tabulated", () => {
  assert.equal(easterSunday(2024), "2024-03-31");
  assert.equal(easterSunday(2025), "2025-04-20");
  assert.equal(easterSunday(2026), "2026-04-05");
});

test("weekends and national holidays are not business days", () => {
  assert.equal(isBusinessDay("2026-08-06"), true); // quinta comum
  assert.equal(isBusinessDay("2026-08-08"), false); // sábado
  assert.equal(isBusinessDay("2026-08-09"), false); // domingo
  assert.equal(isBusinessDay("2026-09-07"), false); // Independência
  assert.equal(isBusinessDay("2026-04-03"), false); // sexta-feira santa
  assert.equal(isBusinessDay("2026-02-17"), false); // carnaval
  assert.equal(isBusinessDay("2026-06-04"), false); // Corpus Christi
});

test("the offered days skip the weekend without losing count", () => {
  const days = nextBusinessDays("2026-08-07", 4); // sexta
  assert.deepEqual(days, [
    "2026-08-07",
    "2026-08-10",
    "2026-08-11",
    "2026-08-12",
  ]);
});

test("a holiday inside the range does not shorten it", () => {
  const days = nextBusinessDays("2026-09-04", 3); // sexta antes do feriado
  assert.deepEqual(days, ["2026-09-04", "2026-09-08", "2026-09-09"]);
});

test("day labels are written for a citizen in Portuguese", () => {
  assert.equal(shortWeekday("2026-08-06"), "qui");
  assert.equal(shortMonth("2026-08-06"), "ago");
  assert.equal(formatLongDate("2026-08-06"), "quinta, 06/08/2026");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("a band is taken once the office's capacity for it is reached", () => {
  const state = slots(window, { 9: 1, 10: 2, 12: 3 });
  assert.deepEqual(
    state.map((slot) => [slot.hour, slot.state]),
    [
      [8, "free"],
      [9, "free"],
      [10, "taken"],
      [11, "free"],
      [12, "taken"],
      [13, "free"],
    ],
  );
  assert.equal(slotLabel(8), "8h às 9h");
  assert.equal(isSlotFree(window, { 10: 2 }, 10), false);
  // A band outside the office's window is never free, whatever it says.
  assert.equal(isSlotFree(window, {}, 15), false);
});

test("a full day names the next day with a band", () => {
  const full = { 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2 };
  assert.equal(hasFreeSlot(window, full), false);
  assert.equal(firstFreeSlot(window, full), undefined);
  assert.equal(firstFreeSlot(window, { 8: 2, 9: 2 })?.hour, 10);

  const days = ["2026-08-05", "2026-08-06", "2026-08-07"];
  const occupancy = new Map<string, Occupancy>([
    ["2026-08-05", full],
    ["2026-08-06", full],
    ["2026-08-07", { 8: 1 }],
  ]);
  assert.equal(
    nextDayWithSlot(window, days, occupancy, "2026-08-05"),
    "2026-08-07",
  );
  assert.equal(
    nextDayWithSlot(window, days, occupancy, "2026-08-07"),
    undefined,
  );
});

test("the panel header date is written out in Portuguese", () => {
  assert.equal(formatFullDate("2026-08-05"), "Quarta, 5 de agosto de 2026");
  // No leading zero on the day, and March keeps its cedilla.
  assert.equal(formatFullDate("2026-03-01"), "Domingo, 1 de março de 2026");
  assert.equal(formatFullDate("2026-12-31"), "Quinta, 31 de dezembro de 2026");
});

test("the header shows the office's day, not the server's", () => {
  // 05/08/2026 at 23h30 in Sao Paulo is already the 6th in UTC. The header
  // has to say the 5th: the counter is closed and the office has not turned
  // the page.
  const lateEvening = new Date("2026-08-06T02:30:00Z");
  assert.equal(
    formatFullDate(toIsoDate(lateEvening, "America/Sao_Paulo")),
    "Quarta, 5 de agosto de 2026",
  );
});
