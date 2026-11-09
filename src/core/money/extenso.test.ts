import assert from "node:assert/strict";
import { test } from "node:test";
import { integerInWords, reaisInWords } from "./extenso.ts";

test("inteiros por extenso, com o 'e' onde a fala põe", () => {
  assert.equal(integerInWords(0), "zero");
  assert.equal(integerInWords(16), "dezesseis");
  assert.equal(integerInWords(100), "cem");
  assert.equal(integerInWords(101), "cento e um");
  assert.equal(integerInWords(1000), "mil");
  assert.equal(integerInWords(1500), "mil e quinhentos");
  assert.equal(integerInWords(1234), "mil duzentos e trinta e quatro");
  assert.equal(integerInWords(2100), "dois mil e cem");
  assert.equal(integerInWords(27000), "vinte e sete mil");
  assert.equal(integerInWords(1_200_000), "um milhão e duzentos mil");
});

test("reais por extenso, como nas guias", () => {
  assert.equal(reaisInWords(2_700_000), "vinte e sete mil reais");
  assert.equal(reaisInWords(1_500_000), "quinze mil reais");
  assert.equal(reaisInWords(100), "um real");
  assert.equal(reaisInWords(150), "um real e cinquenta centavos");
  assert.equal(reaisInWords(1), "um centavo");
  assert.equal(reaisInWords(100_000_000), "um milhão de reais");
  assert.equal(
    reaisInWords(25_000_050),
    "duzentos e cinquenta mil reais e cinquenta centavos",
  );
  assert.equal(reaisInWords(81_000), "oitocentos e dez reais");
});
