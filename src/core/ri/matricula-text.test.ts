import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_AUX } from "./auxiliary.ts";
import { fichaContent } from "./ficha.ts";
import {
  coerceReading,
  firstDate,
  natureOf,
  readMatriculaText,
} from "./matricula-text.ts";
import { EMPTY_CONDO, EMPTY_RURAL, type PropertyInput } from "./property.ts";

// A fictitious matrícula, as an office types it in Word (LGPD).
const TEXT = `CARTÓRIO EXEMPLO
MATRÍCULA Nº 1.234 - Data: 05/03/1988
IMÓVEL: Uma propriedade rural denominada Sítio Boa Esperança, com a área de 12,5000 ha, CCIR 000.000.000.000-0.
PROPRIETÁRIO: ANA FICTÍCIA DE SOUZA, brasileira, CPF 111.444.777-35.
REGISTRO ANTERIOR: Transcrição 99, Livro 3-A.
R-1-1.234 - Em 10 de janeiro de 1990. Por escritura de compra e venda, a proprietária vendeu o imóvel. ADQUIRENTE: BRUNO FICTÍCIO, CPF 529.982.247-25. TRANSMITENTE: ANA FICTÍCIA DE SOUZA.
R-2-1.234 - Em 02/02/1995. Hipoteca em favor do CREDOR: BANCO EXEMPLO S.A., CNPJ 11.222.333/0001-81.
AV-3-1.234 - Em 03/03/2000. Cancelamento do R-2, por quitação.`;

test("lê a abertura e os lançamentos R/AV de uma matrícula em texto", () => {
  const r = readMatriculaText(TEXT);
  assert.equal(r.number, 1234);
  assert.equal(r.openedOn, "1988-03-05");
  assert.equal(r.location, 1);
  assert.equal(r.denomination, "Sítio Boa Esperança");
  assert.match(r.area, /12,5000 ha/);
  assert.match(r.origin, /Transcrição 99/);
  assert.deepEqual(
    r.acts.map((a) => `${a.kind}-${a.seq} ${a.effect}`),
    ["R-1 transmissao", "R-2 onus", "AV-3 cancelamento"],
  );
  assert.equal(r.acts[0]?.registeredOn, "1990-01-10");
  assert.equal(r.acts[2]?.cancelsSeq, 2);
  const buyer = r.acts[0]?.parties.find((p) => p.role === "adquirente");
  assert.equal(buyer?.name, "BRUNO FICTÍCIO");
  assert.equal(buyer?.document, "52998224725");
  assert.equal(r.owners[0]?.document, "11144477735");
});

test("datas escritas e natureza dos atos", () => {
  assert.equal(firstDate("em 5 de março de 1988"), "1988-03-05");
  assert.equal(
    natureOf("Averba-se a construção de uma casa")?.effect,
    "descricao",
  );
  assert.equal(natureOf("Alienação fiduciária em garantia")?.effect, "onus");
  assert.equal(natureOf("texto sem nada"), null);
});

test("a resposta do assistente é conferida campo a campo", () => {
  const r = coerceReading({
    number: "1.234",
    book: 2,
    acts: [
      { kind: "AV", seq: "3", effect: "invalido", parties: [{ name: "X" }] },
      { kind: "R", seq: -1 },
      {
        kind: "R",
        seq: 4,
        effect: "transmissao",
        registeredOn: "31/02/2020",
        parties: [
          {
            name: "Carla Fictícia",
            document: "390.533.447-05",
            role: "adquirente",
          },
        ],
      },
    ],
    notes: "Confira a área.",
  });
  assert.equal(r.number, 1234);
  assert.equal(r.acts.length, 2);
  assert.equal(r.acts[0]?.effect, "outro");
  assert.equal(r.acts[1]?.registeredOn, null);
  assert.equal(r.acts[1]?.parties[0]?.document, "39053344705");
  assert.deepEqual(r.notes, ["Confira a área."]);
});

const property: PropertyInput = {
  book: 2,
  number: 1234,
  recordKind: 1,
  status: 0,
  cnm: "1234562000123400",
  cnmInPgv: false,
  openedOn: "1988-03-05",
  origin: "Transcrição 99",
  ficha: "",
  location: 1,
  propertyKind: 9,
  streetKind: 177,
  street: "Sítio Exemplo",
  streetNumber: "",
  district: "Zona Rural",
  cep: "",
  complement: "",
  quadra: "",
  setor: "",
  conjunto: "",
  lote: "",
  loteamento: "",
  contributors: [],
  rural: { ...EMPTY_RURAL, denominacao: "Sítio Exemplo" },
  condo: { ...EMPTY_CONDO },
  area: "10 ha",
  auxKind: "",
  linkedNumbers: "",
  priorActs: 0,
  aux: { ...EMPTY_AUX, parties: [] },
  description: "",
  notes: "",
};

test("a ficha traz a abertura, os atos com selo e quem assina", () => {
  const ficha = fichaContent({
    office: { name: "Cartório Exemplo", city: "Cidade Exemplo", state: "RN" },
    property,
    acts: [
      {
        id: "m",
        seq: 0,
        kind: "M",
        effect: "titularidade",
        nature: "",
        registeredOn: null,
        summary: "",
        cancelsActId: null,
        parties: [
          {
            personId: "a",
            name: "Ana Fictícia",
            document: "11144477735",
            role: "titular",
            share: "",
          },
        ],
      },
      {
        id: "r1",
        seq: 1,
        kind: "R",
        effect: "transmissao",
        nature: "Compra e venda",
        registeredOn: "1990-01-10",
        summary: "",
        cancelsActId: null,
        seal: "SELO-FICTICIO",
        parties: [
          {
            personId: "b",
            name: "Bruno Fictício",
            document: "",
            role: "adquirente",
            share: "",
          },
        ],
      },
    ],
    signer: { name: "Oficial Fictício", title: "Oficial de Registro" },
  });
  assert.equal(ficha.cnm, "123456.2.0001234-00");
  assert.equal(ficha.blocks[0]?.label, "Abertura");
  assert.match(ficha.blocks[0]?.text ?? "", /Sítio Exemplo/);
  assert.match(
    ficha.blocks[0]?.text ?? "",
    /Proprietário\(s\): Ana Fictícia, CPF 111\.444\.777-35/,
  );
  assert.equal(ficha.blocks[1]?.label, "R-1-1.234");
  assert.match(ficha.blocks[1]?.meta ?? "", /Selo SELO-FICTICIO/);
  assert.match(ficha.blocks[1]?.text ?? "", /Adquirente: Bruno Fictício/);
});
