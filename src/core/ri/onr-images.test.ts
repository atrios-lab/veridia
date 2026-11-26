import assert from "node:assert/strict";
import { test } from "node:test";
import {
  confer,
  numberInName,
  numberInText,
  onrPath,
  signaturePlace,
} from "./onr-images.ts";

test("the folders and names of the manual (item 2)", () => {
  assert.equal(onrPath(1), "00000000/00000001.TIF");
  assert.equal(onrPath(999), "00000000/00000999.TIF");
  assert.equal(onrPath(1000), "00000001/00001000.TIF");
  assert.equal(onrPath(1234), "00000001/00001234.TIF");
  assert.equal(onrPath(20000), "00000020/00020000.TIF");
  assert.equal(onrPath(1234, "p3"), "00001000/00001234.TIF");
  assert.equal(onrPath(1234, "p13"), "00001/00001234.TIF");
});

test("the number from the text and the file name", () => {
  assert.equal(
    numberInText("REGISTRO GERAL\nMATRÍCULA Nº 1.234\nFicha 1"),
    1234,
  );
  assert.equal(numberInText("Matrícula n. 57 - CNM"), 57);
  assert.equal(numberInText("sem número"), null);
  assert.equal(numberInName("matricula 12.pdf"), 12);
  assert.equal(numberInName("00000005.docx"), 5);
});

test("the conferência points out what does not agree", () => {
  const ok = confer({
    typed: null,
    name: "mat-5.pdf",
    text: "MATRÍCULA Nº 5",
    acervo: { number: 5, cnm: "" },
    textOk: true,
  });
  assert.deepEqual(ok, { number: 5, issues: [] });
  const wrong = confer({
    typed: 6,
    name: "mat-5.pdf",
    text: "MATRÍCULA Nº 5",
    acervo: null,
    textOk: true,
  });
  assert.equal(wrong.number, 6);
  assert.equal(wrong.issues.length, 2);
});

test("the signature right under the last line, never over the footer", () => {
  const lines = [
    { top: 100, bottom: 112, text: "R-1-5. Compra e venda" },
    { top: 600, bottom: 612, text: "Oficial" },
    { top: 800, bottom: 810, text: "Rodapé do cartório" },
  ];
  assert.deepEqual(signaturePlace(lines, 842, 60), { top: 620 });
  assert.equal(signaturePlace(lines, 842, 200), null);
});
