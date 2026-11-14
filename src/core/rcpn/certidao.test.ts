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
  assert.equal(fields.nome, "Criança Fictícia da Silva");
  assert.equal(fields.matricula, formatMatricula(M));
  assert.deepEqual(
    [fields.nascimentoDia, fields.nascimentoMes, fields.nascimentoAno],
    ["10", "agosto", "2025"],
  );
  // Provimento 182: the mother's line first, then the father's.
  assert.equal(fields.genitor1, "Mãe Fictícia");
  assert.equal(fields.genitor2, "Pai Fictício");
  assert.equal(fields.cpf, "NÃO CONSTA");
  assert.equal(
    fields.dataRegistroExtenso,
    "dois de setembro de dois mil e vinte e cinco",
  );
  // What the index does not keep stays blank for the book.
  assert.equal(fields.hora, undefined);
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
  assert.equal(fields.nomes, "Noivo Fictício\nNoiva Fictícia");
  assert.equal(fields.nomesAdotados, "Noiva Fictícia Casada");
  assert.equal(fields.dataRegistro, "01/01/2020");
});

test("só os campos do modelo, e o que falta para emitir", () => {
  const clean = cleanCertidaoFields("obito", {
    nome: "  Pessoa Fictícia  ",
    matricula: "123",
    cpf: "não entra",
  });
  assert.equal(clean.nome, "Pessoa Fictícia");
  assert.equal("cpf" in clean, false);
  assert.equal(Object.keys(clean).length, CERTIDAO_MODELS.obito.fields.length);
  assert.deepEqual(certidaoProblems("obito", clean), [
    "A matrícula precisa ter 32 dígitos.",
  ]);
  assert.deepEqual(
    certidaoProblems("casamento", cleanCertidaoFields("casamento", {})),
    ["Preencha nomes.", "Preencha matrícula."],
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
    "Preencha inteiro teor.",
  ]);
});
