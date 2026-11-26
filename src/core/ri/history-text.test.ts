import assert from "node:assert/strict";
import { test } from "node:test";
import { plainValue } from "./history-text.ts";

test("o histórico nunca mostra null nem código", () => {
  assert.equal(plainValue(null), "vazio");
  assert.equal(plainValue(""), "vazio");
  assert.equal(plainValue(true), "sim");
  assert.equal(plainValue(["a", "b"]), "2 itens");
  assert.equal(plainValue({ a: 1, b: null }), "1 dado(s) preenchido(s)");
  assert.equal(plainValue("001"), "001");
});
