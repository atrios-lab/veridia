import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveCitations, segmentAnswer } from "./citations.ts";
import { describeOffice } from "./context.ts";
import { describeMasked } from "./copy.ts";
import type { KnowledgeProvision } from "./knowledge/types.ts";
import { maskPersonalData } from "./mask.ts";
import { fillPlaceholders } from "./placeholders.ts";
import {
  effectiveLimit,
  isConversationExpired,
  isOverQuota,
  nextMonthStart,
  usageMonth,
} from "./quota.ts";
import { buildIndex, search } from "./search.ts";

describe("maskPersonalData: what must be hidden", () => {
  const cases: [string, string, string][] = [
    [
      "CPF com pontuação e e-mail",
      "o titular 123.456.789-09 pediu a exclusão, contato maria@exemplo.com",
      "o titular [CPF] pediu a exclusão, contato [E-MAIL]",
    ],
    ["CPF sem pontuação", "cpf do pai 12345678909.", "cpf do pai [CPF]."],
    [
      "CPF com dígito errado, mas com a palavra CPF",
      "CPF: 123.456.789-00",
      "CPF: [CPF]",
    ],
    ["CNPJ", "empresa 11.222.333/0001-81", "empresa [CNPJ]"],
    ["celular com DDD", "ligue (84) 99876-5432", "ligue [TELEFONE]"],
    ["celular com +55", "whats +55 84 998765432", "whats [TELEFONE]"],
    ["fixo sem parênteses", "tel 84 3222-1234", "tel [TELEFONE]"],
    ["celular sem DDD", "fone 98765-4321", "fone [TELEFONE]"],
    ["CEP", "CEP 59000-000", "CEP [CEP]"],
    ["CEP sem hífen depois da palavra", "cep 59000000", "cep [CEP]"],
    [
      "endereço",
      "mora na Rua das Flores, 123, centro",
      "mora na [ENDEREÇO], centro",
    ],
    ["RG", "RG nº 001.234.567", "RG nº [RG]"],
    [
      "título de eleitor",
      "título de eleitor 1234 5678 9012",
      "título de eleitor [TÍTULO]",
    ],
    ["CNH", "CNH 01234567891", "CNH [CNH]"],
    ["PIS", "PIS 120.12345.67-8", "PIS [NIS]"],
    [
      "data de nascimento",
      "nascida em 03/04/1980, pediu",
      "nascida em [NASCIMENTO], pediu",
    ],
    [
      "nascimento por extenso",
      "data de nascimento: 3 de março de 1980",
      "data de nascimento: [NASCIMENTO]",
    ],
    [
      "matrícula do registro civil",
      "matrícula 104539 01 55 2020 1 00012 123 0001234 12",
      "matrícula [MATRÍCULA]",
    ],
    [
      "número longo solto",
      "o número 987654321 do documento",
      "o número [NÚMERO] do documento",
    ],
  ];
  for (const [name, input, expected] of cases) {
    test(name, () => {
      assert.equal(maskPersonalData(input).text, expected);
    });
  }

  test("counts each kind", () => {
    const { counts } = maskPersonalData(
      "123.456.789-09 e 529.982.247-25, a@b.com",
    );
    assert.deepEqual(counts, { email: 1, cpf: 2 });
  });
});

describe("maskPersonalData: what must never change", () => {
  const untouched = [
    "Lei 13.709/2018, art. 18, § 4º",
    "Provimento 213/2026 e Provimento nº 243/2026",
    "prazo até 23/09/2026 e depois 2026-11-15",
    "o protocolo REQ-2026-000123 e o SOL-2026-000045",
    "receita de R$ 1.500.000,00 no semestre, ou R$ 300000",
    "Classe 2, subclasse E, Etapa 1 em 240 dias",
    "PP 0000897-12.2026.2.00.0820",
    "art. 19, II, e art. 41, § 3º, da LGPD",
    "Resolução CD/ANPD nº 15/2024, art. 5º",
    "a Lei 6.015/1973, art. 17, § 1º",
    "IN RFB nº 2.186/2024",
    "uma sequência 12345678901 que não é CPF", // becomes NÚMERO, checked below
  ];
  for (const sentence of untouched.slice(0, -1)) {
    test(sentence, () => {
      assert.equal(maskPersonalData(sentence).text, sentence);
    });
  }

  test("eleven digits with wrong check digits are not taken for a CPF", () => {
    const { text, counts } = maskPersonalData("sequência 12345678901 aqui");
    assert.equal(counts.cpf, undefined);
    assert.equal(text, "sequência [NÚMERO] aqui");
  });
});

describe("describeMasked", () => {
  test("lists the kinds in words", () => {
    assert.equal(
      describeMasked({ cpf: 1, email: 1 }),
      "Ocultamos 1 e-mail e 1 CPF desta mensagem.",
    );
    assert.equal(
      describeMasked({ phone: 2 }),
      "Ocultamos 2 telefones desta mensagem.",
    );
    assert.equal(describeMasked({}), "");
  });
});

describe("fillPlaceholders", () => {
  test("fills what it has and leaves the rest visible", () => {
    assert.equal(
      fillPlaceholders(
        "Prezado(a) [TITULAR], protocolo [PROTOCOLO]. [ENCARREGADO]",
        {
          TITULAR: "Fulana de Tal",
          PROTOCOLO: "REQ-2026-000001",
          ENCARREGADO: "  ",
        },
      ),
      "Prezado(a) Fulana de Tal, protocolo REQ-2026-000001. [ENCARREGADO]",
    );
  });

  test("leaves unknown markers and COMPLETAR alone", () => {
    assert.equal(
      fillPlaceholders("[COMPLETAR: dados encontrados] [CPF]", {
        TITULAR: "x",
      }),
      "[COMPLETAR: dados encontrados] [CPF]",
    );
  });
});

describe("quota", () => {
  test("counts by the office's month, not UTC's", () => {
    // 22h of 30/11 in Fortaleza is 01h of 01/12 in UTC.
    assert.equal(usageMonth(new Date("2026-12-01T01:00:00Z")), "2026-11");
    assert.equal(usageMonth(new Date("2026-12-01T03:00:00Z")), "2026-12");
  });

  test("next month start crosses the year", () => {
    assert.equal(nextMonthStart("2026-11"), "2026-12-01");
    assert.equal(nextMonthStart("2026-12"), "2027-01-01");
  });

  test("default limit and the ceiling", () => {
    assert.equal(effectiveLimit(null), 300);
    assert.equal(effectiveLimit(500), 500);
    assert.equal(isOverQuota(299, 300), false);
    assert.equal(isOverQuota(300, 300), true);
  });

  test("conversations expire twelve months after the last message", () => {
    const last = new Date("2025-11-15T12:00:00Z");
    assert.equal(
      isConversationExpired(last, new Date("2026-11-15T11:00:00Z")),
      false,
    );
    assert.equal(
      isConversationExpired(last, new Date("2026-11-15T13:00:00Z")),
      true,
    );
  });
});

describe("resolveCitations", () => {
  test("keeps delivered ids and removes invented ones", () => {
    const result = resolveCitations(
      "O titular pode pedir [[fonte:lgpd-art-18]]. Prazo de 15 dias [[fonte:lgpd-art-99]].",
      new Set(["lgpd-art-18"]),
    );
    assert.equal(
      result.text,
      "O titular pode pedir [[fonte:lgpd-art-18]]. Prazo de 15 dias.",
    );
    assert.deepEqual(result.cited, ["lgpd-art-18"]);
    assert.deepEqual(result.invalid, ["lgpd-art-99"]);
  });

  test("segments text and sources", () => {
    assert.deepEqual(segmentAnswer("A [[fonte:x-1]] b"), [
      { kind: "text", text: "A " },
      { kind: "source", id: "x-1" },
      { kind: "text", text: " b" },
    ]);
  });
});

describe("search", () => {
  const base: KnowledgeProvision[] = [
    {
      id: "lgpd-art-16",
      source: "lgpd",
      citation: "LGPD, art. 16",
      text: "Os dados pessoais serão eliminados após o término de seu tratamento, autorizada a conservação para cumprimento de obrigação legal ou regulatória pelo controlador.",
    },
    {
      id: "lgpd-art-41",
      source: "lgpd",
      citation: "LGPD, art. 41",
      text: "O controlador deverá indicar encarregado pelo tratamento de dados pessoais.",
    },
    {
      id: "prov213-art-20",
      source: "prov213",
      citation: "Provimento 213/2026, art. 20",
      text: "A Etapa 1 deverá ser concluída no prazo de 300, 240 ou 180 dias, conforme a classe.",
    },
  ];
  const index = buildIndex(base);

  test("finds elimination for a question about deleting", () => {
    assert.equal(
      search(index, "titular quer exclusão e eliminação dos dados")[0]?.id,
      "lgpd-art-16",
    );
  });

  test("finds the stage deadline", () => {
    assert.equal(search(index, "prazo da etapa 1")[0]?.id, "prov213-art-20");
  });

  test("finds the officer", () => {
    assert.equal(search(index, "indicar encarregado")[0]?.id, "lgpd-art-41");
  });

  test("nothing for an empty query", () => {
    assert.deepEqual(search(index, "de da do"), []);
  });
});

describe("describeOffice", () => {
  test("carries figures, never a person", () => {
    const text = describeOffice({
      attributions: ["RCPN", "NOTAS"],
      classification: null,
      pendencies: { critical: 2, warning: 1, info: 0 },
      openDataRights: 3,
      dataRightsDueSoon: 1,
      hasDpo: true,
      today: "2026-11-15",
    });
    assert.match(text, /Classe no Provimento 213\/2026: desconhecida/);
    assert.match(text, /Requerimentos LGPD em aberto: 3/);
    assert.match(text, /tem encarregado/);
    assert.doesNotMatch(text, /@/);
  });
});
