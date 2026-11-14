import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyHabilitacao,
  estadoCivilText,
  filiacaoText,
  reviewHabilitacao,
  timelineOf,
} from "./habilitacao.ts";

// Fictitious nubentes only (LGPD).
const COMPLETE = {
  tipo: "civil",
  requeridoEm: "2026-11-10",
  "n1.nome": "Ana Exemplo",
  "n1.sexo": "F",
  "n1.estadoCivil": "solteiro",
  "n1.nascimento": "1995-03-02",
  "n1.domicilio": "Cidade Fictícia/RN",
  "n1.filiacao1": "Mãe Fictícia",
  "n2.nome": "Bia Modelo",
  "n2.estadoCivil": "divorciado",
  "n2.dissolucao": "Divórcio averbado no registro de casamento fictício.",
  "n2.nascimento": "1990-07-20",
  "n2.domicilio": "Cidade Fictícia/RN",
  regime: "comunhao-parcial",
  "t1.nome": "Testemunha Um",
  "t2.nome": "Testemunha Dois",
};

test("aplica o que foi digitado, com o antes e o depois, e data em ISO", () => {
  const { values, changes, problems } = applyHabilitacao(
    { "n1.nome": "Ana" },
    {
      "n1.nome": "  Ana   Exemplo ",
      "n1.nascimento": "02/03/1995",
      "n2.nascimento": "31/02/1990",
      regime: "invalido",
    },
  );
  assert.equal(values["n1.nome"], "Ana Exemplo");
  assert.equal(values["n1.nascimento"], "1995-03-02");
  assert.equal(
    values.regime,
    "comunhao-parcial",
    "opção desconhecida vira a primeira",
  );
  assert.equal(values.tipo, "civil");
  assert.deepEqual(problems, [
    "2º nubente: data de nascimento: data inválida (use dd/mm/aaaa).",
  ]);
  assert.deepEqual(
    changes.find((c) => c.key === "n1.nome"),
    {
      key: "n1.nome",
      label: "1º nubente: nome completo",
      before: "Ana",
      after: "Ana Exemplo",
    },
  );
});

test("processo completo não tem pendência; divorciada tem o aviso da partilha", () => {
  const review = reviewHabilitacao(COMPLETE, "2026-11-14");
  assert.deepEqual(review.problems, []);
  assert.ok(review.warnings.some((w) => w.includes("art. 1.523, III")));
});

test("idade núbil, autorização, casamento anterior, pacto e testemunhas", () => {
  const review = reviewHabilitacao(
    {
      ...COMPLETE,
      "n1.nascimento": "2011-01-01",
      "n2.nascimento": "2009-06-01",
      "n2.dissolucao": "",
      regime: "comunhao-universal",
      "t2.nome": "",
    },
    "2026-11-14",
  );
  const all = review.problems.join("\n");
  assert.match(all, /1º nubente: tem 15 anos\. .*art\. 1\.520/);
  assert.match(all, /2º nubente: tem 17 anos .*arts\. 1\.517/);
  assert.match(all, /2º nubente: informe o casamento anterior/);
  assert.match(all, /comunhão universal de bens precisa de pacto/);
  assert.match(all, /Falta a 2ª testemunha/);
});

test("maior de 70 anos: aviso da separação obrigatória, sem travar", () => {
  const review = reviewHabilitacao(
    { ...COMPLETE, "n2.nascimento": "1950-01-01" },
    "2026-11-14",
  );
  assert.deepEqual(review.problems, []);
  assert.ok(review.warnings.some((w) => w.includes("Tema 1.236")));
});

test("prazos: certificado em 5 dias do edital e eficácia de 90 dias", () => {
  assert.equal(timelineOf(COMPLETE, "2026-11-14").status, "preparo");
  const edital = timelineOf(
    { ...COMPLETE, editalEm: "2026-11-12" },
    "2026-11-14",
  );
  assert.equal(edital.status, "edital");
  assert.equal(edital.certificadoAte, "2026-11-17");
  assert.equal(edital.diasRestantes, 3);
  const habilitados = timelineOf(
    { ...COMPLETE, editalEm: "2026-11-12", certificadoEm: "2026-11-14" },
    "2026-11-14",
  );
  assert.equal(habilitados.status, "habilitados");
  assert.equal(habilitados.validaAte, "2027-02-12");
  assert.equal(
    timelineOf(
      { ...COMPLETE, editalEm: "2026-08-01", certificadoEm: "2026-08-03" },
      "2026-11-14",
    ).status,
    "vencida",
  );
  assert.equal(
    timelineOf({ ...COMPLETE, celebracaoData: "2026-11-14" }, "2026-11-14")
      .status,
    "celebrado",
  );
  assert.equal(timelineOf(COMPLETE, "2026-11-14", true).status, "cancelada");
});

test("celebração depois dos 90 dias é pendência", () => {
  const review = reviewHabilitacao(
    {
      ...COMPLETE,
      editalEm: "2026-11-12",
      certificadoEm: "2026-11-14",
      celebracaoData: "2027-03-01",
    },
    "2026-11-14",
  );
  assert.ok(review.problems.some((p) => p.includes("art. 1.532")));
});

test("palavras concordam com o sexo declarado, e neutras sem ele", () => {
  assert.equal(estadoCivilText("solteiro", "F"), "solteira");
  assert.equal(estadoCivilText("viuvo", "M"), "viúvo");
  assert.equal(estadoCivilText("divorciado", ""), "divorciado(a)");
  assert.equal(filiacaoText(COMPLETE, 1), "filha de Mãe Fictícia");
  assert.equal(
    filiacaoText({ "n2.filiacao1": "A", "n2.filiacao2": "B" }, 2),
    "filho(a) de A e de B",
  );
});
