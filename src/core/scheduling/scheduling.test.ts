import assert from "node:assert/strict";
import { test } from "node:test";
import { SUPPORTED_STATES } from "../transparency/rubrics.ts";
import {
  type AgendaConfig,
  DEFAULT_AGENDA_CONFIG,
  hasGrid,
  parseAgendaConfig,
  slotEndTime,
} from "./agenda.ts";
import {
  appointmentStatusLabel,
  SLOT_HOLDING_STATUSES,
} from "./appointment.ts";
import {
  addDays,
  CALENDAR_STATE,
  easterSunday,
  formatFullDate,
  formatLongDate,
  holidayName,
  isBusinessDay,
  nextBusinessDays,
  shortMonth,
  shortWeekday,
  toIsoDate,
  upcomingClosedDays,
} from "./calendar.ts";
import {
  firstFreeSlot,
  freeSlots,
  hasFreeSlot,
  isSlotFree,
  nextDayWithSlot,
  offeredDays,
  type TakenTimes,
} from "./slots.ts";

// Tuesdays and Thursdays only, the way the office's own Calendly was set up.
// 2026-08-04 is a Tuesday, 2026-08-06 a Thursday.
const config: AgendaConfig = {
  ...DEFAULT_AGENDA_CONFIG,
  grid: {
    "2": ["08:30", "09:00", "09:30"],
    "4": ["08:30", "13:30"],
  },
  services: [{ id: "tabeliao", label: "Tabelião", notaryOnly: false }],
};

const taken = (...times: string[]): TakenTimes => new Set(times);

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

test("only the weekdays the office declared are offered", () => {
  // From a Monday: Tuesday and Thursday of that week, then the next Tuesday.
  assert.deepEqual(offeredDays(config, "2026-08-03", 3), [
    "2026-08-04",
    "2026-08-06",
    "2026-08-11",
  ]);
});

test("an office with no grid offers nothing instead of a default", () => {
  assert.equal(hasGrid(DEFAULT_AGENDA_CONFIG), false);
  assert.equal(hasGrid(config), true);
  assert.deepEqual(offeredDays(DEFAULT_AGENDA_CONFIG, "2026-08-03", 5), []);
});

test("a date the office closed is not offered", () => {
  const closed: AgendaConfig = {
    ...config,
    closedDates: [{ date: "2026-08-06", reason: "Manutenção elétrica." }],
  };
  assert.deepEqual(offeredDays(closed, "2026-08-03", 2), [
    "2026-08-04",
    "2026-08-11",
  ]);
  assert.deepEqual(freeSlots(closed, "2026-08-06", taken()), []);
});

test("a taken time simply stops being offered", () => {
  assert.deepEqual(freeSlots(config, "2026-08-04", taken()), [
    "08:30",
    "09:00",
    "09:30",
  ]);
  assert.deepEqual(freeSlots(config, "2026-08-04", taken("09:00")), [
    "08:30",
    "09:30",
  ]);
  assert.equal(
    isSlotFree(config, "2026-08-04", "09:00", taken("09:00")),
    false,
  );
  // A time the office never declared is never free, whatever the form says.
  assert.equal(isSlotFree(config, "2026-08-04", "11:00", taken()), false);
  // Nor is a time declared for another weekday.
  assert.equal(isSlotFree(config, "2026-08-04", "13:30", taken()), false);
});

test("today stops offering times that have already started", () => {
  const now = { date: "2026-08-04", time: "09:10" };
  assert.deepEqual(freeSlots(config, "2026-08-04", taken(), now), ["09:30"]);
  // A later day keeps every time, whatever the hour is today.
  assert.deepEqual(freeSlots(config, "2026-08-06", taken(), now), [
    "08:30",
    "13:30",
  ]);
});

test("a full day names the next day with a time", () => {
  const full = taken("08:30", "09:00", "09:30");
  assert.equal(hasFreeSlot(config, "2026-08-04", full), false);
  assert.equal(firstFreeSlot(config, "2026-08-04", full), undefined);
  assert.equal(firstFreeSlot(config, "2026-08-04", taken("08:30")), "09:00");

  const days = offeredDays(config, "2026-08-03", 3);
  const takenByDay = new Map<string, TakenTimes>([
    ["2026-08-04", full],
    ["2026-08-06", taken("08:30", "13:30")],
    ["2026-08-11", taken("08:30")],
  ]);
  assert.equal(
    nextDayWithSlot(config, days, takenByDay, "2026-08-04"),
    "2026-08-11",
  );
  assert.equal(
    nextDayWithSlot(config, days, takenByDay, "2026-08-11"),
    undefined,
  );
});

test("agenda config survives a malformed row and sorts the day's times", () => {
  assert.deepEqual(parseAgendaConfig(null), DEFAULT_AGENDA_CONFIG);
  assert.deepEqual(
    parseAgendaConfig({ grid: "nonsense" }),
    DEFAULT_AGENDA_CONFIG,
  );
  const parsed = parseAgendaConfig({
    grid: { "2": ["09:30", "08:30", "09:30"] },
  });
  assert.deepEqual(parsed.grid["2"], ["08:30", "09:30"]);
  assert.equal(slotEndTime("08:30"), "09:30");
  assert.equal(slotEndTime("13:30"), "14:30");
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

test("no_show is labelled Faltou and still holds the slot", () => {
  assert.equal(appointmentStatusLabel("no_show"), "Faltou");
  assert.ok(SLOT_HOLDING_STATUSES.includes("no_show"));
});

test("a config saved before notaryOnly existed parses with the flag off", () => {
  const config = parseAgendaConfig({
    grid: { "1": ["09:00"] },
    services: [{ id: "procuracao", label: "Procuração" }],
    modes: ["Presencial"],
    closedDates: [],
  });
  assert.equal(config.services[0].notaryOnly, false);
});

test("the RN Código de Normas closes the services beyond the national holidays", () => {
  // Provimento 156/2016 (CGJ/RN), §6º; Easter 2026 is April 5th.
  assert.equal(isBusinessDay("2026-02-16"), false); // segunda de Carnaval
  assert.equal(isBusinessDay("2026-02-17"), false); // terça de Carnaval
  assert.equal(isBusinessDay("2026-02-18"), false); // quarta de Cinzas
  assert.equal(isBusinessDay("2026-06-24"), false); // São João
  assert.equal(isBusinessDay("2026-06-29"), false); // São Pedro
  assert.equal(isBusinessDay("2026-10-05"), true); // segunda comum
  assert.equal(isBusinessDay("2026-12-24"), false); // véspera de Natal
  assert.equal(isBusinessDay("2026-12-31"), false); // véspera de Ano Novo
  assert.equal(isBusinessDay("2026-11-20"), false); // Consciência Negra
  assert.equal(isBusinessDay("2026-02-19"), true); // quinta depois das Cinzas
});

test("the RN state holiday closes the services too", () => {
  // 03/10, Mártires de Cunhaú e Uruaçu (Lei estadual 8.913/2006); in 2025 it
  // falls on a Friday.
  assert.equal(isBusinessDay("2025-10-03"), false);
});

test("a closed day carries the name the status line shows", () => {
  assert.equal(holidayName("2026-06-24"), "São João");
  assert.equal(holidayName("2026-02-18"), "Quarta-feira de Cinzas");
  assert.equal(holidayName("2026-04-03"), "Sexta-feira da Paixão");
  assert.equal(holidayName("2026-08-06"), undefined);
});

test("the calendar has a list for every supported state", () => {
  // `isBusinessDay` counts by CALENDAR_STATE alone. The day a second state
  // is supported, it has to start taking the office's state: this fails
  // first, so that day cannot pass unnoticed.
  assert.deepEqual([...SUPPORTED_STATES], [CALENDAR_STATE]);
});

// Ielmo Marinho-like: a patron saint every year and a one-off decree.
const OWN = [
  { name: "São Sebastião", date: "2020-01-20", yearly: true },
  { name: "Ponto facultativo", date: "2026-08-14", yearly: false },
];

test("an office's yearly holiday closes the same day every year", () => {
  assert.equal(isBusinessDay("2026-01-20", OWN), false);
  assert.equal(isBusinessDay("2027-01-20", OWN), false);
  assert.equal(holidayName("2026-01-20", OWN), "São Sebastião");
  assert.equal(isBusinessDay("2026-01-20"), true); // without the office's list
});

test("a one-off holiday closes that date only", () => {
  assert.equal(isBusinessDay("2026-08-14", OWN), false);
  assert.equal(holidayName("2027-08-14", OWN), undefined);
});

test("the office's holidays close the agenda too", () => {
  const config = {
    ...DEFAULT_AGENDA_CONFIG,
    grid: { 5: ["09:00"] }, // sextas
    holidays: OWN,
  };
  // 2026-08-14 is a Friday, the office's ponto facultativo.
  assert.deepEqual(offeredDays(config, "2026-08-14", 1), ["2026-08-21"]);
});

test("the panel lists the days off ahead, law and office apart", () => {
  const days = upcomingClosedDays("2026-06-20", 10, OWN);
  assert.deepEqual(days, [
    { date: "2026-06-24", name: "São João", own: false },
    { date: "2026-06-29", name: "São Pedro", own: false },
  ]);
  assert.deepEqual(upcomingClosedDays("2026-08-14", 0, OWN), [
    { date: "2026-08-14", name: "Ponto facultativo", own: true },
  ]);
});
