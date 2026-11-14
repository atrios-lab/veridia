import assert from "node:assert/strict";
import { test } from "node:test";
import { placeOf, readCargaXml } from "./carga-xml.ts";
import { prefillCertidao } from "./certidao.ts";

// Fictitious registros only (LGPD). Matrícula: CNS 094615, acervo 01,
// serviço 55, ano 2014, tipo de livro, livro 00005, folha 012, termo
// 0000123, dígito 45 (fictitious).
const M = (type: string) => `09461501552014${type}00005012000012345`;

test("matrícula: livro, folha e termo", () => {
  assert.deepEqual(placeOf(M("1")), {
    book: "A-5",
    page: "12",
    term: "123",
    bookType: "1",
  });
  assert.equal(placeOf(M("5")).book, "C Auxiliar-5");
  assert.equal(placeOf("123").book, "");
});

test("carga de casamento: cônjuges, nome adotado, regime e livro B", () => {
  const { records, unknownMovements } = readCargaXml({
    CARGAREGISTROS: {
      MOVIMENTOCASAMENTOTC: {
        REGISTROCASAMENTOINCLUSAO: {
          NOMECONJUGE1: "Noivo Fictício",
          NOVONOMECONJUGE1: "",
          DATANASCIMENTOCONJUGE1: "01/02/1990",
          NOMEPAICONJUGE1: "Pai Um",
          NOMEMAECONJUGE1: "Mãe Um",
          TEXTOLIVREMUNNATCONJUGE1: "Natal/RN",
          NOMECONJUGE2: "Noiva Fictícia",
          NOVONOMECONJUGE2: "Noiva Fictícia Casada",
          MATRICULA: M("2"),
          DATAREGISTRO: "10/10/2014",
          DATACASAMENTO: "10/10/2014",
          REGIMECASAMENTO: "COMUNHAO_PARCIAL",
        },
      },
    },
  });
  assert.deepEqual(unknownMovements, []);
  const [r] = records;
  assert.equal(r?.kind, "casamento");
  assert.equal(r?.book, "B-5");
  assert.equal(r?.people[1]?.marriedName, "Noiva Fictícia Casada");
  assert.equal(r?.details?.regime, "Comunhão parcial de bens");
  assert.match(r?.details?.conjuges ?? "", /natural de Natal\/RN/);
});

test("carga de óbito: natimorto pelo livro C Auxiliar e a certidão preenchida", () => {
  const { records } = readCargaXml({
    CARGAREGISTROS: {
      MOVIMENTOOBITOTO: {
        REGISTROOBITOINCLUSAO: [
          {
            NOMEFALECIDO: "Falecido Fictício",
            MATRICULA: M("4"),
            DATAREGISTRO: "02/03/2020",
            DATAOBITO: "01/03/2020",
            HORAOBITO: "07:30",
            SEXO: "M",
            CORPELE: "IGNORADA",
            ESTADOCIVIL: "CASADO",
            IDADE: "80",
            IDADE_DIAS_MESES_ANOS: "A",
            ELEITOR: "S",
            LUGARSEPULTAMENTOCEMITERIO: "Cemitério Fictício",
            NOMEDECLARANTE: "Declarante Fictício",
            NOMEATESTANTEPRIMARIO: "Médico Fictício",
            CRMATESTANTEPRIMARIO: "999",
            CAUSAMORTEANTECEDENTES_A: "Causa fictícia",
            DOCUMENTOS: {
              DONO: "FALECIDO",
              TIPO_DOC: "RG",
              NUMERO: "123",
              UF_EMISSAO: "RN",
            },
          },
          { NOMEFALECIDO: "Natimorto Fictício", MATRICULA: M("5") },
        ],
      },
    },
  });
  const [obito, natimorto] = records;
  assert.equal(natimorto?.subtype, "natimorto");
  assert.equal(obito?.book, "C-5");
  const fields = prefillCertidao(
    obito ?? {
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
  assert.equal(fields.sexo, "MASCULINO");
  assert.equal(fields.cor, undefined, "IGNORADA fica para o livro");
  assert.equal(fields.estadoCivilIdade, "casado(a), 80 anos");
  assert.equal(fields.eleitor, "SIM");
  assert.equal(fields.documento, "RG 123 RN");
  assert.equal(fields.medico, "Médico Fictício, CRM 999");
  assert.equal(fields.causaMorte, "Causa fictícia");
  assert.equal(
    fields.dataHoraFalecimento,
    "primeiro de março de dois mil e vinte, às 07:30",
  );
});

test("carga de nascimento: filiação completa, nacionalidade e gêmeos", () => {
  const { records } = readCargaXml({
    CARGAREGISTROS: {
      MOVIMENTONASCIMENTOTN: {
        REGISTRONASCIMENTOINCLUSAO: {
          NOMEREGISTRADO: "Registrada Fictícia",
          MATRICULA: M("1"),
          DATAREGISTRO: "05/05/2014",
          DATANASCIMENTO: "01/05/2014",
          NACIONALIDADE: "076",
          POSSUIGEMEOS: "S",
          NUMEROGEMEOS: "1",
          FILIACAONASCIMENTO: [
            {
              NOME: "Mãe Fictícia",
              SEXO: "F",
              DATANASCIMENTO: "10/10/1990",
              IDADE: "23",
              IDADE_DIAS_MESES_ANOS: "A",
              NACIONALIDADE: "076",
              LOGRADOURO: "Rua Fictícia",
              BAIRRO: "Centro",
              TEXTOLIVREMUNICIPIONAT: "Cidade Fictícia",
            },
            { NOME: "Pai Fictício", SEXO: "M", NACIONALIDADE: "999" },
          ],
        },
      },
    },
  });
  const d = records[0]?.details ?? {};
  assert.equal(d.nacionalidade, "BRASILEIRA");
  assert.equal(d.gemeo, "SIM");
  assert.equal(d.genitor1Nascimento, "1990-10-10");
  assert.equal(d.genitor1Idade, "23 anos");
  assert.equal(d.genitor1Endereco, "Rua Fictícia, Centro");
  assert.equal(d.genitor1Municipio, "Cidade Fictícia");
  assert.equal(
    d.genitor2Nacionalidade,
    undefined,
    "código desconhecido fica em branco",
  );
});

test("carga de óbito: tipo de morte, bens, DO e benefício", () => {
  const { records } = readCargaXml({
    CARGAREGISTROS: {
      MOVIMENTOOBITOTO: {
        REGISTROOBITOINCLUSAO: {
          NOMEFALECIDO: "Falecida Fictícia",
          MATRICULA: M("4"),
          TIPOMORTE: "NATURAL",
          POSSUIBENS: "N",
          NUMDECLARACAOOBITO: "123456",
          BENEFICIOS_PREVIDENCIARIOS: { NUMEROBENEFICIO: "999" },
          LOGRADOURO: "Rua Fictícia",
        },
      },
    },
  });
  const d = records[0]?.details ?? {};
  assert.equal(d.tipoMorte, "NATURAL");
  assert.equal(d.bens, "NÃO");
  assert.equal(d.numeroDO, "123456");
  assert.equal(d.beneficio, "999");
  assert.equal(d.endereco, "Rua Fictícia");
});
