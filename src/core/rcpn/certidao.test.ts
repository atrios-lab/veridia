import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CERTIDAO_MODELS,
  certidaoModel,
  certidaoProblems,
  cleanCertidaoFields,
  dateInWords,
  formatMatricula,
  prefillCertidao,
} from "./certidao.ts";
import type { RcpnRecord } from "./record.ts";

// Fictitious registros only (LGPD).
const M = "09461501552025100010010000011111";

test("matrícula em nove blocos: 6 2 2 4 1 5 3 7 2", () => {
  assert.equal(formatMatricula(M), "094615 01 55 2025 1 00010 010 0000111 11");
  assert.equal(formatMatricula("123"), "123");
});

test("data por extenso, com 'primeiro' no dia 1", () => {
  assert.equal(
    dateInWords("2025-08-10"),
    "dez de agosto de dois mil e vinte e cinco",
  );
  assert.equal(
    dateInWords("2024-03-01"),
    "primeiro de março de dois mil e vinte e quatro",
  );
  assert.equal(dateInWords(""), "");
});

test("nascimento: o índice preenche nome, matrícula, datas e filiação", () => {
  const record: RcpnRecord = {
    kind: "nascimento",
    matricula: M,
    book: "A-10",
    page: "10",
    term: "1111",
    registeredOn: "2025-09-02",
    eventOn: "2025-08-10",
    people: [
      {
        role: "registrado",
        name: "Criança Fictícia da Silva",
        marriedName: "",
        motherName: "Mãe Fictícia",
        fatherName: "Pai Fictício",
        birthDate: "2025-08-10",
        profession: "",
        fatherProfession: "",
        motherProfession: "",
      },
    ],
  };
  const fields = prefillCertidao(record);
  // Anexo IV: the name in capitals.
  assert.equal(fields.nome, "CRIANÇA FICTÍCIA DA SILVA");
  assert.equal(fields.matricula, formatMatricula(M));
  assert.deepEqual(
    [fields.nascimentoDia, fields.nascimentoMes, fields.nascimentoAno],
    ["10", "08", "2025"],
  );
  // Provimento 182: the mother's line first, then the father's.
  assert.equal(fields.genitor1, "Mãe Fictícia");
  assert.equal(fields.genitor2, "Pai Fictício");
  assert.equal(fields.cpf, "NÃO CONSTA");
  assert.equal(
    fields.dataRegistroExtenso,
    "dois de setembro de dois mil e vinte e cinco",
  );
  // What the index does not keep stays blank for the book, and the gêmeo
  // only appears when there is one (Anexo IV).
  assert.equal(fields.hora, undefined);
  assert.equal(fields.gemeo, undefined);
  assert.deepEqual(
    certidaoProblems("nascimento", cleanCertidaoFields("nascimento", fields)),
    [],
  );
});

test("casamento: os dois cônjuges e o nome que passaram a usar", () => {
  const person = {
    marriedName: "",
    motherName: "",
    fatherName: "",
    birthDate: "",
    profession: "",
    fatherProfession: "",
    motherProfession: "",
  };
  const fields = prefillCertidao({
    kind: "casamento",
    matricula: M,
    book: "B-1",
    page: "1",
    term: "1",
    registeredOn: "2020-01-01",
    eventOn: "2020-01-01",
    people: [
      { ...person, role: "conjuge1", name: "Noivo Fictício" },
      {
        ...person,
        role: "conjuge2",
        name: "Noiva Fictícia",
        marriedName: "Noiva Fictícia Casada",
      },
    ],
  });
  // Anexo V: the current names on top, each spouse with the name at the
  // habilitação and the one adopted.
  assert.equal(fields.nomes, "NOIVO FICTÍCIO\nNOIVA FICTÍCIA CASADA");
  assert.equal(fields.cpfs, "NÃO CONSTA\nNÃO CONSTA");
  assert.equal(fields.conjuge2Nome, "Noiva Fictícia");
  assert.equal(fields.conjuge2NomeAdotado, "Noiva Fictícia Casada");
  assert.equal(fields.conjuge1NomeAdotado, "Noivo Fictício");
  assert.deepEqual(
    [fields.registroDia, fields.registroMes, fields.registroAno],
    ["01", "01", "2020"],
  );
  assert.equal(
    fields.dataCelebracaoExtenso,
    "primeiro de janeiro de dois mil e vinte",
  );
});

test("só os campos do modelo, e o que falta para emitir", () => {
  const clean = cleanCertidaoFields("obito", {
    nome: "  Pessoa Fictícia  ",
    matricula: "123",
    cor: "não entra",
  });
  assert.equal(clean.nome, "Pessoa Fictícia");
  assert.equal("cor" in clean, false, "cor não está no Anexo VI");
  assert.equal(Object.keys(clean).length, CERTIDAO_MODELS.obito.fields.length);
  assert.deepEqual(certidaoProblems("obito", clean), [
    "A matrícula precisa ter 32 dígitos.",
  ]);
  assert.deepEqual(
    certidaoProblems("casamento", cleanCertidaoFields("casamento", {})),
    ["Preencha nome atual dos cônjuges.", "Preencha matrícula."],
  );
});

test("inteiro teor: nome, CPF, matrícula e o registro transcrito", () => {
  const model = certidaoModel("nascimento", "inteiro-teor");
  assert.equal(model.title, "CERTIDÃO EM INTEIRO TEOR DE NASCIMENTO");
  assert.deepEqual(
    model.fields.map((f) => f.key),
    ["nome", "cpf", "matricula", "teor"],
  );
  assert.equal(
    certidaoModel("casamento", "inteiro-teor").fields[0]?.key,
    "nomes",
  );
  const clean = cleanCertidaoFields(
    "nascimento",
    { nome: "Pessoa Fictícia", matricula: M },
    "inteiro-teor",
  );
  assert.deepEqual(certidaoProblems("nascimento", clean, "inteiro-teor"), [
    "Preencha texto do registro.",
  ]);
});

test("certidão antiga de casamento ou óbito continua no modelo em que saiu", () => {
  const old = { nomes: "A\nB", matricula: M, conjuges: "texto antigo" };
  assert.equal(
    certidaoModel("casamento", "breve", old).fields.some(
      (f) => f.key === "conjuges",
    ),
    true,
  );
  assert.equal(cleanCertidaoFields("casamento", old).conjuges, "texto antigo");
  assert.equal(
    certidaoModel("casamento").fields.some((f) => f.key === "conjuges"),
    false,
  );
});

test("Anexos IV a VI: legendas do Provimento nº 182/2024", () => {
  const labels = (kind: "nascimento" | "casamento" | "obito") =>
    certidaoModel(kind).fields.map((f) => f.label);
  assert.deepEqual(labels("nascimento").slice(0, 3), [
    "Nome",
    "Número do CPF",
    "Matrícula",
  ]);
  assert.ok(labels("nascimento").includes("Avô(ó)(s) respectivo(s)"));
  assert.ok(labels("casamento").includes("Nome atual dos cônjuges"));
  assert.ok(labels("obito").includes("Nome do último cônjuge ou convivente"));
  assert.ok(labels("obito").includes("Existência de filhos"));
});
