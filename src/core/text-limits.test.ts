import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LONG_TEXT_MAX,
  LONG_TEXT_TOO_LONG,
  MIN_JUSTIFICATION,
} from "./text-limits.ts";

test("textos longos aceitam até 5.000 caracteres", () => {
  assert.equal(LONG_TEXT_MAX, 5000);
});

test("justificativa pede pelo menos 3 caracteres", () => {
  assert.equal(MIN_JUSTIFICATION, 3);
});

test("a mensagem de texto longo diz o limite", () => {
  assert.equal(LONG_TEXT_TOO_LONG, "Use até 5.000 caracteres.");
});
