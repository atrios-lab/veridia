import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type BookRecord,
  batches,
  closingTerm,
  feminineInWords,
  nextVolume,
  openingTerm,
  periodRange,
  protocolDay,
  readItem,
  volumeLabel,
  volumeLetters,
  volumeOfNumber,
} from "./books.ts";

const office = {
  name: "Cartório Exemplo de Registro de Imóveis",
  cns: "00.000-0",
  city: "Cidade Exemplo",
  state: "RN",
};

const record = (patch: Partial<BookRecord> = {}): BookRecord => ({
  book: 2,
  volume: "2-A",
  form: "folhas",
  sheetCount: 300,
  firstItem: 1001,
  lastItem: 1300,
  openedOn: "2026-11-26",
  closedOn: null,
  lastSheet: null,
  openingNotes: "",
  closingNotes: "",
  ...patch,
});

test("the letters of art. 6º: A to Z, then AA, AB and on", () => {
  assert.equal(volumeLetters(0), "");
  assert.equal(volumeLetters(1), "A");
  assert.equal(volumeLetters(26), "Z");
  assert.equal(volumeLetters(27), "AA");
  assert.equal(volumeLetters(52), "AZ");
  assert.equal(volumeLetters(53), "BA");
  assert.equal(volumeLabel(2, 0), "2");
  assert.equal(volumeLabel(3, 2), "3-B");
  assert.equal(nextVolume(2, []), "2");
  assert.equal(nextVolume(2, ["2", "2-a"]), "2-B");
});

test("folhas are counted in the feminine", () => {
  assert.equal(feminineInWords(300), "trezentas");
  assert.equal(feminineInWords(201), "duzentas e uma");
  assert.equal(feminineInWords(2), "duas");
  assert.equal(feminineInWords(101), "cento e uma");
});

test("the termo de abertura names the book, its size and art. 4º", () => {
  const t = openingTerm(record(), office);
  const text = JSON.stringify(t);
  assert.equal(t.title, "Termo de abertura");
  assert.match(text, /volume 2-A/);
  assert.match(text, /300 \(trezentas\) folhas/);
  assert.match(text, /numeradas e autenticadas/);
  assert.match(text, /art\. 4º/);
  assert.match(text, /arts\. 173, II, e 176/);
  assert.match(t.dateLine, /26 de novembro de 2026/);
});

test("an electronic book says arts. 3º to 7º do not apply (art. 7º-A)", () => {
  const t = openingTerm(
    record({ form: "eletronico", sheetCount: 0, volume: "2" }),
    office,
  );
  const text = JSON.stringify(t);
  assert.match(text, /meio eletrônico/);
  assert.match(text, /7º-A/);
  assert.doesNotMatch(text, /volume 2[,.]/);
});

test("the termo de encerramento says until where it was written", () => {
  const t = closingTerm(
    record({ closedOn: "2027-03-01", lastSheet: 298, form: "fichas" }),
    office,
  );
  const text = JSON.stringify(t);
  assert.equal(t.title, "Termo de encerramento");
  assert.match(text, /até a ficha nº 298/);
  assert.match(text, /art\. 6º/);
  assert.match(t.dateLine, /1 de março de 2027/);
});

test("the Protocolo of the day closes with its first and last número", () => {
  const sections = protocolDay("2026-11-26", [
    {
      number: 12,
      presentedOn: "2026-11-26",
      presenter: "Fulano de Tal",
      titleKind: "Escritura pública de compra e venda",
      acts: "registro da compra e venda",
      voided: false,
    },
    {
      number: 11,
      presentedOn: "2026-11-26",
      presenter: "Beltrana Exemplo",
      titleKind: "Instrumento particular",
      acts: "averbação de construção",
      voided: false,
    },
    {
      number: 13,
      presentedOn: "2026-11-26",
      presenter: "Sicrano",
      titleKind: "Cédula rural",
      acts: "",
      voided: true,
    },
  ]);
  const text = JSON.stringify(sections);
  assert.equal(sections[0]?.rows?.[0]?.label, "Nº 11");
  assert.match(text, /LANÇADO POR ENGANO/);
  assert.match(text, /2 \(dois\) títulos apontados, do nº 11 ao nº 12/);
  assert.match(text, /art\. 184/);
  const empty = JSON.stringify(protocolDay("2026-11-27", []));
  assert.match(empty, /sem apresentação de títulos/);
});

test("items and batches", () => {
  assert.equal(readItem("1.234"), 1234);
  assert.equal(readItem(""), null);
  assert.deepEqual(
    batches([1, 2, 3, 4, 5], 2).map((b) => b.length),
    [2, 2, 1],
  );
});

test("Livro 1: a letra do volume de cada número", () => {
  const volumes = [
    { volume: "1", firstItem: 50, lastItem: 1688 },
    { volume: "1-B", firstItem: 1689, lastItem: null },
  ];
  assert.equal(volumeOfNumber(50, volumes), "1");
  assert.equal(volumeOfNumber(1688, volumes), "1");
  assert.equal(volumeOfNumber(2694, volumes), "1-B");
  assert.equal(volumeOfNumber(10, volumes), null);
});

test("Livro 1: impressão diária, mensal, semestral e anual", () => {
  assert.deepEqual(periodRange("dia", "2026-11-27", "", 0, 1), {
    from: "2026-11-27",
    to: "2026-11-27",
  });
  assert.deepEqual(periodRange("mes", "", "2024-02", 0, 1), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(periodRange("semestre", "", "", 2025, 2), {
    from: "2025-07-01",
    to: "2025-12-31",
  });
  assert.deepEqual(periodRange("ano", "", "", 2025, 1), {
    from: "2025-01-01",
    to: "2025-12-31",
  });
  assert.equal(periodRange("mes", "", "x", 0, 1), null);
});
