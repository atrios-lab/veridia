import assert from "node:assert/strict";
import { test } from "node:test";
import { deleteReasonOf, hiddenFromListOf } from "./ri-onr-images.ts";

test("o motivo de apagar aparece e tirar da lista não apaga o histórico", () => {
  const history = [
    { at: "1", by: "u", what: "apagou a imagem", why: "Era teste" },
    { at: "2", by: "u", what: "tirou da lista", why: "Era teste" },
  ];
  assert.equal(deleteReasonOf({ history }), "Era teste");
  assert.equal(hiddenFromListOf({ history }), true);
  const restored = [
    ...history,
    { at: "3", by: "u", what: "restaurou a imagem" },
  ];
  assert.equal(hiddenFromListOf({ history: restored }), false);
});
