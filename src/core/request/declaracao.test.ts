import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import {
  buildDeclaracao,
  buildDeclaracoes,
  buildStamp,
  type DeclaracaoDocument,
  type FormBlock,
} from "./declaracao.ts";
import type { ExemptionDeclaration } from "./kinds.ts";

const gratuidade = getAct("gratuidade-rcpn");
if (!gratuidade) throw new Error("catalogo incompleto");

function block(doc: DeclaracaoDocument, number: number): FormBlock | undefined {
  return doc.blocks.find((b) => b.number === number);
}

/** Every printable string in a document, blocks and stamp both, for the
 * assertions that just check some text is (or is not) somewhere in the
 * paper. */
function flatten(doc: DeclaracaoDocument): string {
  const parts: string[] = [];
  for (const b of doc.blocks) {
    parts.push(`${b.number}. ${b.heading}`);
    for (const content of b.content) {
      switch (content.type) {
        case "fields":
          for (const field of content.columns) {
            parts.push(`${field.label}: ${field.value ?? ""}`);
          }
          break;
        case "checklist":
          for (const item of content.items) {
            parts.push(`${item.checked ? "[X]" : "[ ]"} ${item.label}`);
            for (const sub of item.sub ?? []) {
              parts.push(`${sub.checked ? "[X]" : "[ ]"} ${sub.label}`);
            }
          }
          break;
        case "paragraph":
          parts.push(content.text);
          break;
        case "list":
          parts.push(...content.items);
          break;
        case "signature":
          parts.push(`${content.label}: ${content.value ?? ""}`);
          break;
        case "fingerprint":
          parts.push(content.text);
          break;
        case "aside":
          parts.push(content.heading);
          for (const field of content.fields) {
            parts.push(`${field.label}: ${field.value ?? ""}`);
          }
          break;
      }
    }
  }
  if (doc.stamp) {
    parts.push(doc.stamp.heading, doc.stamp.badge, ...doc.stamp.paragraphs);
    for (const fact of doc.stamp.facts)
      parts.push(`${fact.label}: ${fact.value}`);
  }
  return parts.join("\n");
}

test("o formulário em branco tem os nove blocos, os blocos 6 e 7 inclusive, sem carimbo", () => {
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, undefined, 0);
  assert.equal(doc.protocolNumber, undefined);
  assert.equal(doc.stamp, undefined);
  assert.deepEqual(doc.footer, [doc.legalBasis]);
  assert.deepEqual(
    doc.blocks.map((b) => b.number),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  const texto = flatten(doc);
  assert.match(texto, /Serventia: Cartório Marinho/);
  assert.match(texto, /9\. Certificação da presença/);
  // Nenhum ato aparece marcado.
  assert.doesNotMatch(texto, /\[X\]/);
  assert.match(texto, /\[ \] Certidão de nascimento/);
});

test("declaração da própria pessoa marca o item certo e não traz os blocos 6 e 7", () => {
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
  const texto = flatten(doc);
  assert.match(texto, /Nome completo: Maria José da Silva/);
  assert.match(texto, /\[X\] Certidão de nascimento/);
  assert.match(texto, /\[X\] Com busca/);
  assert.match(texto, /\[ \] Habilitação/);
  assert.match(texto, /\[ \] Outro ato com previsão legal/);
  assert.equal(block(doc, 6), undefined);
  assert.equal(block(doc, 7), undefined);
  // O beneficiário assina no próprio bloco 5.
  const b5 = block(doc, 5);
  assert.ok(b5);
  assert.match(
    flatten({ ...doc, blocks: [b5 as FormBlock] }),
    /Maria José da Silva/,
  );
});

test("certidão sem busca marca só o próprio tipo", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "sem-busca",
    beneficiaries: [{ name: "Maria José da Silva", signedBy: "self" }],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc);
  assert.match(texto, /\[X\] Sem busca/);
  assert.match(texto, /\[ \] Com busca/);
  assert.match(texto, /\[ \] Inteiro teor/);
});

test("representante legal aparece separado do beneficiário, com a frase fixa", () => {
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
  const b6 = block(doc, 6);
  assert.ok(b6);
  const texto = flatten(doc);
  assert.match(texto, /Nome completo: João Pequeno/);
  assert.match(texto, /Nome completo: Ana Grande/);
  assert.match(
    texto,
    /Qualidade em que atua \(Ex\.: responsável legal, tutor, curador ou assistente\): mãe/,
  );
  assert.match(texto, /Declaro que atuo em nome ou em assistência/);
  assert.equal(block(doc, 7), undefined);
});

test("a rogo pelo site sai com quem assina, telefone e testemunhas em branco", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "sem-busca",
    beneficiaries: [
      {
        name: "Maria José da Silva",
        signedBy: "on-behalf",
        signer: { name: "João da Silva", contact: "(84) 99999-0000" },
      },
    ],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc);
  assert.match(texto, /A pedido da pessoa beneficiária, assino/);
  assert.match(texto, /Nome de quem assina a rogo: João da Silva/);
  assert.match(texto, /Telefone ou e-mail: \(84\) 99999-0000/);
  assert.match(
    texto,
    /Impressão digital da pessoa beneficiária, quando possível/,
  );
  const b8 = block(doc, 8);
  assert.ok(b8);
  assert.match(
    flatten({ ...doc, blocks: [b8 as FormBlock] }),
    /Testemunha 1 · Nome: \n/,
  );
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
        witnesses: [
          { name: "T1", contact: "84999990001" },
          { name: "T2", contact: "84999990002" },
        ],
      },
    ],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc);
  assert.match(texto, /Testemunha 1 · Nome: T1/);
  assert.match(texto, /Telefone ou e-mail: 84999990001/);
  assert.match(texto, /Testemunha 2 · Nome: T2/);
});

test("habilitação de casamento gera dois documentos, um por nubente, cada um com o próprio carimbo", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-11T09:41:00.000Z",
    actId: "rcpn-habilitacao-casamento",
    beneficiaries: [
      { name: "Maria José da Silva", signedBy: "self" },
      { name: "João Paulo Souza", signedBy: "self" },
    ],
  };
  const stamps = exemption.beneficiaries.map((_, index) =>
    buildStamp({
      tenantSlug: cartorioMarinho.slug,
      protocolNumber: "REQ.2026.000300",
      channel: undefined,
      exemption,
      beneficiaryIndex: index,
    }),
  );
  const docs = buildDeclaracoes(cartorioMarinho, gratuidade, exemption, {
    protocolNumber: "REQ.2026.000300",
    stamps,
  });
  assert.equal(docs.length, 2);
  assert.ok(docs[0].stamp);
  assert.ok(docs[1].stamp);
  // Um só aceite, feito no mesmo instante para os dois nubentes: o hash é o
  // do pedido inteiro, e sai igual nas duas declarações que ele produz.
  assert.equal(docs[0].stamp?.hash, docs[1].stamp?.hash);
  assert.equal(docs[0].stamp?.facts[2].value, "A própria pessoa");
  assert.equal(docs[1].stamp?.facts[2].value, "A própria pessoa");
  assert.match(flatten(docs[0]), /Nome completo: Maria José da Silva/);
  assert.match(flatten(docs[1]), /Nome completo: João Paulo Souza/);
  assert.deepEqual(docs[0].footer.length, 2);
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
  const texto = flatten(docs[0]);
  assert.match(texto, /\[X\] Certidão de nascimento/);
  assert.match(texto, /Nome completo: \n/);
  assert.equal(docs[0].protocolNumber, "REQ.2026.000042");
});

test("o bloco 5 não fala em aceite eletrônico: isso vive só no carimbo", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    beneficiaries: [{ name: "Maria José da Silva", signedBy: "self" }],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const b5 = block(doc, 5);
  assert.ok(b5);
  const texto = flatten({ ...doc, blocks: [b5 as FormBlock] });
  assert.doesNotMatch(texto, /aceite/i);
  assert.doesNotMatch(texto, /eletrônic/i);
});

test("nem CadÚnico nem chave de acesso aparecem na declaração", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-10T12:00:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "sem-busca",
    beneficiaries: [{ name: "Maria José da Silva", signedBy: "self" }],
  };
  const doc = buildDeclaracao(cartorioMarinho, gratuidade, exemption, 0);
  const texto = flatten(doc);
  assert.doesNotMatch(texto, /CadÚnico/);
  assert.doesNotMatch(texto, /chave de acesso/i);
  assert.doesNotMatch(texto, /[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
});

test("buildStamp: canal, aceite e hash", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-11T09:41:00.000Z",
    actId: "rcpn-certidao",
    certificateType: "sem-busca",
    beneficiaries: [{ name: "Maria José da Silva", signedBy: "self" }],
    acceptance: { ip: "203.0.113.7" },
  };
  const stamp = buildStamp({
    tenantSlug: cartorioMarinho.slug,
    protocolNumber: "REQ.2026.000295",
    channel: undefined,
    exemption,
    beneficiaryIndex: 0,
  });
  assert.deepEqual(
    stamp.facts.map((f) => f.label),
    ["Canal", "Recebida em", "Formalizada por", "Protocolo"],
  );
  assert.equal(stamp.facts[0].value, "Site oficial da serventia");
  assert.equal(stamp.facts[2].value, "A própria pessoa");
  assert.equal(stamp.facts[3].value, "REQ.2026.000295");
  assert.equal(stamp.ip, "203.0.113.7");
  assert.match(stamp.hash ?? "", /^[0-9a-f]{64}$/);
});

test("buildStamp: canal balcão e IP ausente saem em branco, sem inventar", () => {
  const exemption: ExemptionDeclaration = {
    declaredAt: "2026-09-11T09:41:00.000Z",
    actId: "rcpn-certidao",
    beneficiaries: [
      {
        name: "Maria José da Silva",
        signedBy: "on-behalf",
        signer: { name: "João da Silva" },
      },
    ],
  };
  const stamp = buildStamp({
    tenantSlug: cartorioMarinho.slug,
    protocolNumber: "REQ.2026.000296",
    channel: "counter",
    exemption,
    beneficiaryIndex: 0,
  });
  assert.equal(stamp.facts[0].value, "Balcão");
  assert.equal(stamp.facts[2].value, "A rogo: João da Silva");
  assert.equal(stamp.ip, undefined);
});
