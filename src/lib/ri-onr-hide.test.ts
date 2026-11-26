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

test("o zip leva a hora do cartório, não a do servidor", async () => {
  const { officeClock } = await import("./ri-onr-images.ts");
  // 16:16 em UTC é 13:16 em Fortaleza.
  const d = officeClock(new Date("2026-11-26T16:16:00Z"));
  assert.equal(d.getHours(), 13);
  assert.equal(d.getMinutes(), 16);
});
