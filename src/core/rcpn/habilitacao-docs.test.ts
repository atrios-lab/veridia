import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHabilitacaoDocument,
  documentBlocker,
  editalForSite,
} from "./habilitacao-docs.ts";

// Fictitious office and nubentes only (LGPD).
const TENANT = {
  officialName: "Cartório Fictício",
  name: "Cartório Fictício",
  subtitle: "Registro Civil",
  location: { city: "Cidade Fictícia", state: "RN" },
  legalFooter: "Rodapé fictício",
  holderName: "Oficial Fictícia",
  holderTitle: "Oficiala",
} as Parameters<typeof editalForSite>[0];

const VALUES = {
  tipo: "civil",
  requeridoEm: "2026-11-10",
  "n1.nome": "Ana Exemplo",
  "n1.sexo": "F",
  "n1.estadoCivil": "solteiro",
  "n1.profissao": "Professora",
  "n1.cpf": "111.222.333-44",
  "n1.endereco": "Rua Fictícia, 10",
  "n1.domicilio": "Cidade Fictícia/RN",
  "n1.filiacao1": "Mãe Fictícia",
  "n1.nomeApos": "Ana Exemplo Modelo",
  "n2.nome": "Bia Modelo",
  "n2.estadoCivil": "divorciado",
  "n2.domicilio": "Outra Cidade/RN",
  regime: "comunhao-parcial",
  "t1.nome": "Testemunha Um",
  "t2.nome": "Testemunha Dois",
  editalEm: "2026-11-12",
  certificadoEm: "2026-11-14",
};

const text = (doc: ReturnType<typeof buildHabilitacaoDocument>) =>
  doc.sections.flatMap((s) => s.paragraphs ?? []).join("\n");

test("o edital traz só nome, estado civil, filiação e domicílio (CNN, art. 122)", () => {
  const { title, body } = editalForSite(TENANT, {
    values: VALUES,
    number: "3/2026",
  });
  assert.match(title, /Edital de proclamas nº 3\/2026/);
  assert.match(
    body,
    /ANA EXEMPLO, solteira, filha de Mãe Fictícia, domiciliada em Cidade Fictícia\/RN/,
  );
  assert.match(
    body,
    /BIA MODELO, divorciado\(a\), domiciliado\(a\) em Outra Cidade\/RN/,
  );
  for (const hidden of ["Professora", "111.222.333-44", "Rua Fictícia"]) {
    assert.ok(!body.includes(hidden), `${hidden} não vai para o edital`);
  }
  const conversion = editalForSite(TENANT, {
    values: { ...VALUES, tipo: "conversao" },
    number: "4/2026",
  });
  assert.match(
    conversion.body,
    /conversão de sua união estável em casamento \(Lei nº 6\.015\/1973, art\. 70-A, § 1º\)/,
  );
});

test("o requerimento qualifica, declara e leva as assinaturas de cada caso", () => {
  const doc = buildHabilitacaoDocument("requerimento", TENANT, {
    number: "3/2026",
    values: { ...VALUES, "n2.assina": "sim", "n2.rogo": "Pessoa a Rogo" },
    today: "2026-11-14",
  });
  const all = text(doc);
  assert.match(all, /ANA EXEMPLO, solteira, professora/);
  assert.match(all, /ANA EXEMPLO passará a usar o nome ANA EXEMPLO MODELO/);
  assert.match(all, /BIA MODELO continuará a usar o mesmo nome/);
  assert.match(all, /material informativo/);
  assert.deepEqual(
    doc.signatures?.map((s) => s.role),
    [
      "1º nubente",
      "a rogo de Bia Modelo, que não sabe ou não pode assinar",
      "impressão digital",
    ],
  );
  assert.equal(doc.dateLine, "Cidade Fictícia/RN, 10 de novembro de 2026.");
});

test("o certificado diz até quando vale (90 dias) e onde casar", () => {
  const doc = buildHabilitacaoDocument("certificado", TENANT, {
    number: "3/2026",
    values: VALUES,
    today: "2026-11-14",
  });
  const all = text(doc);
  assert.match(
    all,
    /a contar de 14 de novembro de 2026, até 12 de fevereiro de 2027 \(Código Civil, art\. 1\.532\)/,
  );
  assert.match(all, /qualquer serventia/);
  assert.equal(doc.signee, "Oficial Fictícia");
  const religioso = text(
    buildHabilitacaoDocument("certificado", TENANT, {
      number: "3/2026",
      values: { ...VALUES, tipo: "religioso" },
      today: "2026-11-14",
    }),
  );
  assert.match(
    religioso,
    /90 \(noventa\) dias da celebração.*art\. 1\.516, § 1º/,
  );
});

test("o que falta para cada documento sair", () => {
  assert.match(
    documentBlocker("certidao-edital", { ...VALUES, editalEm: "" }) ?? "",
    /Publique o edital/,
  );
  assert.match(
    documentBlocker("certificado", { ...VALUES, tipo: "conversao" }) ?? "",
    /art\. 70-A/,
  );
  assert.match(
    documentBlocker("certificado", { ...VALUES, certificadoEm: "" }) ?? "",
    /Extrair certificado hoje/,
  );
  assert.equal(documentBlocker("certificado", VALUES), null);
  assert.equal(documentBlocker("requerimento", {}), null);
});
