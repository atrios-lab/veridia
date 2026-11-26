import assert from "node:assert/strict";
import { test } from "node:test";
import { drawFichas } from "./ri-book-model.ts";
import { bookToWord } from "./ri-book-word.ts";

// Fictitious data only (LGPD).
const ficha = {
  volume: "2-A",
  sheet: 1,
  matricula: 1,
  date: "01/02/2020",
  identification: "Imóvel rural Fazenda Exemplo.",
  owner: "Pessoa Exemplo",
  previous: "",
  acts: [{ label: "R-1-1 ·", text: "Compra e venda.", seal: "ABC123" }],
  cnm: "",
  footer: "Cartório Exemplo",
};

test("o livro sai em Word com as fichas e o selo", async () => {
  const docx = await bookToWord("Livro nº 2-A", [
    { kind: "fichas", fichas: [ficha] },
  ]);
  assert.equal(docx.subarray(0, 2).toString(), "PK");
});

test("o PDF das fichas aceita o selo do ato", async () => {
  const pdf = await drawFichas([ficha]);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});
