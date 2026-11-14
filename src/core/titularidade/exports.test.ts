import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressParts,
  ctpJson,
  ctpTxt,
  ctpXml,
  doiDeclaration,
  doiXml,
  shareOf,
} from "./exports.ts";
import {
  emptyTransfer,
  type TitleTransfer,
  transferFromGuide,
} from "./titularidade.ts";

// Fictitious parties only (LGPD).
const CPF = "529.982.247-25";
const OFFICE = {
  name: "Cartório Fictício",
  city: "Cidade Fictícia",
  state: "RN",
  cns: "000000",
};

function act(): TitleTransfer {
  return {
    ...emptyTransfer("notas"),
    actDate: "2026-10-10",
    book: "12",
    page: "34/35",
    operation: "11",
    destination: "urbano",
    matricula: "1.234",
    fiscalRegistration: "01.02.003.0004",
    address: "Rua das Flores Fictícias, nº 10, Centro",
    valueCents: 15000000,
    taxBaseCents: null,
    transmitentes: [{ name: "Maria & Filhos", taxId: CPF, share: "100%" }],
    adquirentes: [
      { name: "João Modelo", taxId: "", share: "1/2" },
      { name: "Ana Modelo", taxId: "", share: "" },
    ],
  };
}

test("participação e endereço em partes", () => {
  assert.equal(shareOf("50%"), 50);
  assert.equal(shareOf("1/2"), 50);
  assert.equal(shareOf("0,5"), 50);
  assert.equal(shareOf(""), undefined);
  assert.deepEqual(addressParts("Rua das Flores Fictícias, nº 10, Centro"), {
    tipoLogradouro: "Rua",
    nomeLogradouro: "das Flores Fictícias",
    numeroImovel: "10",
    bairro: "Centro",
  });
});

test("DOI com os campos e códigos do manual da DOI-Web, sem inventar", () => {
  const d = doiDeclaration(act());
  assert.equal(d.tipoServico, "1");
  assert.equal(d.tipoAto, "1");
  assert.equal(d.numeroLivro, "12");
  assert.equal(d.folha, "34/35");
  assert.equal(d.operacaoImobiliaria.tipoOperacaoImobiliaria, "11");
  assert.equal(d.operacaoImobiliaria.valorOperacaoImobiliaria, 150000);
  assert.equal(
    d.operacaoImobiliaria.indicadorNaoConstaValorBaseCalculoItbiItcmd,
    true,
    "base de cálculo que o título não diz",
  );
  assert.equal(d.imovel.destinacao, "1");
  assert.equal(d.imovel.matricula, "1234");
  assert.equal(d.alienantes[0]?.ni, "52998224725");
  assert.equal(d.adquirentes[0]?.indicadorNiIdentificado, false);
  assert.equal(d.adquirentes[0]?.motivoNaoIdentificacaoNi, "2");
  assert.equal(d.adquirentes[0]?.participacao, 50);
  assert.equal(d.adquirentes[1]?.indicadorNaoConstaParticipacaoOperacao, true);
  assert.ok(!("cib" in d.imovel), "campo sem conteúdo não vai");
  const ri = doiDeclaration({
    ...act(),
    service: "ri",
    act: "registro",
    entry: "R-3",
  });
  assert.equal(ri.tipoServico, "2");
  assert.equal(ri.tipoAto, "4");
  assert.equal(ri.tipoLivro, "1");
  assert.equal(ri.numeroRegistroAverbacao, "R-3");
  assert.equal(ri.numeroLivro, undefined);
  assert.match(doiXml([act()]), /<declaracoes>\s*<declaracao>/);
});

test("Carga CTP em JSON, XML e TXT, e o mês negativo", () => {
  const json = JSON.parse(ctpJson(OFFICE, "2026-10", [act()]));
  assert.equal(json.comunicacaoTitularidade.quantidadeAtos, 1);
  assert.equal(json.comunicacaoTitularidade.atos[0].operacao, "Compra e venda");
  const xml = ctpXml(OFFICE, "2026-10", [act()]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<nome>Maria &amp; Filhos<\/nome>/, "XML escapado");
  assert.match(xml, /<atos>\s*<ato>/);
  const txt = ctpTxt(OFFICE, "2026-10", [act()]).trim().split("\r\n");
  assert.equal(
    txt[0],
    "H|Cartório Fictício|000000|Cidade Fictícia/RN|2026-10|1",
  );
  assert.match(
    txt[1] ?? "",
    /^A\|1\|Tabelionato de Notas\|2026-10-10\|12\|34\/35\|\|11\|Compra e venda\|/,
  );
  assert.equal(txt.filter((l) => l.startsWith("D|")).length, 2);
  const negative = JSON.parse(ctpJson(OFFICE, "2026-09", []));
  assert.equal(negative.comunicacaoTitularidade.semMovimento, true);
});

test("da guia de ITIV sai a comunicação, sem data nem livro", () => {
  const t = transferFromGuide({
    kind: "itiv",
    nature: "compra e venda",
    declaredValueCents: 15000000,
    property: {
      type: "urbano",
      description: "Casa situada na Rua A, nº 1, Centro, com área de 200 m²",
      fiscalRegistration: "01.02",
      registration: "Matrícula nº 1.234 do Registro de Imóveis fictício",
    },
    parties: [
      { role: "transmitente", name: "Maria Fictícia", taxId: CPF },
      { role: "adquirente", name: "João Modelo", taxId: "" },
    ],
  });
  assert.equal(t.operation, "11");
  assert.equal(t.matricula, "1.234");
  assert.equal(t.address, "Rua A, nº 1, Centro");
  assert.equal(t.actDate, "");
  assert.deepEqual(
    t.transmitentes.map((p) => p.name),
    ["Maria Fictícia"],
  );
  assert.equal(
    transferFromGuide({
      kind: "itcd-causa-mortis",
      nature: "",
      declaredValueCents: 0,
      property: {
        type: "rural",
        description: "",
        fiscalRegistration: "",
        registration: "",
      },
      parties: [],
    }).operation,
    "69",
  );
});
