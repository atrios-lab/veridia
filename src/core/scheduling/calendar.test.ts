import assert from "node:assert/strict";
import { test } from "node:test";
import { fromZonedDateTime, toZonedDateTimeInput } from "./calendar.ts";

test("a datetime typed at the counter means the office's wall clock", () => {
  // 14:30 in Ielmo Marinho is 17:30 UTC: the server must not read it as its
  // own 14:30, which is what `new Date(local)` would do in production.
  const instant = fromZonedDateTime("2026-08-09T14:30", "America/Sao_Paulo");
  assert.equal(instant.toISOString(), "2026-08-09T17:30:00.000Z");
  // And back, so the form shows what was typed, not what was stored.
  assert.equal(
    toZonedDateTimeInput(instant, "America/Sao_Paulo"),
    "2026-08-09T14:30",
  );
});

test("a zone that still keeps DST lands on the right side of the change", () => {
  const winter = fromZonedDateTime("2026-01-15T12:00", "Europe/Lisbon");
  const summer = fromZonedDateTime("2026-07-15T12:00", "Europe/Lisbon");
  assert.equal(winter.toISOString(), "2026-01-15T12:00:00.000Z");
  assert.equal(summer.toISOString(), "2026-07-15T11:00:00.000Z");
});
