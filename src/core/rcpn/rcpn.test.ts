import assert from "node:assert/strict";
import { test } from "node:test";
import { readCargaXml } from "./carga-xml.ts";
import { readCartosoft } from "./cartosoft.ts";
import { changedFields, conferenceOf, toPublish } from "./conference.ts";
import { nameFit, normalizeName } from "./names.ts";
import {
  isLivroCAuxiliar,
  isMatricula,
  recordKey,
  toIsoDate,
} from "./record.ts";

/** The value, or the test fails here: no `!` in the tests. */
function must<T>(value: T | null | undefined): T {
  assert.ok(value !== null && value !== undefined, "valor ausente");
  return value as T;
}

// Fictitious people only (LGPD).
const MATRICULA = "09461501552014100050123000123456";
const MATRICULA_RAW = "094615015520141000501230001234- 56  ";

test("nomes: sem acento, maiúsculas, espaços e partículas", () => {
  assert.equal(normalizeName("  Maria  José da   Silva "), "MARIA JOSE SILVA");
  assert.equal(normalizeName("JOÃO D'ÁVILA dos Santos"), "JOAO AVILA SANTOS");
});

test("nomes no painel: ordem livre, exato ou com uma letra trocada", () => {
  assert.equal(nameFit("silva maria", "Maria José da Silva"), "exact");
  assert.equal(nameFit("Maria Jose Silvia", "Maria José da Silva"), "near");
  assert.equal(nameFit("Mariana Souza", "Maria José da Silva"), null);
  assert.equal(nameFit("", "Maria"), null);
});

test("datas: Date do Access, dd/mm/aaaa, aaaammdd; dia impossível vira vazio", () => {
  assert.equal(toIsoDate(new Date(Date.UTC(1987, 4, 3))), "1987-05-03");
  assert.equal(toIsoDate("03/05/1987"), "1987-05-03");
  assert.equal(toIsoDate("19870503"), "1987-05-03");
  assert.equal(toIsoDate("31/02/1987"), "");
  assert.equal(toIsoDate("sem data"), "");
});

test("matrícula: só dígitos, 32; sem ela a chave é livro, folha e termo", () => {
  assert.ok(isMatricula(MATRICULA));
  const [record] = readCartosoft({
    NASCIMENTO: [
      {
        ID: 1,
        no_pessoa: "Ana Teste",
        nu_matriculaCNJ: "123",
        nu_livro: "A 12",
        nu_folha: "34",
        cd_registro: 56,
      },
    ],
  });
  assert.equal(record?.matricula, "123");
  assert.equal(recordKey(must(record)), "LA 12|F34|T56");
});

test("Cartosoft: nascimento com mãe, pai e profissões dos pais", () => {
  const [record] = readCartosoft({
    NASCIMENTO: [
      {
        ID: 7,
        no_pessoa: "Ana Teste Fictícia",
        dt_nascimento: "03/05/1987",
        dt_registro: new Date(Date.UTC(1987, 4, 10)),
        nu_livro: "A 12",
        nu_folha: "34",
        cd_registro: 5601,
        nu_matriculaCNJ: MATRICULA_RAW,
        no_cpf: "000.000.000-00",
      },
    ],
    NA_PAIS: [
      {
        ID: 7,
        NO_MAE: "Beatriz Exemplo",
        NO_PAI: "Carlos Exemplo",
        no_profiss_pai: "agricultor",
        no_profiss_mae: "",
      },
    ],
  });
  assert.equal(record?.kind, "nascimento");
  assert.equal(record?.matricula, MATRICULA);
  assert.equal(record?.registeredOn, "1987-05-10");
  const [p] = must(record).people;
  assert.deepEqual(
    {
      name: p?.name,
      mother: p?.motherName,
      birth: p?.birthDate,
      fp: p?.fatherProfession,
    },
    {
      name: "Ana Teste Fictícia",
      mother: "Beatriz Exemplo",
      birth: "1987-05-03",
      fp: "agricultor",
    },
  );
  // Nothing outside the model: no CPF anywhere in the record.
  assert.ok(!JSON.stringify(record).includes("000.000.000"));
});

test("Cartosoft: casamento com os dois cônjuges e as profissões; óbito com a do falecido", () => {
  const records = readCartosoft({
    CASAMENTO: [
      {
        nu_sequencia: 3,
        nu_registro: 210,
        nu_livro: "B 4",
        nu_folha: "12",
        no_noivo: "Davi Fictício",
        no_noiva: "Elisa Fictícia",
        no_noiva_casada: "Elisa Fictícia Davi",
        dt_nasc_noivo: new Date(Date.UTC(1960, 0, 2)),
        dt_nasc_noiva: new Date(Date.UTC(1962, 1, 3)),
        profissao_noivo: "lavrador",
        profissao_noiva: "doméstica",
        dt_casamento: new Date(Date.UTC(1985, 6, 20)),
        nu_matriculaCNJ: MATRICULA,
      },
    ],
    CA_PAIS: [
      {
        nu_sequencia: 3,
        no_mae_noivo: "Fátima Exemplo",
        no_mae_noiva: "Glória Exemplo",
      },
    ],
    OBITO: [
      {
        ID: 9,
        nu_registro: 77,
        nu_livro: "C 2",
        no_pessoa: "Hugo Fictício",
        dt_nascimento: "01/01/1930",
        no_profissao: "agricultor",
        dt_falecimento: "05/06/2010",
      },
    ],
    OB_PAIS: [{ ID: 9, no_mae: "Iara Exemplo" }],
  });
  const casamento = must(records.find((r) => r.kind === "casamento"));
  assert.deepEqual(
    casamento.people.map((p) => [p.role, p.profession, p.motherName]),
    [
      ["conjuge1", "lavrador", "Fátima Exemplo"],
      ["conjuge2", "doméstica", "Glória Exemplo"],
    ],
  );
  assert.equal(casamento.eventOn, "1985-07-20");
  const obito = must(records.find((r) => r.kind === "obito"));
  assert.equal(obito.people[0]?.profession, "agricultor");
  assert.equal(obito.eventOn, "2010-06-05");
});

test("carga XML: a mãe é a primeira filiação feminina; sem profissão", () => {
  const { records, unknownMovements } = readCargaXml({
    CARGAREGISTROS: {
      CNS: "000000",
      MOVIMENTONASCIMENTOTN: {
        REGISTRONASCIMENTOINCLUSAO: {
          INDICEREGISTRO: "1",
          NOMEREGISTRADO: "Júlia Teste",
          MATRICULA: MATRICULA,
          DATAREGISTRO: "02/09/2025",
          DATANASCIMENTO: "30/08/2025",
          FILIACAONASCIMENTO: [
            { NOME: "Kauã Exemplo", SEXO: "M" },
            { NOME: "Lara Exemplo", SEXO: "F" },
          ],
        },
      },
      MOVIMENTOPROCLAMASTP: {},
    },
  });
  assert.equal(records.length, 1);
  const p = must(must(records[0]).people[0]);
  assert.equal(p.motherName, "Lara Exemplo");
  assert.equal(p.fatherName, "Kauã Exemplo");
  assert.equal(p.profession, "");
  assert.deepEqual(unknownMovements, ["MOVIMENTOPROCLAMASTP"]);
});

test("conferência: novo, igual e alterado; alterado só entra se escolhido", () => {
  const [base] = readCartosoft({
    NASCIMENTO: [
      {
        ID: 1,
        no_pessoa: "Ana Teste",
        dt_nascimento: "03/05/1987",
        nu_matriculaCNJ: MATRICULA,
      },
    ],
    NA_PAIS: [
      { ID: 1, NO_MAE: "Beatriz Exemplo", no_profiss_pai: "agricultor" },
    ],
  });
  const changed = structuredClone(must(base));
  must(changed.people[0]).fatherProfession = "pedreiro";
  const other = structuredClone(must(base));
  other.matricula = MATRICULA.replace(/6$/, "7");

  const existing = new Map([[`nascimento:${MATRICULA}`, must(base)]]);
  const same = conferenceOf([must(base)], existing);
  assert.equal(same.counts.igual, 1);
  assert.equal(toPublish(same, new Set()).length, 0);

  const conf = conferenceOf([changed, other], existing);
  assert.deepEqual([conf.counts.alterado, conf.counts.novo], [1, 1]);
  assert.deepEqual(conf.checked[0]?.changes, ["profissão do pai"]);
  assert.equal(toPublish(conf, new Set()).length, 1);
  assert.equal(toPublish(conf, new Set([`nascimento:${MATRICULA}`])).length, 2);
});

test("conferência: em branco no arquivo novo não apaga o que o índice sabe", () => {
  const [base] = readCartosoft({
    NASCIMENTO: [{ ID: 1, no_pessoa: "Ana Teste", nu_matriculaCNJ: MATRICULA }],
    NA_PAIS: [
      { ID: 1, NO_MAE: "Beatriz Exemplo", no_profiss_pai: "agricultor" },
    ],
  });
  const fromXml = structuredClone(must(base));
  must(fromXml.people[0]).fatherProfession = "";
  assert.deepEqual(changedFields(fromXml, must(base)), []);
});

test("conferência: sem nome e repetido ficam de fora; período e livros", () => {
  const records = readCartosoft({
    NASCIMENTO: [
      {
        ID: 1,
        no_pessoa: "",
        nu_livro: "A 2",
        dt_registro: "01/02/1990",
        nu_matriculaCNJ: MATRICULA,
      },
      {
        ID: 2,
        no_pessoa: "Ana",
        nu_livro: "A 10",
        dt_registro: "01/02/2010",
        nu_matriculaCNJ: "1",
      },
      {
        ID: 3,
        no_pessoa: "Ana",
        nu_livro: "A 10",
        dt_registro: "01/02/2010",
        nu_matriculaCNJ: "1",
      },
    ],
  });
  const conf = conferenceOf(records, new Map());
  assert.equal(conf.counts.blocked, 3);
  assert.deepEqual(conf.byKind.nascimento.books, ["A 2", "A 10"]);
  assert.deepEqual(
    [conf.byKind.nascimento.firstYear, conf.byKind.nascimento.lastYear],
    [1990, 2010],
  );
  assert.equal(toPublish(conf, new Set()).length, 0);
});

test("natimorto: óbito do Livro C Auxiliar, contado à parte dentro de óbitos", () => {
  assert.ok(isLivroCAuxiliar("C AUX 2"));
  assert.ok(isLivroCAuxiliar("C-Auxiliar 1"));
  assert.ok(isLivroCAuxiliar("1 C Aux."));
  assert.equal(isLivroCAuxiliar("C 12"), false);
  assert.equal(isLivroCAuxiliar("A 3"), false);
  const records = readCartosoft({
    OBITO: [
      {
        ID: 1,
        nu_livro: "C 10",
        no_pessoa: "Nilo Fictício",
        nu_matriculaCNJ: MATRICULA,
      },
      {
        ID: 2,
        nu_livro: "C AUX 1",
        no_pessoa: "Natimorto de Olga Exemplo",
        nu_matriculaCNJ: "",
      },
    ],
  });
  assert.deepEqual(
    records.map((r) => r.subtype),
    ["", "natimorto"],
  );
  const conf = conferenceOf(records, new Map());
  assert.equal(conf.byKind.obito.count, 2);
  assert.equal(conf.byKind.obito.natimortos, 1);
});
