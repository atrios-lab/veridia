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
    ["balanco"],
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
    [["remessa", "2027-01-17"]],
  );
  assert.deepEqual(
    bookDuties("2027-01-05", { lastYearBalanceOn: null, state: "PB" }),
    [],
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
  assert.deepEqual(ids("2027-07-05"), [
    "interino-deposito",
    "interino-justica-aberta",
  ]);
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
