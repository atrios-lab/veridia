import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import {
  counterStatus,
  counterStatusLabel,
  formatClock,
  isChatOpen,
  isChatVisible,
  isWithinChatHours,
  nextChatOpening,
} from "./hours.ts";

// 2026-08-11 is a Tuesday, a plain business day with no national holiday
// nearby. São Paulo has no DST since 2019, so it is UTC-3 year round: 13:00Z
// is 10:00 on the office's wall clock.
const TUESDAY_10AM = new Date("2026-08-11T13:00:00Z");
// 07:00 São Paulo: before the 8h opening.
const TUESDAY_7AM = new Date("2026-08-11T10:00:00Z");
// 14:00 São Paulo: the configured closing hour itself, which the window
// treats as already closed (see src/core/scheduling/slots.ts, "14 means the
// last band is 13h to 14h").
const TUESDAY_2PM = new Date("2026-08-11T17:00:00Z");
// 2026-08-08 is a Saturday.
const SATURDAY_10AM = new Date("2026-08-08T13:00:00Z");

test("within the configured window on a business day", () => {
  assert.equal(isWithinChatHours(cartorioMarinho, TUESDAY_10AM), true);
});

test("before the opening hour", () => {
  assert.equal(isWithinChatHours(cartorioMarinho, TUESDAY_7AM), false);
});

test("at the closing hour itself", () => {
  assert.equal(isWithinChatHours(cartorioMarinho, TUESDAY_2PM), false);
});

test("a weekend is never within chat hours, whatever the hour", () => {
  assert.equal(isWithinChatHours(cartorioMarinho, SATURDAY_10AM), false);
});

test("opens later today when it is still before the opening hour", () => {
  assert.deepEqual(nextChatOpening(cartorioMarinho, TUESDAY_7AM), {
    day: "2026-08-11",
    hour: 8,
    minute: 0,
  });
});

test("opens the next business day once today's window has passed", () => {
  assert.deepEqual(nextChatOpening(cartorioMarinho, TUESDAY_2PM), {
    day: "2026-08-12",
    hour: 8,
    minute: 0,
  });
});

test("a Saturday opens on Monday", () => {
  assert.deepEqual(nextChatOpening(cartorioMarinho, SATURDAY_10AM), {
    day: "2026-08-10",
    hour: 8,
    minute: 0,
  });
});

test("the switch opens the chat outside the office's own hours", () => {
  // The bug this replaced: the office turned "Disponível para o chat" on, on
  // a Saturday, and the site went on saying "fora do horário", because the
  // schedule answered the question and the switch was never asked.
  assert.equal(isChatOpen("on", cartorioMarinho, SATURDAY_10AM), true);
  assert.equal(isChatOpen("on", cartorioMarinho, TUESDAY_2PM), true);
});

test("on automatic, the office's hours still decide", () => {
  assert.equal(isChatOpen("auto", cartorioMarinho, TUESDAY_10AM), true);
  assert.equal(isChatOpen("auto", cartorioMarinho, TUESDAY_7AM), false);
  assert.equal(isChatOpen("auto", cartorioMarinho, SATURDAY_10AM), false);
});

test("switched off, no hour of any day opens it", () => {
  assert.equal(isChatOpen("off", cartorioMarinho, TUESDAY_10AM), false);
  assert.equal(isChatVisible("off"), false);
  // The other two keep the button on screen: closed is not the same as gone.
  assert.equal(isChatVisible("on"), true);
  assert.equal(isChatVisible("auto"), true);
});

// Tuesday 2026-08-11 at a given wall-clock time in the office (UTC-3).
const tuesdayAt = (clock: string) => new Date(`2026-08-11T${clock}:00-03:00`);

// Macaíba's shape: 8h to 16h, lunch from 12h to 13h30.
const SPLIT: Tenant = {
  ...cartorioMarinho,
  counterHours: {
    startHour: 8,
    endHour: 16,
    lunchBreak: { start: "12:00", end: "13:30" },
  },
};

test("formatClock writes times the way the office's sentence does", () => {
  assert.equal(formatClock({ hour: 8, minute: 0 }), "8h");
  assert.equal(formatClock({ hour: 13, minute: 30 }), "13h30");
  assert.equal(formatClock({ hour: 9, minute: 5 }), "9h05");
});

test("the lunch break closes the counter and the chat", () => {
  assert.equal(isWithinChatHours(SPLIT, tuesdayAt("11:59")), true);
  assert.equal(isWithinChatHours(SPLIT, tuesdayAt("12:00")), false);
  assert.equal(isWithinChatHours(SPLIT, tuesdayAt("13:29")), false);
  assert.equal(isWithinChatHours(SPLIT, tuesdayAt("13:30")), true);
  assert.equal(isChatOpen("auto", SPLIT, tuesdayAt("13:00")), false);
});

test("during the break the chat reopens today, on the half hour", () => {
  assert.deepEqual(nextChatOpening(SPLIT, tuesdayAt("13:00")), {
    day: "2026-08-11",
    hour: 13,
    minute: 30,
  });
});

test("an office without a break stays open straight through lunch", () => {
  assert.equal(isWithinChatHours(cartorioMarinho, tuesdayAt("12:30")), true);
});

test("open before the break: the next stop is the break", () => {
  const now = tuesdayAt("10:00");
  const status = counterStatus(SPLIT, now);
  assert.deepEqual(status, {
    open: true,
    closesAt: { hour: 12, minute: 0 },
    forBreak: true,
  });
  assert.equal(
    counterStatusLabel(status, now),
    "Aberto agora · intervalo às 12h",
  );
});

test("open after the break: the next stop is the end of the day", () => {
  const now = tuesdayAt("14:00");
  assert.equal(
    counterStatusLabel(counterStatus(SPLIT, now), now),
    "Aberto agora · fecha às 16h",
  );
});

test("on the break, the label says when it comes back", () => {
  const now = tuesdayAt("12:15");
  assert.equal(
    counterStatusLabel(counterStatus(SPLIT, now), now),
    "Em intervalo · volta às 13h30",
  );
});

test("open on a straight day: closes at the end of it", () => {
  assert.equal(
    counterStatusLabel(
      counterStatus(cartorioMarinho, TUESDAY_10AM),
      TUESDAY_10AM,
    ),
    "Aberto agora · fecha às 14h",
  );
});

test("before opening, it opens today", () => {
  assert.equal(
    counterStatusLabel(
      counterStatus(cartorioMarinho, TUESDAY_7AM),
      TUESDAY_7AM,
    ),
    "Fechado agora · abre hoje às 8h",
  );
});

test("after closing, it opens the next business day", () => {
  assert.equal(
    counterStatusLabel(
      counterStatus(cartorioMarinho, TUESDAY_2PM),
      TUESDAY_2PM,
    ),
    "Fechado agora · abre quarta às 8h",
  );
});

test("on a Saturday, it opens on Monday", () => {
  assert.equal(
    counterStatusLabel(
      counterStatus(cartorioMarinho, SATURDAY_10AM),
      SATURDAY_10AM,
    ),
    "Fechado agora · abre segunda às 8h",
  );
});

test("after the afternoon span, a split day also opens the next morning", () => {
  const now = tuesdayAt("16:30");
  assert.deepEqual(counterStatus(SPLIT, now), {
    open: false,
    opensAt: { day: "2026-08-12", hour: 8, minute: 0 },
    onBreak: false,
  });
});

test("on a weekday holiday the line says why it is closed", () => {
  // 2026-06-24, São João, is a Wednesday: closed by the RN Código de Normas.
  const now = new Date("2026-06-24T13:00:00Z");
  const status = counterStatus(cartorioMarinho, now);
  assert.equal(status.open, false);
  assert.equal(
    counterStatusLabel(status, now),
    "Fechado hoje, feriado de São João · abre quinta às 8h",
  );
  assert.equal(isChatOpen("auto", cartorioMarinho, now), false);
});

test("a weekend is plain closed, even when it is also a holiday", () => {
  // 2026-10-03, Mártires de Cunhaú e Uruaçu, is a Saturday.
  const now = new Date("2026-10-03T13:00:00Z");
  assert.equal(
    counterStatusLabel(counterStatus(cartorioMarinho, now), now),
    "Fechado agora · abre segunda às 8h",
  );
});

test("on the office's own holiday the line names it too", () => {
  const office: Tenant = {
    ...cartorioMarinho,
    customHolidays: [
      { name: "Dia do Evangélico", date: "2026-11-30", yearly: true },
    ],
  };
  // 2026-11-30 is a Monday.
  const now = new Date("2026-11-30T13:00:00Z");
  assert.equal(
    counterStatusLabel(counterStatus(office, now), now),
    "Fechado hoje, feriado de Dia do Evangélico · abre terça às 8h",
  );
});

test("a law day the office switched off leaves the counter open", () => {
  const office: Tenant = { ...cartorioMarinho, disabledHolidays: ["sao-joao"] };
  // 2026-06-24, São João, a Wednesday, 10h.
  const now = new Date("2026-06-24T13:00:00Z");
  assert.equal(counterStatus(office, now).open, true);
});
