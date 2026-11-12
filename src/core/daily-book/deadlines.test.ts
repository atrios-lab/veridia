import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookDuties,
  februaryVisto,
  fifteenthOrNextBusinessDay,
} from "./deadlines.ts";

test("visto (CGJ/RN art. 61): 15º dia útil de fevereiro, com o Carnaval contado", () => {
  // 2027: Carnaval em 08 e 09/02, Cinzas 10/02.
  const day = februaryVisto(2027);
  assert.ok(day >= "2027-02-19" && day <= "2027-02-26", day);
});

test("Justiça Aberta: dia 15 ou o próximo dia útil (Provimento CNJ 24/2012, art. 2º)", () => {
  // 15/01/2028 é um sábado.
  assert.equal(fifteenthOrNextBusinessDay(2028, 1), "2028-01-17");
  assert.equal(fifteenthOrNextBusinessDay(2027, 7), "2027-07-15");
});

test("RN: balanço até 15/01, remessa em 5 dias e visto", () => {
  const before = bookDuties("2027-01-05", { lastYearBalanceOn: null });
  assert.deepEqual(
    before.map((d) => d.id),
    ["balanco", "justica-aberta"],
  );
  assert.equal(
    bookDuties("2027-01-20", { lastYearBalanceOn: null }).find(
      (d) => d.id === "balanco",
    )?.late,
    true,
  );
  assert.deepEqual(
    bookDuties("2027-01-14", { lastYearBalanceOn: "2027-01-12" }).map((d) => [
      d.id,
      d.due,
    ]),
    [
      ["remessa", "2027-01-17"],
      ["justica-aberta", "2027-01-15"],
    ],
  );
  assert.deepEqual(
    bookDuties("2027-01-05", { lastYearBalanceOn: null, state: "PB" }).map(
      (d) => d.id,
    ),
    ["justica-aberta"],
  );
});

test("interino, nacional: trimestral (art. 194, VI) e Justiça Aberta (art. 194, V)", () => {
  const ids = (t: string, period?: "trimestral" | "mensal") =>
    bookDuties(t, {
      lastYearBalanceOn: "2026-01-10",
      interim: true,
      interimPeriod: period,
      state: "PB",
    }).map((d) => d.id);
  assert.deepEqual(ids("2026-10-05"), ["interino-deposito"]);
  assert.deepEqual(ids("2026-11-05"), []);
  assert.deepEqual(ids("2027-07-05"), ["justica-aberta", "interino-deposito"]);
  assert.deepEqual(ids("2026-11-05", "mensal"), []);
});

test("interino no RN: FDJ até o dia 10 no mensal (art. 27) e contas até o dia 20 (art. 21)", () => {
  const ids = (t: string) =>
    bookDuties(t, {
      lastYearBalanceOn: "2026-01-10",
      interim: true,
      interimPeriod: "mensal",
    }).map((d) => d.id);
  assert.deepEqual(ids("2026-06-05"), ["interino-fdj", "interino-contas"]);
  assert.deepEqual(ids("2026-06-15"), ["interino-contas"]);
  assert.deepEqual(ids("2026-06-25"), []);
});

test("Justiça Aberta: todo responsável, titular ou interino (Prov. CNJ 24/2012, art. 2º)", () => {
  const titular = bookDuties("2026-07-03", {
    lastYearBalanceOn: "2026-01-10",
  }).find((d) => d.id === "justica-aberta");
  assert.equal(titular?.due, "2026-07-15");
  assert.ok(titular?.detail.includes("01/01/2026 a 30/06/2026"));
  assert.equal(titular?.detail.includes("interino"), false);
  const janeiro = bookDuties("2027-01-04", {
    lastYearBalanceOn: "2027-01-02",
    interim: true,
  }).find((d) => d.id === "justica-aberta");
  assert.ok(janeiro?.detail.includes("01/07/2026 a 31/12/2026"));
  assert.ok(janeiro?.detail.includes("art. 194, V"));
  // Past the day, the notice is gone.
  assert.equal(
    bookDuties("2026-07-16", { lastYearBalanceOn: "2026-01-10" }).some(
      (d) => d.id === "justica-aberta",
    ),
    false,
  );
});
