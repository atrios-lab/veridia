import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type CensecAct,
  censecDeadline,
  emptyAct,
  emptyParty,
  quinzenaOf,
  shiftQuinzena,
} from "./censec.ts";
import schema from "./censec-carga.schema.json" with { type: "json" };
import { censecJson, censecObject, censecTxt, censecXml } from "./exports.ts";
import { schemaProblems } from "./schema.ts";

// Fictitious people and numbers only (LGPD).
const CPF_A = "529.982.247-25";
const CPF_B = "111.444.777-35";
const OFFICE = { cns: "00.000-0" };

function escritura(): CensecAct {
  return {
    ...emptyAct("cep"),
    kind: "Escritura",
    nature: "CompraEVenda",
    date: "2026-11-03",
    book: "12",
    page: "34",
    valueCents: 15000000,
    parties: [
      {
        ...emptyParty(),
        name: "Maria Fictícia",
        quality: "Outorgante",
        docType: "Cpf",
        docNumber: CPF_A,
        identity: "123",
        issuer: "SSP/RN",
      },
      {
        ...emptyParty(),
        name: "João Modelo",
        quality: "Outorgado",
        docType: "Cpf",
        docNumber: CPF_B,
      },
    ],
    assets: [
      {
        description: "Casa fictícia",
        valueCents: 15000000,
        fiscalCents: 12000000,
        paymentForm: "Transferencia",
        paymentTerm: "AVista",
        matricula: "1234",
        cnm: "",
      },
    ],
  };
}

function divorcio(): CensecAct {
  return {
    ...emptyAct("cesdi"),
    kind: "DivorcioDireto",
    date: "2026-11-04",
    book: "12",
    page: "40",
    marriageDate: "2010-05-02",
    regime: "ComunhaoParcial",
    adultChildren: "1",
    minorChildren: "0",
    custody: "SemDeclaracao",
    parties: [
      {
        ...emptyParty(),
        name: "Ana Fictícia",
        quality: "Divorciando",
        docType: "Cpf",
        docNumber: CPF_A,
        spouse: "Conjuge1",
        birthDate: "1985-01-01",
        birthCountry: "Brasil",
        birthUf: "RN",
        residenceCountry: "Brasil",
        residenceUf: "RN",
        residenceCity: "2400000",
        sex: "F",
      },
      {
        ...emptyParty(),
        name: "Bruno Modelo",
        quality: "Divorciando",
        docType: "Cpf",
        docNumber: CPF_B,
        spouse: "Conjuge2",
        birthDate: "1984-02-02",
        birthCountry: "Brasil",
        birthUf: "RN",
        residenceCountry: "Brasil",
        residenceUf: "RN",
        residenceCity: "2400000",
        sex: "M",
      },
      {
        ...emptyParty(),
        name: "Carla Advogada",
        quality: "Advogado",
        docType: "Cpf",
        docNumber: "390.533.447-05",
        oab: "1234",
        oabUf: "RN",
      },
    ],
  };
}

function testamento(): CensecAct {
  return {
    ...emptyAct("rcto"),
    kind: "Testamento",
    date: "2026-11-20",
    book: "3",
    page: "7",
    testator: {
      name: "Helena Fictícia",
      cpf: CPF_A,
      birthDate: "1950-03-03",
      mother: "Mãe Fictícia",
      father: "",
      docType: "Rg",
      doc: "123456",
      docComplement: "SSP/RN",
    },
  };
}

test("JSON da quinzena no esquema oficial do CENSEC, as três centrais num arquivo", () => {
  const acts = [escritura(), divorcio(), testamento()];
  const object = censecObject(OFFICE, "2026-11-1", acts);
  assert.deepEqual(schemaProblems(object, schema), []);
  assert.deepEqual(object.quinzena, {
    anoReferencia: 2026,
    quinzenaReferencia: 1,
    mesReferencia: "Novembro",
  });
  assert.equal(object.atosCep?.length, 1);
  assert.equal(object.atosCesdi?.length, 1);
  assert.equal(object.testamentos?.length, 1);
  // Only the CEP, when asked.
  const cep = JSON.parse(censecJson(OFFICE, "2026-11-1", acts, "cep"));
  assert.equal(cep.atosCesdi, undefined);
  assert.equal(cep.atosCep[0].partes[0].numeroDocumento, "52998224725");
  assert.equal(cep.atosCep[0].bensEDireitos[0].formaPagamento, "Transferencia");
});

test("o esquema do CENSEC aponta o que falta", () => {
  const broken = { ...escritura(), book: "12A", parties: [] };
  const problems = schemaProblems(
    censecObject(OFFICE, "2026-11-1", [broken]),
    schema,
  );
  assert.ok(problems.some((p) => /livro/.test(p)));
});

test("XML de cada central como os exemplos do CNB/CF", () => {
  const cep = censecXml("cep", [escritura()]);
  assert.match(cep, /^<\?xml version="1.0" standalone="yes"\?>\n<CEP>/);
  assert.equal(cep.match(/<AtoCep>/g)?.length, 3); // 2 partes + 1 bem
  assert.match(cep, /<TipoAtoCep>1<\/TipoAtoCep>/);
  assert.match(cep, /<NaturezaEscritura>6<\/NaturezaEscritura>/);
  assert.match(cep, /<ParteQualidade>OUTORGANTE<\/ParteQualidade>/);
  const cesdi = censecXml("cesdi", [divorcio()]);
  assert.match(cesdi, /<Cesdi>/);
  assert.match(cesdi, /<Qualidade>DIVORCIANDO\(A\)<\/Qualidade>/);
  assert.match(cesdi, /<RegimeBens>Comunhão Parcial<\/RegimeBens>/);
  const rcto = censecXml("rcto", [testamento()]);
  assert.match(rcto, /<RCTO>\s*<Testamento>\s*<TipoTestamento>4</);
});

test("TXT do CESDI e do RCTO com o cabeçalho e as aspas do leiaute", () => {
  const cesdi = censecTxt("cesdi", [divorcio()]).split("\r\n");
  assert.ok(cesdi[0]?.startsWith('"TIPOATOCESDI";"DATAATO";"LIVRO"'));
  assert.equal(cesdi.filter(Boolean).length, 4); // header + 3 partes
  assert.ok(
    cesdi[1]?.startsWith(
      '"4";"04/11/2026";"12";"";"40";"";"02/05/2010";"Comunhão Parcial";"01";"00";"05";"Ana Fictícia";"DIVORCIANDO(A)";"01";"CPF";"52998224725"',
    ),
  );
  // The advogado: no couple data.
  assert.match(
    cesdi[3] ?? "",
    /"ADVOGADO\(A\)";"";"OAB";"1234";"RN";"CPF";"39053344705"/,
  );
  const rcto = censecTxt("rcto", [testamento()]).split("\r\n");
  assert.ok(rcto[0]?.startsWith('"tipoTestamento";"nome";"dataNascimento"'));
  assert.ok(
    rcto[1]?.startsWith(
      '"4";"Helena Fictícia";"03/03/1950";"RG";"123456";"SSP/RN";"52998224725"',
    ),
  );
  assert.equal(censecTxt("cep", [escritura()]), "");
});

test("quinzena e prazo do CNN (arts. 267, 270 e 272)", () => {
  assert.equal(quinzenaOf("2026-11-15"), "2026-11-1");
  assert.equal(quinzenaOf("2026-11-16"), "2026-11-2");
  assert.equal(shiftQuinzena("2026-12-2", 1), "2027-01-1");
  assert.equal(shiftQuinzena("2027-01-1", -1), "2026-12-2");
  // 1ª quinzena: até o dia 20; 20/12/2026 é domingo: 21/12.
  assert.equal(censecDeadline("2026-12-1"), "2026-12-21");
  // 2ª quinzena: até o dia 5 do mês seguinte; 05/12/2026 é sábado: 07/12.
  assert.equal(censecDeadline("2026-11-2"), "2026-12-07");
});

test("o formulário leva e traz o ato inteiro, editável", async () => {
  const { actFromForm, actToForm } = await import("./form.ts");
  for (const act of [escritura(), divorcio(), testamento()]) {
    const back = actFromForm(actToForm(act));
    assert.deepEqual(back.problems, []);
    assert.deepEqual(back.act, act);
  }
});
