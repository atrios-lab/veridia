import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCents } from "./fees/custas.ts";
import {
  centsToMoneyText,
  formatMoneyTyping,
  toMoneyText,
} from "./money-input.ts";
import { parseCentsInput } from "./request/money.ts";
import { parseMoneyBRL } from "./transparency/bulletin.ts";

describe("valor digitado", () => {
  it("enche a partir dos centavos, como a maquininha", () => {
    const typed = ["1", "12", "123", "1234", "12345", "123456"].map(
      formatMoneyTyping,
    );
    assert.deepEqual(typed, [
      "0,01",
      "0,12",
      "1,23",
      "12,34",
      "123,45",
      "1.234,56",
    ]);
    assert.equal(formatMoneyTyping("4823010"), "48.230,10");
  });

  it("apagar volta uma casa; vazio continua vazio", () => {
    assert.equal(formatMoneyTyping("1.234,5"), "123,45");
    assert.equal(formatMoneyTyping(""), "");
    assert.equal(formatMoneyTyping("abc"), "");
    assert.equal(formatMoneyTyping("0"), "0,00");
  });

  it("colar um valor pronto mantém o valor", () => {
    assert.equal(formatMoneyTyping("R$ 1.234,56"), "1.234,56");
  });

  it("valor que veio de fora é mostrado no mesmo jeito", () => {
    assert.equal(toMoneyText("1234.5"), "1.234,50");
    assert.equal(toMoneyText("1234,5"), "1.234,50");
    assert.equal(toMoneyText("1.234"), "1.234,00");
    assert.equal(toMoneyText("R$ 57,90"), "57,90");
    assert.equal(toMoneyText(57.9), "57,90");
    assert.equal(toMoneyText(""), "");
    assert.equal(toMoneyText(null), "");
    assert.equal(toMoneyText("isento"), "isento");
  });

  it("todo leitor de valor do painel entende o que o campo escreve", () => {
    const text = centsToMoneyText(123456789);
    assert.equal(text, "1.234.567,89");
    assert.equal(parseCentsInput(text), 123456789);
    assert.equal(parseMoneyBRL(text), 123456789);
    assert.equal(parseCents(text), 123456789);
    assert.equal(parseMoneyBRL("0,00"), 0);
  });
});
