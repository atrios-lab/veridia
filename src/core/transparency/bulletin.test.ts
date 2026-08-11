import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bulletinBalanceCents,
  bulletinPeriod,
  formatMoneyBRL,
  formatMonthYear,
  parseCount,
  parseMoneyBRL,
} from "./bulletin.ts";

test("the balance is the screen's example, to the centavo", () => {
  // 48.230,10 − 9.612,44 − 21.480,00 = 17.137,66, the number the mockup
  // shows the operator without them typing it.
  const cents = bulletinBalanceCents({
    actsCount: 412,
    grossRevenueCents: 4_823_010,
    taxesPaidCents: 961_244,
    expensesCents: 2_148_000,
  });
  assert.equal(cents, 1_713_766);
  assert.equal(formatMoneyBRL(cents), "17.137,66");
});

test("a month that spent more than it took reports a negative balance", () => {
  const cents = bulletinBalanceCents({
    actsCount: 10,
    grossRevenueCents: 100_00,
    taxesPaidCents: 50_00,
    expensesCents: 80_00,
  });
  assert.equal(cents, -30_00);
  assert.equal(formatMoneyBRL(cents), "-30,00");
});

test("parseMoneyBRL reads the pt-BR the operator types", () => {
  assert.equal(parseMoneyBRL("48.230,10"), 4_823_010);
  assert.equal(parseMoneyBRL("48230,10"), 4_823_010);
  assert.equal(parseMoneyBRL("48230.10"), 4_823_010);
  assert.equal(parseMoneyBRL("R$ 48.230,10"), 4_823_010);
  assert.equal(parseMoneyBRL("1.000"), 100_000);
  assert.equal(parseMoneyBRL("5"), 500);
  assert.equal(parseMoneyBRL("0,05"), 5);
  assert.equal(parseMoneyBRL("9.612,44"), 961_244);
});

test("parseMoneyBRL refuses what is not money", () => {
  assert.equal(parseMoneyBRL(""), null);
  assert.equal(parseMoneyBRL("abc"), null);
  assert.equal(parseMoneyBRL("1,234"), null); // three decimals
  assert.equal(parseMoneyBRL("1,2,3"), null);
  assert.equal(parseMoneyBRL("-5"), null); // a value, not a sign, is typed
});

test("parseMoneyBRL survives a round trip through formatMoneyBRL", () => {
  for (const cents of [0, 5, 100, 961_244, 4_823_010, 100_000_00]) {
    const round = parseMoneyBRL(formatMoneyBRL(cents));
    assert.equal(round, cents, `round-trip ${cents}`);
  }
});

test("parseCount takes a whole count, nothing else", () => {
  assert.equal(parseCount("412"), 412);
  assert.equal(parseCount("0"), 0);
  assert.equal(parseCount("4,12"), null);
  assert.equal(parseCount("-1"), null);
  assert.equal(parseCount(""), null);
});

test("formatMonthYear and bulletinPeriod read in pt-BR", () => {
  assert.equal(formatMonthYear(8, 2026), "Agosto de 2026");
  assert.equal(bulletinPeriod(8, 2026), "01/08 a 31/08/2026");
  // February in a non-leap year ends on the 28th.
  assert.equal(bulletinPeriod(2, 2026), "01/02 a 28/02/2026");
});
