import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLOSING_STATUS,
  closingStage,
  describeDocument,
  PickupInputSchema,
} from "./pickup.ts";

// Fictitious people only. 529.982.247-25 is a CPF that only passes the check digits.
const valid = {
  personName: "  Marta Exemplo Souza ",
  relation: "authorized",
  documentType: "cpf",
  documentNumber: "529.982.247-25",
  note: "",
};

test("cada jeito de fechar leva ao andamento certo", () => {
  assert.equal(CLOSING_STATUS.digital, "done");
  assert.equal(CLOSING_STATUS.counter, "ready-for-pickup");
});

test("o cartão de entrega pergunta só quando há documento liberado e o pedido está no meio do caminho", () => {
  const base = { released: 1, held: 0, hasPickup: false };
  assert.equal(closingStage({ ...base, status: "processing" }), "ask");
  assert.equal(closingStage({ ...base, status: "in-review" }), "ask");
  // No document yet, or waiting for something else: nothing to ask.
  assert.equal(
    closingStage({ ...base, released: 0, status: "processing" }),
    "none",
  );
  for (const status of [
    "awaiting-payment",
    "awaiting-compliance",
    "awaiting-guide-payment",
    "cancelled",
    "rejected",
  ]) {
    assert.equal(closingStage({ ...base, status }), "none");
  }
  // A document held until signed cannot close the request.
  assert.equal(
    closingStage({
      status: "processing",
      released: 0,
      held: 1,
      hasPickup: false,
    }),
    "held",
  );
  // Waiting for the pickup, and after it.
  assert.equal(closingStage({ ...base, status: "ready-for-pickup" }), "pickup");
  assert.equal(closingStage({ ...base, status: "done" }), "none");
  assert.equal(
    closingStage({ ...base, status: "done", hasPickup: true }),
    "picked-up",
  );
});

test("quem retirou é conferido, e o CPF é guardado só com os números", () => {
  const ok = PickupInputSchema.safeParse(valid);
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.personName, "Marta Exemplo Souza");
  assert.equal(ok.success && ok.data.documentNumber, "52998224725");
  // Another document stays as typed.
  const rg = PickupInputSchema.safeParse({
    ...valid,
    documentType: "rg",
    documentNumber: "1.234.567 SSP/RN",
  });
  assert.equal(rg.success && rg.data.documentNumber, "1.234.567 SSP/RN");
  for (const bad of [
    { ...valid, personName: "Ana" },
    { ...valid, relation: "vizinho" },
    { ...valid, documentType: "passaporte" },
    { ...valid, documentNumber: "111.111.111-11" },
    { ...valid, documentNumber: "529.982.247-26" },
    { ...valid, documentNumber: "" },
    { ...valid, note: "x".repeat(501) },
  ]) {
    assert.equal(PickupInputSchema.safeParse(bad).success, false);
  }
});

test("o painel mostra o documento com o meio escondido", () => {
  assert.equal(describeDocument("cpf", "52998224725"), "CPF 529.***.***-25");
  assert.equal(describeDocument("rg", "1234567"), "RG ***567");
  assert.equal(describeDocument("other", "ab"), "Outro documento ab");
});
