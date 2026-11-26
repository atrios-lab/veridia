import assert from "node:assert/strict";
import { test } from "node:test";
import type { Situation } from "./acts.ts";
import { answerQuestion, certidaoSections } from "./certidao.ts";
import type { FichaContent } from "./ficha.ts";

// Fictitious data only (LGPD).
const ficha: FichaContent = {
  office: "Cartório Exemplo",
  book: "Livro 2",
  title: "Matrícula nº 001",
  cnm: "",
  blocks: [
    {
      label: "Abertura",
      meta: "",
      text: "Imóvel rural Fazenda Exemplo, com 10 ha.",
    },
    {
      label: "R-1",
      meta: "01/02/2020",
      text: "Compra e venda a Pessoa Exemplo.",
    },
    {
      label: "R-2",
      meta: "01/03/2021",
      text: "Hipoteca ao Banco Exemplo S/A.",
    },
  ],
  signer: null,
  place: "Cidade Exemplo/RN",
};
const free: Situation = {
  owners: [
    {
      personId: "p",
      name: "Pessoa Exemplo",
      document: "",
      share: "",
      since: "R-1",
    },
  ],
  burdens: [],
  cancelledBurdens: [],
  closed: false,
  lastAct: "R-1 Compra e venda",
};
const base = {
  place: "Cidade Exemplo/RN",
  dateText: "26 de novembro de 2026",
  ficha,
};

test("ônus: livre e desembaraçado quando não há ônus", () => {
  const text = certidaoSections({ ...base, kind: "onus", situation: free })
    .flatMap((s) => s.paragraphs)
    .join(" ");
  assert.match(text, /livre e desembaraçada/);
  assert.match(text, /dou fé/);
});

test("inteiro teor reproduz todos os atos", () => {
  const text = certidaoSections({ ...base, kind: "inteiro-teor" })
    .flatMap((s) => s.paragraphs)
    .join(" ");
  assert.match(text, /R-2/);
});

test("quesitos são respondidos pelo que consta na matrícula", () => {
  assert.match(answerQuestion("Existe hipoteca?", ficha), /Hipoteca/);
  assert.match(
    answerQuestion("Quem é o proprietário?", ficha, free),
    /Pessoa Exemplo/,
  );
  assert.match(answerQuestion("Há usufruto?", ficha), /Nada consta/);
});

test("negativa cita o nome pesquisado", () => {
  const text = certidaoSections({
    ...base,
    kind: "negativa",
    searched: { name: "Fulano Exemplo", document: "000.000.000-00" },
  })
    .flatMap((s) => s.paragraphs)
    .join(" ");
  assert.match(text, /NÃO ENCONTREI.*Fulano Exemplo/);
});
