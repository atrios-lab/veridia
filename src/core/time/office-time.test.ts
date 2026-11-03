import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  formatOfficeDate,
  formatOfficeDateTime,
  formatOfficeDayMonth,
  formatOfficeDayMonthTime,
  formatOfficeLongDay,
  formatOfficeMonthYear,
  formatOfficeTime,
  OFFICE_TIME_ZONE,
  officeYear,
} from "./office-time.ts";

const originalZone = process.env.TZ;

afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

// 22:30 on 3 November at the office, already the 4th in UTC.
const lateEvening = new Date("2026-11-04T01:30:00Z");
// 22:00 on 31 December at the office, already next year in UTC.
const newYearsEve = new Date("2027-01-01T01:00:00Z");
// 00:10 on 1 January at the office.
const newYearsDay = new Date("2027-01-01T03:10:00Z");
// Midnight at the office: must read 00:30, never 24:30.
const midnight = new Date("2026-11-04T03:30:00Z");

// The machine that develops this is in Brazil, which is how the bug stayed
// hidden: every assertion runs under zones where a bare formatter would fail.
for (const zone of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
  describe(`with the process in ${zone}`, () => {
    test("an instant reads on the office's wall clock", () => {
      process.env.TZ = zone;
      assert.equal(formatOfficeDate(lateEvening), "03/11/2026");
      assert.equal(formatOfficeDayMonth(lateEvening), "03/11");
      assert.equal(formatOfficeDayMonthTime(lateEvening), "03/11, 22:30");
      assert.equal(formatOfficeDateTime(lateEvening), "03/11/2026, 22:30");
      assert.equal(formatOfficeTime(lateEvening), "22:30");
      assert.equal(formatOfficeMonthYear(lateEvening), "11/2026");
      assert.equal(
        formatOfficeLongDay(lateEvening),
        "Terça-feira, 3 de novembro",
      );
    });

    test("midnight reads as 00, not 24", () => {
      process.env.TZ = zone;
      assert.equal(formatOfficeTime(midnight), "00:30");
    });

    test("the year turns with the office's calendar", () => {
      process.env.TZ = zone;
      assert.equal(officeYear(newYearsEve), 2026);
      assert.equal(officeYear(newYearsDay), 2027);
    });
  });
}

test("the office's zone is the one that covers Rio Grande do Norte", () => {
  assert.equal(OFFICE_TIME_ZONE, "America/Fortaleza");
});
