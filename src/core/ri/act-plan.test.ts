import assert from "node:assert/strict";
import { test } from "node:test";
import { planActs } from "./act-plan.ts";

test("propõe R ou AV e põe na ordem: cancela, transmite, onera", () => {
  const plan = planActs(
    "Compra e venda; alienação fiduciária; cancelamento de hipoteca",
  );
  assert.deepEqual(
    plan.map((p) => [p.kind, p.effect]),
    [
      ["AV", "cancelamento"],
      ["R", "transmissao"],
      ["R", "onus"],
    ],
  );
});

test("o que o cartório ensinou vale antes do catálogo", () => {
  const plan = planActs("Cédula rural pignoratícia", [
    { cue: "cedula rural pignoraticia", kind: "R", effect: "onus", uses: 3 },
  ]);
  assert.equal(plan[0]?.basis, "aprendido");
  assert.equal(planActs("Ato estranho xyz")[0]?.kind, null);
});
