import assert from "node:assert/strict";
import { test } from "node:test";
import type { Act } from "./acts.ts";
import { EMPTY_AUX } from "./auxiliary.ts";
import { EMPTY_CONDO, EMPTY_RURAL, type PropertyInput } from "./property.ts";
import {
  actTable,
  centsOf,
  fillEmpty,
  objectsOf,
  propertyTable,
  readParties,
  tableKind,
  transferFromJson,
  transferFromTable,
  transferFromXml,
} from "./transfer.ts";

// Fictitious data only (LGPD).
const property: PropertyInput = {
  book: 2,
  number: 1234,
  recordKind: 1,
  status: 0,
  cnm: "1234562000123400",
  cnmInPgv: true,
  openedOn: "1988-03-05",
  origin: "Transcrição 99",
  ficha: "1",
  location: 1,
  propertyKind: 9,
  streetKind: 177,
  street: "Sítio Exemplo",
  streetNumber: "",
  district: "Zona Rural",
  cep: "59000000",
  complement: "",
  quadra: "",
  setor: "",
  conjunto: "",
  lote: "",
  loteamento: "",
  contributors: ["123", "456"],
  rural: { ...EMPTY_RURAL, denominacao: "Sítio Exemplo", ccir: "000.111" },
  condo: { ...EMPTY_CONDO },
  area: "10 ha",
  auxKind: "",
  linkedNumbers: "",
  priorActs: 2,
  aux: { ...EMPTY_AUX, parties: [] },
  description: "Um imóvel fictício.",
  notes: "",
};

const acts: Act[] = [
  {
    id: "a1",
    seq: 3,
    kind: "R",
    effect: "onus",
    nature: "Hipoteca",
    registeredOn: "2020-02-02",
    summary: "Hipoteca em favor do credor.",
    cancelsActId: null,
    protocol: "10",
    seal: "SELO-FICTICIO-1",
    valueCents: 12345678,
    parties: [
      {
        personId: "p1",
        name: "BANCO EXEMPLO S.A.",
        document: "11222333000181",
        role: "credor",
        share: "",
      },
      {
        personId: "p2",
        name: "ANA FICTÍCIA",
        document: "11144477735",
        role: "devedor",
        share: "",
      },
    ],
  },
  {
    id: "a2",
    seq: 4,
    kind: "AV",
    effect: "cancelamento",
    nature: "Cancelamento",
    registeredOn: "2021-03-03",
    summary: "Cancela o R-3.",
    cancelsActId: "a1",
    parties: [],
  },
];

test("matrículas: o que sai volta igual, com todos os campos", () => {
  const table = propertyTable([
    {
      ...property,
      owners: [
        { name: "ANA FICTÍCIA", document: "11144477735" },
        { name: "BRUNO FICTÍCIO", document: "" },
      ],
    },
  ]);
  assert.equal(tableKind(table[0] ?? []), "matriculas");
  const back = transferFromTable(table, "Planilha .xlsx");
  assert.equal(back.errors.length, 0);
  const row = back.properties[0];
  assert.deepEqual(row?.input, property);
  assert.deepEqual(row?.owners, [
    { name: "ANA FICTÍCIA", document: "11144477735" },
    { name: "BRUNO FICTÍCIO", document: "" },
  ]);
});

test("atos: numeração, partes, selo, valor e cancelamento voltam iguais", () => {
  const table = actTable([{ property, acts }]);
  assert.equal(
    table[1]?.[12],
    "Credor: BANCO EXEMPLO S.A. | 11222333000181\nDevedor: ANA FICTÍCIA | 11144477735",
  );
  assert.equal(table[2]?.[11], "3");
  const back = transferFromTable(table, "Planilha .csv");
  assert.equal(back.acts.length, 2);
  const [r3, av4] = back.acts;
  assert.equal(r3?.seq, 3);
  assert.equal(r3?.effect, "onus");
  assert.equal(r3?.valueCents, 12345678);
  assert.equal(r3?.seal, "SELO-FICTICIO-1");
  assert.equal(r3?.registeredOn, "2020-02-02");
  assert.deepEqual(
    r3?.parties.map((p) => `${p.role}:${p.document}`),
    ["credor:11222333000181", "devedor:11144477735"],
  );
  assert.equal(av4?.cancelsSeq, 3);
  assert.equal(av4?.effect, "cancelamento");
});

test("partes escritas à mão numa célula e valores em reais", () => {
  assert.deepEqual(
    readParties(
      "Comprador: Carla Fictícia | 390.533.447-05 | 50%; Vendedor: Davi Fictício",
    ),
    [
      {
        name: "Carla Fictícia",
        document: "39053344705",
        role: "adquirente",
        share: "50%",
      },
      { name: "Davi Fictício", document: "", role: "transmitente", share: "" },
    ],
  );
  assert.equal(centsOf("R$ 1.234,56"), 123456);
  assert.equal(centsOf("1234.5"), 123450);
  assert.equal(centsOf(""), null);
});

test("JSON do sistema e lista de objetos voltam pelas mesmas regras", () => {
  const table = actTable([{ property, acts }]);
  const json = {
    formato: "veridia-registro-de-imoveis",
    tipo: "atos",
    linhas: objectsOf(table),
  };
  assert.equal(transferFromJson(json).acts.length, 2);
  assert.equal(transferFromJson(objectsOf(table)).acts.length, 2);
  assert.match(
    transferFromJson({ x: 1 }).errors[0]?.message ?? "",
    /não é do sistema/,
  );
});

test("Indicador Real da ONR (JSON v1.5) vira matrícula", () => {
  const t = transferFromJson({
    INDICADOR_REAL: {
      CNS: "000000",
      REAL: [
        {
          TIPOENVIO: 0,
          NUMERO_REGISTRO: "77",
          REGISTRO_TIPO: 1,
          TIPO_DE_IMOVEL: 1,
          LOCALIZACAO: 0,
          TIPO_LOGRADOURO: 250,
          NOME_LOGRADOURO: "das Flores",
          NUMERO_LOGRADOURO: "10",
          BAIRRO: "Centro",
          CEP: "59000-000",
          CONTRIBUINTE: ["999"],
          RURAL: {},
          CONDOMINIO: { APTO: "101" },
        },
      ],
    },
  });
  const input = t.properties[0]?.input;
  assert.equal(input?.number, 77);
  assert.equal(input?.streetKind, 250);
  assert.equal(input?.cep, "59000000");
  assert.deepEqual(input?.contributors, ["999"]);
  assert.equal(input?.condo.apto, "101");
});

test("XML do Banco Light e do lote de CNM", () => {
  const bdl = transferFromXml(
    '<?xml version="1.0" encoding="iso-8859-1"?><BANCOLIGHT><INDIVIDUO><NOME><![CDATA[ANA FICTÍCIA]]></NOME><CNPJCPF>11144477735</CNPJCPF><NMATRICULA>1234</NMATRICULA><TIPODEATO>COMPRA</TIPODEATO><DTREGAVERB>05031988</DTREGAVERB><DTVENDA></DTVENDA></INDIVIDUO><INDIVIDUO><NOME>ANA FICTÍCIA</NOME><CNPJCPF>11144477735</CNPJCPF><NMATRICULA>1300</NMATRICULA><TIPODEATO>DEVEDOR</TIPODEATO><DTREGAVERB>01012000</DTREGAVERB><DTVENDA></DTVENDA></INDIVIDUO></BANCOLIGHT>',
  );
  assert.equal(bdl.people.length, 1);
  assert.match(bdl.people[0]?.where ?? "", /1234.*1300/);
  const lote = transferFromXml(
    "<LOTE><REGISTRO><SEQ>1</SEQ><TIPO>I</TIPO><LIVRO>2</LIVRO><NUM>12</NUM><CNM>123456.2.0000012-91</CNM><SITUACAO>0</SITUACAO></REGISTRO></LOTE>",
  );
  assert.equal(lote.properties[0]?.input.number, 12);
  assert.equal(lote.properties[0]?.input.cnm, "1234562000001291");
});

test("o índice antigo da serventia continua sendo lido", () => {
  const t = transferFromTable(
    [
      ["Matrícula", "Proprietários", "CPF/CNPJ", "Situação"],
      ["1.500", "Eva Fictícia", "111.444.777-35", "Ativa"],
    ],
    "Planilha .csv",
  );
  assert.match(t.format, /índice/);
  assert.equal(t.properties[0]?.input.number, 1500);
});

test("completar só preenche o que está vazio", () => {
  const current = {
    ...property,
    cnm: "",
    area: "5 ha",
    rural: { ...property.rural, car: "" },
  };
  const incoming = {
    ...property,
    cnm: "999",
    area: "99 ha",
    rural: { ...property.rural, car: "RN-0000" },
  };
  const { input, fields } = fillEmpty(current, incoming);
  assert.equal(input.cnm, "999");
  assert.equal(input.area, "5 ha");
  assert.equal(input.rural.car, "RN-0000");
  assert.deepEqual(fields.sort(), ["CNM", "car"]);
});
