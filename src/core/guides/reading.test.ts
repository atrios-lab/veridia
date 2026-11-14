import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fillGuide,
  mergeReadings,
  readGuideText,
  readSomething,
} from "./reading.ts";
import { emptyParty, type Guide } from "./schema.ts";

// Fictitious documents only (LGPD); the CPFs are the classic test numbers.
const MATRICULA = `REGISTRO DE IMÓVEIS REGISTRO GERAL MATRÍCULA Nº 1.234
IMÓVEL URBANO: Um terreno situado na Rua Fictícia, nº 10, Bairro Exemplo,
com área de 300,00 m². INSCRIÇÃO IMOBILIÁRIA: 01.02.003.0004.001
NOME, DOMICÍLIO E NACIONALIDADE DOS PROPRIETÁRIOS ATUAIS: MARIA EXEMPLO
DA SILVA, brasileira, casada, professora, inscrita no CPF sob nº 529.982.247-25,
residente e domiciliada na Rua Fictícia, nº 10, Cidade Exemplo/RN;
REGISTRO ANTERIOR: matrícula 99.`;

const ESCRITURA = `OUTORGANTES VENDEDORES: JOÃO FICTÍCIO SOUZA, brasileiro, solteiro,
agricultor, portador do RG nº 1234, inscrito no CPF nº 111.444.777-35, residente
e domiciliado no Sítio Exemplo, zona rural; OUTORGADA COMPRADORA: EMPRESA
EXEMPLO LTDA, inscrita no CNPJ sob nº 11.222.333/0001-81, com sede na Avenida
Teste, 100; pelo preço certo e ajustado de R$ 150.000,00 (cento e cinquenta mil reais).`;

test("matrícula: número, imóvel, inscrição e o proprietário como transmitente", () => {
  const reading = readGuideText(MATRICULA);
  assert.equal(reading.property.registration, "1.234");
  assert.equal(reading.property.type, "urbano");
  assert.equal(reading.property.fiscalRegistration, "01.02.003.0004.001");
  assert.match(reading.property.description ?? "", /^Um terreno situado/);
  const [owner] = reading.parties;
  assert.equal(owner?.name, "MARIA EXEMPLO DA SILVA");
  assert.equal(owner?.taxId, "529.982.247-25");
  assert.equal(owner?.role, "transmitente");
  assert.equal(owner?.gender, "feminino");
  assert.equal(owner?.civilStatus, "casado");
  assert.equal(owner?.profession, "professora");
  assert.match(owner?.address ?? "", /^Rua Fictícia, nº 10/);
});

test("escritura: vendedor e compradora, CNPJ e o preço", () => {
  const reading = readGuideText(ESCRITURA);
  assert.deepEqual(
    reading.parties.map((p) => [p.name, p.role]),
    [
      ["JOÃO FICTÍCIO SOUZA", "transmitente"],
      ["EMPRESA EXEMPLO LTDA", "adquirente"],
    ],
  );
  assert.equal(reading.parties[0]?.gender, "masculino");
  assert.equal(reading.parties[1]?.taxId, "11.222.333/0001-81");
  assert.equal(reading.declaredValueCents, 15_000_000);
});

test("CPF inválido não entra; nada lido é nada preenchido", () => {
  const reading = readGuideText(
    "FULANO DE TAL, brasileiro, CPF 123.456.789-00",
  );
  assert.equal(reading.parties.length, 0);
  assert.equal(readSomething(readGuideText("texto sem dados")), false);
});

test("vários documentos: o primeiro valor achado fica, sem repetir pessoa", () => {
  const merged = mergeReadings([
    readGuideText(MATRICULA),
    readGuideText(ESCRITURA),
    readGuideText(MATRICULA),
  ]);
  assert.equal(merged.parties.length, 3);
  assert.equal(merged.property.registration, "1.234");
  assert.equal(merged.declaredValueCents, 15_000_000);
});

test("guia do painel: preenche só o que está em branco", () => {
  const base = {
    kind: "itiv",
    parties: [emptyParty("transmitente"), emptyParty("adquirente")],
    property: {
      type: "urbano",
      description: "",
      fiscalRegistration: "digitado à mão",
      registration: "",
    },
    declaredValueCents: 0,
  } as unknown as Guide;
  const guide = fillGuide(
    base,
    mergeReadings([readGuideText(MATRICULA), readGuideText(ESCRITURA)]),
  );
  assert.equal(guide.property.fiscalRegistration, "digitado à mão");
  assert.equal(guide.property.registration, "1.234");
  assert.equal(guide.declaredValueCents, 15_000_000);
  assert.equal(guide.parties[0]?.name, "MARIA EXEMPLO DA SILVA");
  assert.equal(guide.parties[1]?.name, "EMPRESA EXEMPLO LTDA");
  assert.equal(guide.parties[1]?.personType, "juridica");
  assert.equal(guide.parties.length, 3);
});
