import assert from "node:assert/strict";
import { test } from "node:test";
import { readCartosoft, sexOf, timeOf, wordOf } from "./cartosoft.ts";
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
  assert.equal(fields.nome, "CRIANÇA FICTÍCIA");
  assert.equal(fields.genitor1, "Mãe Fictícia");
  assert.equal(fields.genitor1Municipio, "Natal");
  assert.equal(fields.dnv, "12345678901");
  assert.equal(fields.hora, "08:05 horas");
  assert.equal(fields.gemeo, undefined, "gêmeo só aparece quando existir");
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
    fields.dataFalecimentoExtenso,
    "primeiro de fevereiro de dois mil e vinte",
  );
  assert.equal(fields.horaFalecimento, "14:30 horas");
  assert.equal(record?.details?.documento, "RG 123 SSP/RN");
  assert.equal(record?.details?.eleitor, "SIM");
  assert.equal(fields.medico, "Médico Fictício");
  assert.equal(fields.medicoDocumento, "CRM 999");
  assert.equal(fields.declarante, "Declarante Fictício");
});

test("hora e sexo como a certidão escreve", () => {
  assert.equal(timeOf("7:5"), "");
  assert.equal(timeOf("07:45"), "07:45");
  assert.equal(sexOf("m"), "MASCULINO");
  assert.equal(sexOf("ignorado"), "ignorado");
  assert.equal(sexOf("1"), "", "código numérico não é adivinhado");
  assert.equal(wordOf("5"), "");
  assert.equal(wordOf("-1"), "");
  assert.equal(wordOf("[brasileira"), "brasileira");
});

test("nascimento: declarante, testemunhas e pais completos", () => {
  const [record] = readCartosoft({
    NASCIMENTO: [{ ID: 4, no_pessoa: "Criança Fictícia", cd_sexo: "1" }],
    NA_PAIS: [
      {
        ID: 4,
        NO_MAE: "Mãe Fictícia",
        dt_nasci_mae: "10/10/1990",
        nu_idade_mae: "23",
        nu_idade_pai: "0",
        no_nac_mae: "[brasileira ",
        no_nac_pai: " ",
        no_ender_mae: "Rua Fictícia, 1",
        no_cidade_ender_mae: "Cidade Fictícia",
        no_uf_ender_mae: "RN",
      },
    ],
    NA_DECLARANTE: [
      {
        ID: 4,
        NO_NOME: "Declarante Fictício",
        nu_docto: "123",
        no_profissao: "agricultor",
      },
    ],
    NA_TESTEMUNHA: [
      {
        ID: 4,
        nome_1: "Testemunha Fictícia",
        documento_1: "456",
        profissao_1: "-1",
      },
    ],
  });
  const d = record?.details ?? {};
  assert.equal(d.sexo, undefined, "0/1 não vira sexo");
  assert.equal(d.genitor1Nascimento, "1990-10-10");
  assert.equal(d.genitor1Idade, "23 anos");
  assert.equal(d.genitor2Idade, undefined, "idade 0 é não informada");
  assert.equal(d.genitor1Nacionalidade, "BRASILEIRA");
  assert.equal(d.genitor2Nacionalidade, undefined);
  assert.equal(d.genitor1Endereco, "Rua Fictícia, 1, Cidade Fictícia/RN");
  assert.equal(d.declarante, "Declarante Fictício");
  assert.equal(d.declaranteQualificacao, "documento 123, agricultor");
  assert.equal(d.testemunha1, "Testemunha Fictícia");
  assert.equal(d.testemunha1Qualificacao, "documento 456");
});

test("casamento: estado civil, residência, juiz, edital e testemunhas", () => {
  const [record] = readCartosoft({
    CASAMENTO: [
      {
        nu_sequencia: 2,
        no_noivo: "Noivo Fictício",
        no_noiva: "Noiva Fictícia",
        estcivil_noivo: "solteiro ",
        estcivil_noiva: "1",
        endereco_noivo: "Rua Fictícia",
        cidade_res_noivo: "Cidade Fictícia",
        estado_res_noivo: "RN",
        ho_casamento: new Date(Date.UTC(1899, 11, 30, 16, 0)),
        no_juiz_paz: "Juiz Fictício",
        nu_processo: "15",
        nu_edital: "15",
        dt_edital: "01/02/2020",
        no_obs: "Ato registrado no livro fictício.",
      },
    ],
    CA_TESTEMUNHAS: [
      {
        nu_sequencia: 2,
        no_testemunha1: "Testemunha Fictícia",
        profissao1: "professora",
        qualif_testemunhas: "Testemunhas: Fulana Fictícia e Beltrano Fictício.",
      },
    ],
  });
  const d = record?.details ?? {};
  assert.equal(d.conjuge1EstadoCivil, "solteiro");
  assert.equal(d.conjuge2EstadoCivil, undefined, "código não é adivinhado");
  assert.equal(d.conjuge1Endereco, "Rua Fictícia, Cidade Fictícia/RN");
  assert.equal(d.horaCasamento, "16:00 horas");
  assert.equal(d.juiz, "Juiz Fictício");
  assert.equal(d.habilitacao, "15");
  assert.equal(d.edital, "nº 15 de 01/02/2020");
  assert.equal(d.testemunha1Qualificacao, "professora");
  assert.equal(
    d.testemunhas,
    "Testemunhas: Fulana Fictícia e Beltrano Fictício.",
  );
  assert.equal(d.observacoes, "Ato registrado no livro fictício.");
});

test("óbito: códigos numéricos ficam em branco; eleitor, causa e filhos", () => {
  const [record] = readCartosoft({
    OBITO: [
      {
        ID: 5,
        no_pessoa: "Falecida Fictícia",
        no_cor: "5",
        est_civil_pessoa: "1",
        idade_pessoa: "80",
        cd_eleitor: "1",
        no_conjuge: "Cônjuge Fictício",
        deixou_filhos: "Filho Um e Filha Dois",
      },
    ],
    OB_ELEITOR: [
      { ID: 5, nu_tit_eleitoral: "123", nu_zona: "6", nu_secao: "7" },
    ],
    OB_MOTIVO_MORTE: [
      { ID: 5, causa_morte1: "Causa A", causa_morte2: "Causa B" },
    ],
  });
  const d = record?.details ?? {};
  assert.equal(d.cor, undefined);
  assert.equal(d.estadoCivil, undefined);
  assert.equal(d.idade, "80 anos");
  assert.equal(d.eleitor, undefined);
  assert.equal(d.tituloEleitor, "título 123, zona 6, seção 7");
  assert.equal(d.causaMorte, "Causa A; Causa B");
  assert.equal(d.conjuge, "Cônjuge Fictício");
  assert.equal(d.filhos, "Filho Um e Filha Dois");
});

test("nascimento na versão nova: naturalidade escrita, CPF e NA_FILIACAO", () => {
  const [record] = readCartosoft({
    NASCIMENTO: [
      {
        ID: 9,
        no_pessoa: "Criança Fictícia",
        dt_registro: "10/10/2022",
        no_cidade: "Cidade do Hospital",
        no_naturalidade: "Cidade da Mãe",
        no_uf_naturalidade: "RN",
        CPF_Registrado: "111.222.333-44",
      },
    ],
    NA_PAIS: [{ ID: 9, NO_MAE: "Mãe Fictícia", nu_cpf_mae: "555" }],
    NA_FILIACAO: [
      {
        IDNA: 9,
        Nome1: "Mãe Fictícia",
        DTNascimento1: "01/01/1990",
        Pai1: "Avô Fictício",
        Mae1: "Avó Fictícia",
        CidadeNatural1: "Natal",
        UFNatural1: "RN",
      },
    ],
  });
  const d = record?.details ?? {};
  assert.equal(d.naturalidade, "Cidade da Mãe");
  assert.equal(d.naturalidadeUf, "RN");
  assert.equal(d.cpf, "111.222.333-44");
  assert.equal(d.genitor1Documento, "CPF 555");
  assert.equal(d.genitor1Nascimento, "1990-01-01");
  assert.equal(d.avos1, "Avô Fictício; Avó Fictícia");
  assert.equal(d.genitor1Municipio, "Natal");
});
