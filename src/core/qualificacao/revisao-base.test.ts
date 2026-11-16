import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_SUSPENDED,
  aiPlatformFrom,
  articleCitations,
  baseSummary,
  learnWithoutAi,
  maskNames,
  noteItems,
  platformChange,
  scopeTargets,
  unfoundedItems,
} from "./revisao-base.ts";

// Fictitious notes and people only.
const NOTE = `NOTA DEVOLUTIVA Nº 05/2026
Protocolo 123
1. Apresentar a certidão de ônus reais atualizada (Lei nº 6.015/1973, art. 225).
2. Juntar o CCIR do exercício atual, conforme o Decreto nº 4.449/2002, art. 9º.
3. Corrigir o nome de João Pedro Alves na escritura (Lei nº 6.015/1973, art. 176).
4. Recolher as custas do registro.`;

test("a nota se divide nas suas exigências numeradas", () => {
  const items = noteItems(NOTE);
  assert.equal(items.length, 4);
  assert.match(items[1]?.text ?? "", /^Juntar o CCIR/);
  assert.equal(
    noteItems("Apresentar a certidão atualizada do imóvel.").length,
    1,
  );
});

test("exigência sem fundamento é apontada pela base, sem IA", () => {
  const found = unfoundedItems(noteItems(NOTE));
  assert.equal(found.length, 1);
  assert.equal(found[0]?.kind, "sem-fundamento");
  assert.match(found[0]?.excerpt ?? "", /Recolher as custas/);
  assert.equal(found[0]?.basis, "Lei nº 6.015/1973, art. 198");
});

test("cada artigo citado vem com a norma da mesma exigência", () => {
  const citations = articleCitations(noteItems(NOTE));
  assert.deepEqual(
    citations.map((c) => `${c.norm.number}/${c.norm.year} art. ${c.article}`),
    ["6015/1973 art. 225", "4449/2002 art. 9", "6015/1973 art. 176"],
  );
});

test("nomes de pessoas saem; termos do ofício ficam", () => {
  assert.equal(
    maskNames(
      "Apresentar certidão de casamento de Maria José da Silva, atualizada.",
    ),
    "Apresentar certidão de casamento de [NOME] atualizada.",
  );
  assert.equal(
    maskNames("Apresentar a Certidão de Inteiro Teor da matrícula."),
    "Apresentar a Certidão de Inteiro Teor da matrícula.",
  );
});

test("aprende sem IA só a exigência com fundamento e sem nome de pessoa", () => {
  const learned = learnWithoutAi(NOTE);
  assert.deepEqual(
    learned.map((l) => [l.title, l.basis]),
    [
      [
        "Apresentar a certidão de ônus reais atualizada",
        "Lei nº 6.015/1973, art. 225",
      ],
      ["Juntar o CCIR do exercício atual", "Decreto nº 4.449/2002, art. 9º"],
    ],
  );
  assert.ok(
    learned.every((l) => !/João|Pedro|Alves/.test(Object.values(l).join(" "))),
  );
});

test("o resumo da base diz que foi sem IA e o que falta na base", () => {
  assert.match(baseSummary([], []), /sem IA: nada a apontar/);
  assert.match(
    baseSummary([], ["Decreto nº 4.449/2002"]),
    /ainda não tem Decreto nº 4\.449\/2002/,
  );
});

test("sem decisão da plataforma, tudo fica como foi entregue", () => {
  assert.deepEqual(aiPlatformFrom(undefined), {
    aiAllowed: true,
    noteReview: "ia",
  });
  assert.equal(
    aiPlatformFrom({ aiAllowed: false, noteReview: "base" }).noteReview,
    "base",
  );
  assert.deepEqual(aiPlatformFrom({ noteReview: "outra" }), {
    aiAllowed: true,
    noteReview: "ia",
  });
  assert.doesNotMatch(AI_SUSPENDED, /Átrios/);
});

test("a quem aplicar: esta serventia, todas ou as escolhidas", () => {
  const all = ["a", "b", "c"];
  assert.deepEqual(scopeTargets("todas", { all, chosen: [] }), {
    targets: ["a", "b", "c"],
  });
  assert.deepEqual(scopeTargets("esta", { current: "b", all, chosen: [] }), {
    targets: ["b"],
  });
  assert.ok("error" in scopeTargets("esta", { all, chosen: [] }));
  assert.deepEqual(
    scopeTargets("escolher", { all, chosen: ["c", "x", "c", "a"] }),
    { targets: ["c", "a"] },
  );
  assert.ok("error" in scopeTargets("escolher", { all, chosen: ["x"] }));
});

test("o que alterar: só o marcado muda", () => {
  assert.deepEqual(
    platformChange({
      changeAi: true,
      ai: "suspensa",
      changeNotes: false,
      notes: "",
    }),
    { change: { aiAllowed: false } },
  );
  assert.deepEqual(
    platformChange({
      changeAi: false,
      ai: "",
      changeNotes: true,
      notes: "desligada",
    }),
    { change: { noteReview: "desligada" } },
  );
  assert.ok(
    "error" in
      platformChange({
        changeAi: false,
        ai: "",
        changeNotes: false,
        notes: "",
      }),
  );
  assert.ok(
    "error" in
      platformChange({
        changeAi: false,
        ai: "",
        changeNotes: true,
        notes: "outra",
      }),
  );
});
