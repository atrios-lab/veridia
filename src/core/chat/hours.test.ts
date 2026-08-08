import assert from "node:assert/strict";
import { test } from "node:test";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import { isWithinChatHours, nextChatOpening } from "./hours.ts";

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
  });
});

test("opens the next business day once today's window has passed", () => {
  assert.deepEqual(nextChatOpening(cartorioMarinho, TUESDAY_2PM), {
    day: "2026-08-12",
    hour: 8,
  });
});

test("a Saturday opens on Monday", () => {
  assert.deepEqual(nextChatOpening(cartorioMarinho, SATURDAY_10AM), {
    day: "2026-08-10",
    hour: 8,
  });
});
