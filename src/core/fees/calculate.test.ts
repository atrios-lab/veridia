import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateFee } from "./calculate.ts";

// Worked example: office fee R$ 100,00, state funds R$ 30,00, ISS 5%.
const example = { emolumentCents: 10_000, fundsCents: 3_000, issRate: 0.05 };

test("the citizen pays fee plus funds, with no ISS in it", () => {
  const { totalCents } = calculateFee(example);
  assert.equal(totalCents, 13_000);
});

test("ISS is charged on the fee and deducted from the office share", () => {
  const { issCents, netCents, totalCents } = calculateFee(example);
  assert.equal(issCents, 500);
  assert.equal(netCents, 9_500);
  // Raising the rate must not move what the citizen pays.
  assert.equal(
    calculateFee({ ...example, issRate: 0.3 }).totalCents,
    totalCents,
  );
});

test("the invoice base is the office fee, not the total", () => {
  const { nfseBaseCents } = calculateFee(example);
  assert.equal(nfseBaseCents, example.emolumentCents);
});

test("ISS rounds to whole cents", () => {
  const { issCents } = calculateFee({
    emolumentCents: 3_333,
    fundsCents: 0,
    issRate: 0.05,
  });
  assert.equal(issCents, 167); // 166.65 rounds up
});
