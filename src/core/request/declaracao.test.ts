import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import { buildDeclaracao, buildDeclaracoes } from "./declaracao.ts";
import type { ExemptionDeclaration } from "./kinds.ts";

const gratuidade = getAct("gratuidade-rcpn");
if (!gratuidade) throw new Error("catalogo incompleto");

function flatten(
  sections: ReturnType<typeof buildDeclaracao>["sections"],
): string {
  return sections
    .flatMap((s) => [
      s.heading,
      ...(s.rows ?? []).map((r) => `${r.label}: ${r.value}`),
      ...(s.fields ?? []).map((f) => `${f.label}: ${f.value ?? ""}`),
      ...(s.paragraphs ?? []),
    ])
    .join("\n");
}

test("o formulário em branco tem sete blocos, todos vazios", () => {
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, undefined, 0);
  assert.equal(doc.subtitle, "Formulário em branco");
  assert.equal(doc.signee, undefined);
  // Blocos 1 a 5, 8 e 9: 6 e 7 (representante/rogo) só aparecem com alguém
  // para nomear, e sem exemption nenhuma não há.
  assert.equal(doc.sections.length, 7);
  const texto = flatten(doc.sections);
  assert.match(texto, /1\. Dados da serventia/);
  assert.match(texto, /Serventia: Cartório Marinho/);
  assert.match(texto, /9\. Certificação da presença/);
  // Nenhum ato aparece marcado.
  assert.doesNotMatch(texto, /\[X\]/);
  assert.match(texto, /\[ \] Certidão/);
});

test("declaração da própria pessoa marca o ato pedido e assina embaixo", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "com-busca",
    beneficiaries: [{ name: "Maria José da Silva", signedBy: "self" }],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0, {
    protocolNumber: "REQ.2026.000148",
    createdAt: new Date("2026-09-10T12:00:00Z"),
  });
  assert.equal(doc.signee, "Maria José da Silva");
  const texto = flatten(doc.sections);
  assert.match(texto, /Nome completo: Maria José da Silva/);
  assert.match(texto, /\[X\] Certidão/);
  assert.match(texto, /\[X\] Com busca/);
  assert.match(texto, /\[ \] Habilitação/);
  // Sem representante nem a rogo: os blocos 6 e 7 não aparecem.
  assert.doesNotMatch(texto, /6\. Representante/);
  assert.doesNotMatch(texto, /7\. Assinatura a rogo/);
});

test("representante legal aparece separado do beneficiário", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-alteracao-prenome",
    beneficiaries: [
      {
        name: "João Pequeno",
        signedBy: "legal-representative",
        signer: { name: "Ana Grande", capacity: "mãe" },
      },
    ],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc.sections);
  assert.match(texto, /Nome completo: João Pequeno/);
  assert.match(texto, /6\. Representante legal ou assistente/);
  assert.match(texto, /Nome completo: Ana Grande/);
  assert.match(texto, /Qualidade em que atua: mãe/);
  // O beneficiário assina embaixo (bloco 5), não o representante.
  assert.equal(doc.signee, "João Pequeno");
});

test("a rogo pelo site sai com quem assina e testemunhas em branco", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "sem-busca",
    beneficiaries: [
      {
        name: "Maria José da Silva",
        signedBy: "on-behalf",
        signer: { name: "João da Silva" },
      },
    ],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc.sections);
  assert.match(texto, /7\. Assinatura a rogo/);
  assert.match(texto, /Nome de quem assina a rogo: João da Silva/);
  assert.match(texto, /Testemunha 1 · Nome: \s*$/m);
  assert.match(texto, /Impressão digital da pessoa beneficiária/);
});

test("a rogo pelo balcão sai com as duas testemunhas preenchidas", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "sem-busca",
    beneficiaries: [
      {
        name: "Maria José da Silva",
        signedBy: "on-behalf",
        signer: { name: "João da Silva" },
        witnesses: [{ name: "T1" }, { name: "T2" }],
      },
    ],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc.sections);
  assert.match(texto, /Testemunha 1 · Nome: T1/);
  assert.match(texto, /Testemunha 2 · Nome: T2/);
});

test("habilitação de casamento gera dois documentos, um por nubente", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-habilitacao-casamento",
    beneficiaries: [
      { name: "Maria José da Silva", signedBy: "self" },
      { name: "João Paulo Souza", signedBy: "self" },
    ],
  };
  const docs = buildDeclaracoes(cartorioMarinho, gratuidade, exemption);
  assert.equal(docs.length, 2);
  assert.equal(docs[0].signee, "Maria José da Silva");
  assert.equal(docs[1].signee, "João Paulo Souza");
});

test("pedido v1, sem beneficiários, sai em branco menos o ato e a data", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-08-04T12:00:00.000Z",
    actId: "rcpn-certidao",
    beneficiaries: [],
  };
  const docs = buildDeclaracoes(cartorioMarinho, gratuidade, exemption, {
    protocolNumber: "REQ.2026.000042",
    createdAt: new Date("2026-08-04T12:00:00Z"),
  });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].signee, undefined);
  const texto = flatten(docs[0].sections);
  assert.match(texto, /\[X\] Certidão/);
  assert.match(texto, /Nome completo: \s*$/m);
  assert.match(docs[0].subtitle, /REQ\.2026\.000042/);
});

test("nem CadÚnico nem chave de acesso aparecem na declaração", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "sem-busca",
    beneficiaries: [{ name: "Maria José da Silva", signedBy: "self" }],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc.sections);
  assert.doesNotMatch(texto, /CadÚnico/);
  assert.doesNotMatch(texto, /chave de acesso/i);
  assert.doesNotMatch(texto, /[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
});
