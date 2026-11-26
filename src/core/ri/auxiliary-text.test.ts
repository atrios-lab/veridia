import assert from "node:assert/strict";
import { test } from "node:test";
import { readAuxText, toMarkdown } from "./auxiliary-text.ts";

// A fictitious registro, in the shape of the models (LGPD: no real data).
const TEXT = `REGISTRO AUXILIAR Nº 70
TÍTULO: CÉDULA RURAL PIGNORATÍCIA Nº 001/2026, emitida em 01/07/2026.
EMITENTE: ANA FICTÍCIA, CPF nº 111.444.777-35, brasileira, agricultora.
CREDOR: BANCO EXEMPLO S.A., inscrito no CNPJ nº 11.222.333/0001-81, ou a sua ordem.
AVALISTA: BRUNO FICTÍCIO, CPF nº 529.982.247-25.
VALOR: R$12.500,00 (doze mil e quinhentos reais).
VENCIMENTO: Em 30/06/2027, nos termos da cláusula "Forma de Pagamento".
PRAÇA DE PAGAMENTO: Cidade Exemplo-RN.
GARANTIAS: EM PENHOR CEDULAR DE PRIMEIRO (1º) GRAU, 20 bovinos fictícios,
localizados no imóvel objeto da Matrícula nº 1.234 deste Serviço.
PROTOCOLO: Título apontado sob nº 345, em 10/07/2026.`;

test("lê o registro do Livro 3 pelos rótulos do modelo", () => {
  const r = readAuxText(TEXT);
  assert.equal(r.number, 70);
  assert.equal(r.auxKind, "Contrato de penhor rural");
  assert.equal(r.aux.title, "CÉDULA RURAL PIGNORATÍCIA Nº 001/2026");
  assert.equal(r.aux.issuedOn, "2026-07-01");
  assert.equal(r.aux.valueCents, 1250000);
  assert.equal(r.aux.dueOn, "2027-06-30");
  assert.equal(r.aux.paymentPlace, "Cidade Exemplo-RN.");
  assert.match(r.aux.guarantees, /20 bovinos fictícios,\nlocalizados/);
  assert.equal(r.aux.protocolNumber, "345");
  assert.equal(r.aux.protocolOn, "2026-07-10");
  assert.equal(r.openedOn, "2026-07-10");
  assert.deepEqual(
    r.aux.parties.map((p) => `${p.role}:${p.name}:${p.document}`),
    [
      "emitente:ANA FICTÍCIA:11144477735",
      "credor:BANCO EXEMPLO S.A.:11222333000181",
      "avalista:BRUNO FICTÍCIO:52998224725",
    ],
  );
  assert.equal(r.linkedNumbers, "1.234");
});

test("cédula com hipoteca avisa que a hipoteca vai na matrícula", () => {
  const r = readAuxText(
    "TÍTULO: CÉDULA RURAL PIGNORATÍCIA E HIPOTECÁRIA Nº 9\nGARANTIAS: em hipoteca cedular, o imóvel da matrícula 77.",
  );
  assert.ok(r.notes.some((n) => /Livro 2/.test(n)));
  assert.equal(readAuxText("texto sem nada").auxKind, "");
});

test("o documento vira Markdown com os rótulos em negrito", () => {
  const md = toMarkdown(TEXT, "registro-70");
  assert.ok(md.startsWith("# registro-70\n\n"));
  assert.match(md, /\*\*TÍTULO:\*\* CÉDULA RURAL/);
  assert.match(md, /\*\*VALOR:\*\* R\$12\.500,00/);
});
