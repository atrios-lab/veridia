import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanLearned,
  cleanStyle,
  mergeReview,
  newLearned,
  type ReviewResult,
  reviewHeadline,
  revokedCitations,
  revokerIn,
} from "./revisao.ts";

// Fictitious notes and norms only.
const REVOKED = [
  {
    norm: { kind: "provimento", number: "12", year: "2001" },
    label: "Provimento nº 12/2001",
    by: "Provimento nº 99/2020",
  },
];

test("a base acha na hora a norma revogada citada na nota", () => {
  const text =
    "NOTA DEVOLUTIVA\n1. Apresentar certidão atualizada, conforme o Provimento nº 12/2001, art. 3º.\n2. Recolher o ITBI.";
  const found = revokedCitations(text, REVOKED);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.kind, "revogada");
  assert.equal(found[0]?.source, "base");
  assert.match(found[0]?.problem ?? "", /revogada por Provimento nº 99\/2020/);
  assert.match(found[0]?.excerpt ?? "", /Provimento nº 12\/2001/);
  assert.equal(
    revokedCitations("Conforme o Provimento nº 13/2001.", REVOKED).length,
    0,
  );
});

test("quem revogou sai da nota da fonte", () => {
  assert.equal(
    revokerIn(
      "Revogada por Provimento nº 99/2020 (identificado no texto da base em 15/11/2026).",
    ),
    "Provimento nº 99/2020",
  );
  assert.equal(revokerIn("Sem observações."), undefined);
});

const ai = (over: Partial<ReviewResult> = {}): ReviewResult => ({
  recommendation: "manter",
  summary: "A nota está de acordo com a lei.",
  findings: [],
  learned: [],
  style: [],
  ...over,
});

test("norma revogada pela base pede alterar, mesmo que o Assistente Virtual diga manter", () => {
  const base = revokedCitations("Conforme o Provimento nº 12/2001.", REVOKED);
  const merged = mergeReview(base, ai());
  assert.equal(merged.recommendation, "alterar");
  assert.equal(reviewHeadline(merged), "1 ponto de atenção");
  assert.equal(
    reviewHeadline(mergeReview([], ai())),
    "Nenhuma divergência encontrada",
  );
  assert.equal(mergeReview([], null).recommendation, "manter");
});

test("o mesmo achado da base e do Assistente Virtual aparece uma vez só", () => {
  const base = revokedCitations("Conforme o Provimento nº 12/2001.", REVOKED);
  const merged = mergeReview(
    base,
    ai({
      findings: [
        { ...(base[0] as (typeof base)[number]), source: "ia" },
        {
          kind: "atencao",
          excerpt: "prazo de 10 dias",
          problem: "O prazo citado não é o da lei.",
          basis: "Lei nº 6.015/1973, art. 188",
          suggestion: "Use o prazo da lei.",
          source: "ia",
        },
      ],
    }),
  );
  assert.equal(merged.findings.length, 2);
});

test("aprende só exigência genérica, com fundamento e sem dado pessoal", () => {
  const learned = cleanLearned([
    {
      title: "Apresentar o CCIR atual",
      description:
        "Falta o Certificado de Cadastro de Imóvel Rural do exercício.",
      howToComply: "Junte o CCIR quitado do exercício atual.",
      basis: "Lei nº 6.015/1973, art. 176, § 1º, II, 3, a",
    },
    {
      title: "Corrigir o CPF do requerente",
      description: "O CPF 123.456.789-09 está divergente da matrícula.",
      howToComply: "Apresente documento com o CPF correto.",
      basis: "Lei nº 6.015/1973, art. 176",
    },
    {
      title: "Sem fundamento",
      description: "Algo a fazer.",
      howToComply: "Fazer algo.",
      basis: "",
    },
  ]);
  assert.equal(learned.length, 1);
  assert.equal(learned[0]?.title, "Apresentar o CCIR atual");
  assert.match(learned[0]?.basis ?? "", /6\.015\/1973/);
});

test("não aprende de novo o que a biblioteca já tem", () => {
  const items = cleanLearned([
    {
      title: "Apresentar o CCIR atual",
      description: "Falta o certificado do exercício.",
      howToComply: "Junte o CCIR quitado.",
      basis: "Lei nº 10.267/2001",
    },
    {
      title: "Recolher o ITBI",
      description: "Falta a guia do imposto paga.",
      howToComply: "Junte a guia quitada.",
      basis: "Código Tributário Nacional, art. 35",
    },
  ]);
  const fresh = newLearned(["APRESENTAR O CCIR ATUAL"], items);
  assert.deepEqual(
    fresh.map((i) => i.title),
    ["Recolher o ITBI"],
  );
});

test("o estilo aprendido é curto e sem dados", () => {
  const style = cleanStyle([
    "Abre com o número da nota, o protocolo e a data, em caixa alta.",
    "Contato: fulano@exemplo.com",
    "curto",
  ]);
  assert.deepEqual(style, [
    "Abre com o número da nota, o protocolo e a data, em caixa alta.",
  ]);
});
