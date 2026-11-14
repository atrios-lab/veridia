import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { readTitleFile } from "./titularidade-reading.ts";

// A fictitious escritura (LGPD): names and CPFs made up; the CPFs pass
// the check digits.
const TEXT = [
  "ESCRITURA PÚBLICA DE COMPRA E VENDA",
  "Livro 12, folhas 34/35.",
  "Aos dez dias do mês de outubro do ano de dois mil e vinte e seis, nesta cidade, compareceram as partes:",
  "como VENDEDORA, MARIA FICTÍCIA DA SILVA, brasileira, solteira, professora, CPF 529.982.247-25, residente e domiciliada na Rua A, 1;",
  "e como COMPRADOR, JOÃO MODELO DE SOUZA, brasileiro, solteiro, agricultor, CPF 111.444.777-35, residente e domiciliado na Rua B, 2.",
  "IMÓVEL URBANO: uma casa residencial situada na Rua das Flores Fictícias, nº 10, Centro, com área de 200 m², matrícula nº 1.234, inscrição imobiliária 01.02.003.0004.",
  "Pelo preço de R$ 150.000,00. Base de cálculo do ITBI: R$ 120.000,00.",
];

async function docx(paragraphs: string[]): Promise<File> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`)
      .join("")}</w:body></w:document>`,
  );
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  return new File([bytes], "escritura.docx");
}

test("lê a escritura em Word e preenche a comunicação", async () => {
  const {
    transfer: t,
    read,
    note,
  } = await readTitleFile(await docx(TEXT), "notas");
  assert.ok(read, note);
  assert.equal(t.service, "notas");
  assert.equal(t.act, "escritura");
  assert.equal(t.operation, "11");
  assert.equal(t.actDate, "2026-10-10");
  assert.equal(t.book, "12");
  assert.equal(t.page, "34/35");
  assert.equal(t.destination, "urbano");
  assert.equal(t.matricula, "1.234");
  assert.equal(t.fiscalRegistration, "01.02.003.0004");
  assert.equal(t.valueCents, 15000000);
  assert.equal(t.taxBaseCents, 12000000);
  assert.deepEqual(
    t.transmitentes.map((p) => p.name),
    ["MARIA FICTÍCIA DA SILVA"],
  );
  assert.deepEqual(
    t.adquirentes.map((p) => p.taxId),
    ["111.444.777-35"],
  );
});

test("foto ou arquivo sem texto: diz o que fazer", async () => {
  const photo = new File(
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
    "foto.jpg",
  );
  const { read, note } = await readTitleFile(photo, "ri");
  assert.equal(read, false);
  assert.match(note, /PDF pesquisável ou em Word/);
});
