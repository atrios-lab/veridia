import assert from "node:assert/strict";
import { test } from "node:test";
import { type Act, actLabel, nextSeq, situationOf } from "./acts.ts";
import {
  cnmCheckDigits,
  cnmOf,
  cnmProblems,
  formatCnm,
  parseCnm,
} from "./cnm.ts";
import { STREET_KINDS, streetKindOf } from "./codes.ts";
import {
  bdlDate,
  cnmBatch,
  type ExportProperty,
  indicadorPessoal,
  indicadorReal,
  latin1,
} from "./onr.ts";
import { pendenciesOf, ranges } from "./pendencies.ts";
import { EMPTY_CONDO, EMPTY_RURAL, isoDate, readProperty } from "./property.ts";
import {
  parseCsv,
  readSheet,
  splitDocuments,
  splitNames,
  statusOf,
} from "./sheet.ts";

// Fictitious people and imóveis only (LGPD). The CNS 094615 is the public
// code of a serventia in the CNJ registry, and the check digits below are
// the ones its PGV-CNM returned.

test("CNM: dígito verificador pelo módulo 97 confere com o PGV", () => {
  assert.equal(cnmCheckDigits("094615", 2, 16), "59");
  assert.equal(cnmCheckDigits("094615", 2, 17), "56");
  assert.equal(cnmCheckDigits("09.461-5", 2, 1686), "93");
  assert.equal(cnmCheckDigits("094615", 2, 1717), "97");
  assert.equal(cnmCheckDigits("094615", 2, 1788), "78");
  assert.equal(cnmCheckDigits("094615", 2, 1790), "72");
  assert.equal(cnmOf("094615", 2, 16), "094615.2.0000016-59");
});

test("CNM: lê, formata e aponta o que não confere", () => {
  assert.deepEqual(parseCnm("0946152000001659"), {
    cns: "094615",
    book: 2,
    number: 16,
    check: "59",
  });
  assert.equal(formatCnm("0946152000001659"), "094615.2.0000016-59");
  assert.equal(parseCnm("123"), null);
  const expected = { cns: "094615", book: 2 as const, number: 16 };
  assert.deepEqual(cnmProblems("094615.2.0000016-59", expected), []);
  assert.deepEqual(cnmProblems("094615.2.0000016-58", expected), ["digito"]);
  assert.ok(cnmProblems("123456.2.0000016-59", expected).includes("serventia"));
  assert.deepEqual(cnmProblems("abc", expected), ["formato"]);
});

test("tabela de logradouros do ONR tem os 311 códigos e reconhece o tipo", () => {
  assert.equal(STREET_KINDS.size, 311);
  assert.equal(STREET_KINDS.get(177), "Não Especificado");
  assert.equal(streetKindOf("Rua das Flores"), 250);
  assert.equal(streetKindOf("Av. Central"), 26);
  assert.equal(streetKindOf("Sítio Boa Vista"), 263);
  assert.equal(streetKindOf("Rodovia RN-000"), 247);
  assert.equal(streetKindOf("Fazenda Exemplo"), 121);
  assert.equal(streetKindOf(""), null);
});

const party = (
  personId: string,
  role: Act["parties"][number]["role"],
  document = "",
) => ({ personId, name: `Pessoa ${personId}`, document, role, share: "" });

const act = (over: Partial<Act> & Pick<Act, "seq" | "effect">): Act => ({
  id: `a${over.seq}`,
  kind: "R",
  nature: "Compra e venda",
  registeredOn: "2020-01-01",
  summary: "",
  cancelsActId: null,
  parties: [],
  ...over,
});

test("situação atual: abertura, venda, venda parcial, ônus e cancelamento", () => {
  const acts: Act[] = [
    act({
      seq: 0,
      kind: "M",
      effect: "titularidade",
      parties: [party("A", "titular"), party("B", "titular")],
    }),
    act({
      seq: 1,
      effect: "transmissao",
      parties: [party("A", "transmitente"), party("C", "adquirente")],
    }),
    act({
      seq: 2,
      nature: "Hipoteca",
      effect: "onus",
      parties: [party("BANCO", "credor"), party("C", "devedor")],
    }),
    act({
      seq: 3,
      kind: "AV",
      nature: "Cancelamento",
      effect: "cancelamento",
      cancelsActId: "a2",
    }),
  ];
  const s = situationOf(acts);
  assert.deepEqual(s.owners.map((o) => o.personId).sort(), ["B", "C"]);
  assert.equal(s.burdens.length, 0);
  assert.equal(s.cancelledBurdens[0]?.cancelledBy, "AV-3");
  assert.equal(s.lastAct, "AV-3 Cancelamento");
  assert.equal(s.closed, false);

  const total = situationOf([
    ...acts,
    act({
      seq: 4,
      effect: "transmissao",
      parties: [party("D", "adquirente")],
    }),
    act({ seq: 5, kind: "AV", effect: "encerramento", nature: "Encerramento" }),
  ]);
  assert.deepEqual(
    total.owners.map((o) => o.personId),
    ["D"],
  );
  assert.equal(total.closed, true);
});

test("numeração dos lançamentos segue o art. 232 e continua a ficha", () => {
  assert.equal(actLabel({ kind: "R", seq: 3 }, 1234), "R-3-1.234");
  assert.equal(actLabel({ kind: "AV", seq: 2 }), "AV-2");
  assert.equal(actLabel({ kind: "M", seq: 0 }), "Situação na migração");
  assert.equal(nextSeq([]), 1);
  assert.equal(nextSeq([{ seq: 0 }], 7), 8);
  assert.equal(nextSeq([{ seq: 9 }], 7), 10);
});

test("datas e formulário da matrícula", () => {
  assert.equal(isoDate("05/03/1988"), "1988-03-05");
  assert.equal(isoDate("31/02/1988"), null);
  const p = readProperty({
    number: "1.234",
    book: "2",
    status: "2",
    location: "1",
    streetKind: "121",
    street: "Exemplo",
    priorActs: "7",
    contributors: "111; 222",
    "rural.ccir": "000.000.000.000-0",
  });
  assert.equal(p.number, 1234);
  assert.equal(p.status, 2);
  assert.equal(p.priorActs, 7);
  assert.deepEqual(p.contributors, ["111", "222"]);
  assert.equal(p.rural.ccir, "000.000.000.000-0");
  assert.throws(() => readProperty({ number: "" }));
});

const base = (
  over: Partial<ExportProperty> & { id: string; number: number },
): ExportProperty => ({
  book: 2,
  recordKind: 1,
  status: 0,
  cnm: "",
  cnmInPgv: false,
  openedOn: null,
  origin: "",
  ficha: "",
  location: 1,
  propertyKind: 9,
  streetKind: 177,
  street: "Fazenda Exemplo",
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
  rural: { ...EMPTY_RURAL },
  condo: { ...EMPTY_CONDO },
  area: "",
  priorActs: 0,
  description: "",
  notes: "",
  ...over,
});

test("pendências: repetido (338), duplicidade (337), salto (339), CNM e indicador", () => {
  const list = [
    { ...base({ id: "1", number: 1 }), ownerCount: 1 },
    {
      ...base({
        id: "2",
        number: 2,
        rural: { ...EMPTY_RURAL, ccir: "999.888.777" },
      }),
      ownerCount: 1,
    },
    {
      ...base({
        id: "3",
        number: 5,
        rural: { ...EMPTY_RURAL, ccir: "999888777" },
      }),
      ownerCount: 1,
    },
    { ...base({ id: "4", number: 5, street: "" }), ownerCount: 0 },
    {
      ...base({ id: "5", number: 6, cnm: "094615.2.0000006-00" }),
      ownerCount: 1,
    },
  ];
  const kinds = pendenciesOf("094615", list).map((p) => p.kind);
  assert.ok(kinds.includes("repetido"));
  assert.ok(kinds.includes("duplicidade"));
  assert.ok(kinds.includes("salto"));
  assert.ok(kinds.includes("cnm"));
  assert.ok(kinds.includes("indicador"));
  assert.ok(kinds.includes("proprietario"));
  const gap = pendenciesOf("094615", list).find((p) => p.kind === "salto");
  assert.equal(gap?.detail, "3 a 4");
  assert.equal(ranges([1, 2, 3, 7, 9, 10]), "1 a 3, 7, 9 a 10");
});

test("lote de CNM no formato do PGV, sem o que já está lá nem números repetidos", () => {
  const batch = cnmBatch("094615", [
    base({ id: "a", number: 17 }),
    base({ id: "b", number: 16 }),
    base({ id: "c", number: 18, cnmInPgv: true }),
    base({ id: "d", number: 19, recordKind: 4 }),
    base({ id: "e", number: 20 }),
    base({ id: "f", number: 20 }),
    base({ id: "g", number: 21, cnm: "094615.2.0000021-00" }),
  ]);
  assert.equal(batch.count, 2);
  assert.ok(
    batch.xml.includes(
      "<REGISTRO><SEQ>1</SEQ><TIPO>I</TIPO><LIVRO>2</LIVRO><NUM>16</NUM><CNM>094615.2.0000016-59</CNM><SITUACAO>0</SITUACAO></REGISTRO>",
    ),
  );
  assert.ok(
    batch.xml.includes(
      "<SEQ>2</SEQ><TIPO>I</TIPO><LIVRO>2</LIVRO><NUM>17</NUM><CNM>094615.2.0000017-56</CNM>",
    ),
  );
  assert.ok(
    batch.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<LOTE>'),
  );
  assert.equal(batch.skipped.length, 3);
  assert.equal(batch.usesClosedSituations, false);
});

test("Indicador Real no JSON do ONR (exemplo oficial)", () => {
  const out = indicadorReal(
    { cns: "123456", state: "RN", ibgeCity: "2400000" },
    [
      base({
        id: "1",
        number: 10,
        rural: { ...EMPTY_RURAL, denominacao: "Fazenda Exemplo", ccir: "0001" },
        contributors: ["123"],
      }),
      base({ id: "2", number: 11, status: 2 }),
      base({ id: "3", number: 12, status: 4 }),
      base({ id: "4", number: 13, streetKind: null }),
    ],
    "completa",
  );
  const parsed = JSON.parse(out.json);
  assert.equal(parsed.INDICADOR_REAL.CNS, "123456");
  const rows = parsed.INDICADOR_REAL.REAL;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].TIPOENVIO, 0);
  assert.equal(rows[0].NUMERO_REGISTRO, "10");
  assert.equal(rows[0].UF, 24);
  assert.equal(rows[0].CIDADE, 2400000);
  assert.equal(rows[0].RURAL.DENOMINACAORURAL, "Fazenda Exemplo");
  assert.deepEqual(rows[0].CONTRIBUINTE, ["123"]);
  assert.ok("VAGA" in rows[0].CONDOMINIO);
  assert.equal(rows[1].TIPOENVIO, 2);
  assert.equal(out.skipped.length, 1);
  assert.throws(() =>
    indicadorReal({ cns: "1", state: "RN", ibgeCity: "" }, [], "completa"),
  );
  const update = indicadorReal(
    { cns: "123456", state: "RN", ibgeCity: "2400000" },
    [base({ id: "1", number: 10 })],
    "atualizacao",
  );
  assert.equal(JSON.parse(update.json).INDICADOR_REAL.REAL[0].TIPOENVIO, 1);
});

test("Indicador Pessoal no XML do Banco Light", () => {
  const acts: Act[] = [
    act({
      seq: 1,
      registeredOn: "2012-04-04",
      effect: "transmissao",
      parties: [
        party("X", "transmitente", "111.444.777-35"),
        party("Y", "adquirente", "52998224725"),
      ],
    }),
    act({
      seq: 2,
      registeredOn: "2013-02-08",
      effect: "transmissao",
      parties: [
        party("Y", "transmitente", "52998224725"),
        party("Z", "adquirente"),
      ],
    }),
  ];
  const out = indicadorPessoal([
    { number: 44, status: 0, openedOn: null, acts },
  ]);
  assert.equal(out.count, 3);
  assert.equal(out.skipped.length, 1);
  assert.ok(out.xml.startsWith('<?xml version="1.0" encoding="iso-8859-1"?>'));
  assert.ok(
    out.xml.includes(
      "<NOME><![CDATA[Pessoa Y]]></NOME><CNPJCPF>52998224725</CNPJCPF><NMATRICULA>44</NMATRICULA><TIPODEATO>COMPRA</TIPODEATO><DTREGAVERB>04042012</DTREGAVERB><DTVENDA>08022013</DTVENDA>",
    ),
  );
  assert.ok(out.xml.includes("<TIPODEATO>VENDA</TIPODEATO>"));
  assert.equal(bdlDate("2013-02-08"), "08022013");
  assert.deepEqual([...latin1("Ação✓")], [65, 231, 227, 111, 63]);
});

test("planilha do índice: cabeçalho, situação, proprietários e CPF", () => {
  const csv = [
    "Índice de matrículas",
    "Matrícula;Situação;Proprietários;CPF/CNPJ;Denominação;Data de abertura;Tipo;Área;CNM;Nº de atos;Coluna estranha",
    '1.234;Ativa;"Maria Exemplo e José Exemplo";111.444.777-35, 529.982.247-25;Sítio Exemplo;05/03/1988;Rural;10 ha;;7;x',
    "1.235;Encerrada;Empresa Fictícia Ltda;11.222.333/0001-81;;31/02/1990;Urbano;;;;",
    "sem número;;;;;;;;;;",
  ].join("\n");
  const reading = readSheet(parseCsv(csv));
  assert.equal(reading.rows.length, 2);
  assert.equal(reading.errors.length, 1);
  const [a, b] = reading.rows;
  assert.equal(a?.input.number, 1234);
  assert.equal(a?.input.location, 1);
  assert.equal(a?.input.rural.denominacao, "Sítio Exemplo");
  assert.equal(a?.input.street, "Sítio Exemplo");
  assert.equal(a?.input.streetKind, 177);
  assert.equal(a?.input.priorActs, 7);
  assert.equal(a?.input.openedOn, "1988-03-05");
  assert.deepEqual(
    a?.owners.map((o) => o.document),
    ["11144477735", "52998224725"],
  );
  assert.equal(b?.input.status, 2);
  assert.ok(b?.warnings.some((w) => w.includes("data de abertura")));
  assert.ok(
    reading.columns.some(
      (c) => c.header === "Coluna estranha" && c.field === "",
    ),
  );
  assert.equal(statusOf("sem imóvel"), 4);
  assert.deepEqual(splitNames("Ana Teste; Bruno Teste e Carla Teste"), [
    "Ana Teste",
    "Bruno Teste",
    "Carla Teste",
  ]);
  assert.deepEqual(splitDocuments("CNPJ 11.222.333/0001-81"), [
    "11222333000181",
  ]);
});
