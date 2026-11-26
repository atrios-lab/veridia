import assert from "node:assert/strict";
import { test } from "node:test";
import { cueOf, suggestAct } from "./act-learning.ts";

test("a natureza vira palavras, sem número nem nome", () => {
  assert.equal(cueOf("Compra e Venda nº 123/2024"), "compra venda");
  assert.equal(
    cueOf("Cancelamento de hipoteca do R-3"),
    "cancelamento hipoteca",
  );
});

test("sugere pelo que o cartório já ensinou", () => {
  const learned = [
    {
      cue: "compra venda",
      kind: "R" as const,
      effect: "transmissao" as const,
      uses: 5,
    },
    {
      cue: "cancelamento hipoteca",
      kind: "AV" as const,
      effect: "cancelamento" as const,
      uses: 2,
    },
  ];
  assert.equal(suggestAct("COMPRA E VENDA", learned)?.kind, "R");
  assert.equal(
    suggestAct("Cancelamento da hipoteca cedular", learned)?.kind,
    "AV",
  );
  assert.equal(suggestAct("Usucapião", learned), null);
});
