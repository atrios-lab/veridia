import assert from "node:assert/strict";
import { test } from "node:test";
import { readCartosoft, sexOf, timeOf } from "./cartosoft.ts";
import { prefillCertidao } from "./certidao.ts";

// Fictitious registros only (LGPD).
const M = "09461501552014100050123000123456";

test("nascimento: o livro traz o que a certidão imprime", () => {
  const [record] = readCartosoft({
    NASCIMENTO: [
      {
        ID: 7,
        no_pessoa: "Criança Fictícia",
        dt_nascimento: new Date(Date.UTC(2014, 2, 3)),
        ho_nascimento: new Date(Date.UTC(1899, 11, 30, 8, 5)),
        nu_livro: "A-12",
        nu_folha: "34",
        cd_registro: 56,
        dt_registro: "05/03/2014",
        nu_matriculaCNJ: M,
        nu_dn: "12345678901",
        cd_sexo: "F",
        no_cidade: "Cidade Fictícia",
        no_estado: "RN",
        no_local: "Hospital Fictício",
      },
    ],
    NA_PAIS: [
      {
        ID: 7,
        NO_MAE: "Mãe Fictícia",
        NO_PAI: "Pai Fictício",
        no_natural_mae: "Natal",
        no_estado_mae: "RN",
      },
    ],
    NA_AVOS: [{ ID: 7, no_pai_mae: "Avô Materno", no_mae_mae: "Avó Materna" }],
    NA_ANOAVE: [{ ID: 7, TEXTO: "Anotação fictícia.\r\nSegunda linha." }],
  });
  const details = record?.details ?? {};
  assert.equal(details.hora, "08:05 horas");
  assert.equal(details.sexo, "FEMININO");
  assert.equal(details.localNascimento, "Hospital Fictício");
  assert.equal(details.municipioNascimento, "Cidade Fictícia");
  // Registered before the option of Lei nº 13.484/2017: naturalidade is
  // the place of birth.
  assert.equal(details.naturalidade, "Cidade Fictícia");
  assert.equal(details.avos1, "Avô Materno; Avó Materna");
  assert.equal(details.observacoes, "Anotação fictícia.\nSegunda linha.");
  assert.equal("avos2" in details, false, "blank fields are left out");

  const fields = prefillCertidao(
    record ?? {
      kind: "nascimento",
      matricula: "",
      book: "",
      page: "",
      term: "",
      registeredOn: "",
      eventOn: "",
      people: [],
    },
  );
  assert.equal(fields.nome, "Criança Fictícia");
  assert.equal(fields.genitor1, "Mãe Fictícia");
  assert.equal(fields.genitor1Municipio, "Natal");
  assert.equal(fields.dnv, "12345678901");
  assert.equal(fields.hora, "08:05 horas");
  assert.equal(fields.gemeo, "NÃO CONSTA");
});

test("depois de 2017 a naturalidade fica para o livro", () => {
  const [record] = readCartosoft({
    NASCIMENTO: [
      {
        ID: 1,
        no_pessoa: "Outra Criança",
        dt_registro: "10/10/2020",
        no_cidade: "Cidade Fictícia",
      },
    ],
  });
  assert.equal(record?.details?.naturalidade, undefined);
  assert.equal(record?.details?.municipioNascimento, "Cidade Fictícia");
});

test("óbito: data e hora por extenso, documento, médico e declarante", () => {
  const [record] = readCartosoft({
    OBITO: [
      {
        ID: 3,
        nu_registro: 9,
        nu_livro: "C-2",
        nu_folha: "1",
        no_pessoa: "Falecido Fictício",
        dt_falecimento: "01/02/2020",
        hora_falecimento: "14h30",
        dt_cadastro: "02/02/2020",
        nu_matriculaCNJ: M,
        nu_rg: "123",
        orgao_emiss_rg: "SSP",
        uf_rg: "RN",
        cd_eleitor: "S",
        no_medico: "Médico Fictício",
        nu_crm_medico: "999",
      },
    ],
    OB_DECLARANTE: [{ ID: 3, no_declarante: "Declarante Fictício" }],
  });
  const fields = prefillCertidao(
    record ?? {
      kind: "obito",
      matricula: "",
      book: "",
      page: "",
      term: "",
      registeredOn: "",
      eventOn: "",
      people: [],
    },
  );
  assert.equal(
    fields.dataHoraFalecimento,
    "primeiro de fevereiro de dois mil e vinte, às 14:30",
  );
  assert.equal(fields.documento, "RG 123 SSP/RN");
  assert.equal(fields.eleitor, "SIM");
  assert.equal(fields.medico, "Médico Fictício, CRM 999");
  assert.equal(fields.declarante, "Declarante Fictício");
});

test("hora e sexo como a certidão escreve", () => {
  assert.equal(timeOf("7:5"), "");
  assert.equal(timeOf("07:45"), "07:45");
  assert.equal(sexOf("m"), "MASCULINO");
  assert.equal(sexOf("ignorado"), "ignorado");
});
