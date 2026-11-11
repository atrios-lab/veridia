import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closesAt,
  DEFAULT_ACCESS_HOURS,
  endOfOfficeDay,
  mayAccess,
  parseAccessHours,
  validHours,
} from "./access-hours.ts";

// 11/11/2026 in Ielmo Marinho (UTC-3).
const at = (hhmm: string) => new Date(`2026-11-11T${hhmm}:00-03:00`);

test("o painel abre das 07:00 às 18:00 para quem não foi liberado", () => {
  const hours = parseAccessHours(null);
  assert.deepEqual(hours, DEFAULT_ACCESS_HOURS);
  assert.equal(mayAccess(hours, "staff", "joao", at("06:59")), false);
  assert.equal(mayAccess(hours, "staff", "joao", at("07:00")), true);
  assert.equal(mayAccess(hours, "staff", "joao", at("17:59")), true);
  assert.equal(mayAccess(hours, "staff", "joao", at("18:00")), false);
  assert.equal(mayAccess(hours, "staff", "joao", at("23:30")), false);
});

test("Tabelião/Registrador e a Átrios nunca ficam de fora", () => {
  const hours = parseAccessHours(null);
  assert.equal(mayAccess(hours, "admin", "maria", at("22:00")), true);
  assert.equal(mayAccess(hours, "superadmin", "x", at("03:00")), true);
});

test("liberado sempre ou até um horário", () => {
  const hours = parseAccessHours({
    always: ["ana"],
    until: { joao: at("20:00").toISOString() },
  });
  assert.equal(mayAccess(hours, "staff", "ana", at("23:00")), true);
  assert.equal(mayAccess(hours, "staff", "joao", at("19:59")), true);
  assert.equal(mayAccess(hours, "staff", "joao", at("20:00")), false);
  assert.equal(closesAt(hours, "staff", "ana", at("10:00")), undefined);
  assert.equal(
    closesAt(hours, "staff", "joao", at("19:00"))?.toISOString(),
    at("20:00").toISOString(),
  );
  assert.equal(
    closesAt(hours, "staff", "pedro", at("17:30"))?.toISOString(),
    at("18:00").toISOString(),
  );
  assert.equal(
    endOfOfficeDay(at("18:30")).toISOString(),
    new Date("2026-11-12T00:00:00-03:00").toISOString(),
  );
});

test("horário inválido volta ao padrão; desligado abre sempre", () => {
  assert.equal(validHours("18:00", "07:00"), false);
  assert.equal(validHours("07:30", "19:00"), true);
  const bad = parseAccessHours({ start: "25:00", end: "18:00" });
  assert.equal(bad.start, "07:00");
  const off = parseAccessHours({ enabled: false });
  assert.equal(mayAccess(off, "staff", "joao", at("02:00")), true);
});
