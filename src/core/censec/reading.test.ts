import assert from "node:assert/strict";
import { test } from "node:test";
import { actProblems } from "./censec.ts";
import { kindIn, readActText, splitActs } from "./reading.ts";

// Fictitious texts, names and numbers only (LGPD). The CPFs are valid
// check-digit examples, not people.
const CPF_A = "529.982.247-25";
const CPF_B = "111.444.777-35";
const CPF_C = "390.533.447-05";

const COMPRA = `ESCRITURA PÚBLICA DE COMPRA E VENDA
Livro 120-F, folhas 034/035. MNE 123456.2026.11.03.00000001-23
Aos três dias do mês de novembro de dois mil e vinte e seis, nesta cidade, compareceram as partes: como OUTORGANTE VENDEDORA, MARIA FICTÍCIA DA SILVA, brasileira, solteira, professora, portadora do RG nº 1.234.567 SSP/RN, inscrita no CPF sob o nº ${CPF_A}, residente e domiciliada na Rua Fictícia, 10; e como OUTORGADO COMPRADOR, JOÃO MODELO SANTOS, brasileiro, casado, comerciante, RG nº 7654321 ITEP/RN, CPF nº ${CPF_B}; o imóvel objeto da matrícula nº 1.234 do Registro de Imóveis, pelo preço de R$ 150.000,00 (cento e cinquenta mil reais), pago à vista, por transferência bancária (PIX).`;

const PROCURACAO = `PROCURAÇÃO BASTANTE QUE FAZ
Livro 80, folha 12.
Aos dez dias do mês de novembro do ano de 2026, compareceu como OUTORGANTE, ANA PAULA FICTÍCIA, brasileira, viúva, aposentada, CPF ${CPF_A}; e nomeia seu bastante procurador o OUTORGADO, CARLOS MODELO, brasileiro, solteiro, CPF ${CPF_B}, com poderes para representá-la perante o INSS, válida até 10/11/2027.`;

const DIVORCIO = `ESCRITURA PÚBLICA DE DIVÓRCIO DIRETO CONSENSUAL
Livro 121, folhas 40.
Aos quatro dias do mês de novembro de dois mil e vinte e seis, compareceram como DIVORCIANDOS: BEATRIZ FICTÍCIA, brasileira, nascida em 01/01/1985, natural de Natal/RN, CPF ${CPF_A}, residente em Cidade Fictícia/RN; e BRUNO MODELO, brasileiro, nascido em 02/02/1984, CPF ${CPF_B}, residente em Cidade Fictícia/RN; assistidos pela advogada CARLA ADVOGADA FICTÍCIA, brasileira, advogada, inscrita na OAB/RN nº 1234, CPF ${CPF_C}. Declaram que são casados desde 02/05/2010, sob o regime da comunhão parcial de bens, e que não possuem filhos menores, tendo 1 filho maior.`;

const INVENTARIO = `ESCRITURA PÚBLICA DE INVENTÁRIO E PARTILHA
Livro 121, folhas 45.
Aos cinco dias do mês de novembro de dois mil e vinte e seis, referente ao falecimento de JOSÉ FICTÍCIO DE SOUZA, ocorrido em 03/03/2026. Compareceram como herdeira e inventariante, HELENA FICTÍCIA DE SOUZA, brasileira, CPF ${CPF_A}; e como herdeiro, PEDRO MODELO DE SOUZA, brasileiro, CPF ${CPF_B}; assistidos pelo advogado CARLA ADVOGADA FICTÍCIA, advogada, OAB/RN nº 1234, CPF ${CPF_C}.`;

const TESTAMENTO = `TESTAMENTO PÚBLICO
Livro 3, folhas 7.
Aos vinte dias do mês de novembro de dois mil e vinte e seis, compareceu a testadora, HELENA FICTÍCIA, brasileira, viúva, nascida em 03/03/1950, filha de JOSÉ FICTÍCIO e de MARIA FICTÍCIA, portadora do RG nº 123456 SSP/RN, inscrita no CPF sob o nº ${CPF_A}, residente nesta cidade; e disse que deseja dispor de seus bens.`;

test("separa os atos de um PDF único pelas aberturas e pelo livro e folha", () => {
  const pages = [
    COMPRA,
    "continuação da escritura, Livro 120-F, folhas 035, e dou fé.",
    PROCURACAO,
    TESTAMENTO,
  ];
  const acts = splitActs(pages);
  assert.equal(acts.length, 3);
  assert.match(acts[0] ?? "", /dou fé/);
});

test("escritura de compra e venda vai ao CEP com natureza, valor, partes e bem", () => {
  const { act } = readActText(COMPRA);
  assert.equal(act.central, "cep");
  assert.equal(act.kind, "Escritura");
  assert.equal(act.nature, "CompraEVenda");
  assert.equal(act.date, "2026-11-03");
  assert.equal(act.book, "120");
  assert.equal(act.bookSuffix, "F");
  assert.equal(act.page, "034");
  assert.equal(act.mne, "123456202611030000000123");
  assert.equal(act.valueCents, 15000000);
  assert.deepEqual(
    act.parties.map((p) => [
      p.name,
      p.quality,
      p.docType,
      p.identity,
      p.issuer,
    ]),
    [
      ["MARIA FICTÍCIA DA SILVA", "Outorgante", "Cpf", "1.234.567", "SSP/RN"],
      ["JOÃO MODELO SANTOS", "Outorgado", "Cpf", "7654321", "ITEP/RN"],
    ],
  );
  assert.equal(act.assets[0]?.matricula, "1234");
  assert.equal(act.assets[0]?.paymentForm, "Transferencia");
  assert.equal(act.assets[0]?.paymentTerm, "AVista");
});

test("procuração previdenciária com validade", () => {
  const { act } = readActText(PROCURACAO);
  assert.equal(act.central, "cep");
  assert.equal(act.kind, "ProcuracaoParaFinsPrevidenciarios");
  assert.equal(act.validity, "2027-11-10");
  assert.deepEqual(
    act.parties.map((p) => p.quality),
    ["Outorgante", "Outorgado"],
  );
  assert.deepEqual(actProblems(act), []);
});

test("divórcio vai ao CESDI com o casal, o regime, os filhos e a advogada", () => {
  const { act } = readActText(DIVORCIO);
  assert.equal(act.central, "cesdi");
  assert.equal(act.kind, "DivorcioDireto");
  assert.equal(act.marriageDate, "2010-05-02");
  assert.equal(act.regime, "ComunhaoParcial");
  assert.equal(act.minorChildren, "0");
  assert.equal(act.adultChildren, "1");
  assert.equal(act.custody, "SemDeclaracao");
  const [a, b] = act.parties;
  assert.equal(a?.quality, "Divorciando");
  assert.equal(a?.spouse, "Conjuge1");
  assert.equal(a?.birthDate, "1985-01-01");
  assert.equal(a?.sex, "F");
  assert.equal(a?.birthUf, "RN");
  assert.equal(b?.spouse, "Conjuge2");
  const lawyer = act.parties.find((p) => p.quality === "Advogado");
  assert.equal(lawyer?.oab, "1234");
  assert.equal(lawyer?.oabUf, "RN");
});

test("inventário vai ao CESDI com o falecido, herdeiros, inventariante e advogada", () => {
  const { act } = readActText(INVENTARIO);
  assert.equal(act.central, "cesdi");
  assert.equal(act.kind, "Inventario");
  const qualities = act.parties.map((p) => `${p.name}:${p.quality}`);
  assert.ok(qualities.includes("JOSÉ FICTÍCIO DE SOUZA:Falecido"));
  assert.ok(qualities.includes("PEDRO MODELO DE SOUZA:Herdeiro"));
  assert.ok(
    qualities.some(
      (q) => q.endsWith(":Inventariante") || q.endsWith(":Herdeiro"),
    ),
  );
  assert.ok(qualities.includes("CARLA ADVOGADA FICTÍCIA:Advogado"));
});

test("testamento vai ao RCTO só com o testador e a filiação", () => {
  const { act } = readActText(TESTAMENTO);
  assert.equal(act.central, "rcto");
  assert.equal(act.kind, "Testamento");
  assert.equal(act.testator.name, "HELENA FICTÍCIA");
  assert.equal(act.testator.cpf, CPF_A);
  assert.equal(act.testator.birthDate, "1950-03-03");
  assert.equal(act.testator.father, "JOSÉ FICTÍCIO");
  assert.equal(act.testator.mother, "MARIA FICTÍCIA");
  assert.equal(act.testator.doc, "123456");
  assert.equal(act.parties.length, 0);
  assert.deepEqual(actProblems(act), []);
});

test("o título decide a central", () => {
  assert.deepEqual(kindIn("ESCRITURA PÚBLICA DE DECLARAÇÃO DE UNIÃO ESTÁVEL"), {
    central: "cep",
    kind: "Escritura",
  });
  assert.equal(
    kindIn("SUBSTABELECIMENTO DE PROCURAÇÃO").kind,
    "Substabelecimento",
  );
  assert.equal(kindIn("REVOGAÇÃO DE PROCURAÇÃO").kind, "RevogacaoDeProcuracao");
  assert.equal(
    kindIn("ATA NOTARIAL PARA FINS DE USUCAPIÃO").kind,
    "AtaNotarialDeUsucapiao",
  );
  assert.equal(
    kindIn("ESCRITURA PÚBLICA DE SOBREPARTILHA").kind,
    "Sobrepartilha",
  );
  assert.equal(
    kindIn("AUTO DE APROVAÇÃO DE TESTAMENTO CERRADO").kind,
    "Cerrado",
  );
  // Diretivas antecipadas ("testamento vital") are the CEP's.
  assert.equal(
    kindIn("ESCRITURA DE DIRETIVAS ANTECIPADAS (TESTAMENTO VITAL)").central,
    "cep",
  );
});
