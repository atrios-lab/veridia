import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import {
  buildAccessReceipt,
  buildDataRightsReceipt,
  buildRequerimento,
} from "./requerimento.ts";

const marriage = getAct("rcpn-habilitacao-casamento");
const nameChange = getAct("rcpn-alteracao-prenome");
if (!marriage || !nameChange) throw new Error("catalogo incompleto");

const ACCESS_KEY = "BBM8-6XVB-8PUK";

const data = {
  protocolNumber: "REQ.2026.000148",
  applicantName: "Maria José da Silva",
  contact: "(84) 99999-0000",
  cpf: "52998224725",
  description: "Queremos casar em outubro.",
  purpose: null,
  parameterValue: null,
  createdAt: new Date("2026-08-04T12:00:00Z"),
};

function flatten(sections: ReturnType<typeof buildRequerimento>["sections"]) {
  return sections
    .flatMap((s) => [
      s.heading,
      ...(s.rows ?? []).map((r) => `${r.label}: ${r.value}`),
      ...(s.paragraphs ?? []),
    ])
    .join("\n");
}

const receipt = {
  protocolNumber: data.protocolNumber,
  accessKey: ACCESS_KEY,
  createdAt: data.createdAt,
};

/** Every string the document puts on paper, credentials block included. */
function everything(document: ReturnType<typeof buildRequerimento>): string {
  return [
    document.eyebrow,
    document.title,
    document.subtitle,
    ...document.office,
    flatten(document.sections),
    document.signee ?? "",
    ...document.signature,
    document.footer,
    document.credentials?.heading ?? "",
    ...(document.credentials?.rows ?? []).map((r) => `${r.label}: ${r.value}`),
    document.credentials?.note ?? "",
  ].join("\n");
}

test("the receipt carries the pair that opens the request", () => {
  // The screen shows the key once, and this file is the copy the citizen
  // keeps.
  const document = buildAccessReceipt(cartorioMarinho, receipt);
  const text = (document.credentials?.rows ?? [])
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
  assert.match(text, /REQ\.2026\.000148/);
  assert.match(text, new RegExp(ACCESS_KEY));
});

test("the key is nowhere in the file that gets signed", () => {
  // The whole point of the split: signing at Gov.br signs the entire PDF, and
  // that PDF comes back to the office. It must not carry the credential: not
  // on any page, not in any block.
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  const signed = everything(document);
  assert.equal(document.credentials, undefined);
  assert.equal(signed.includes(ACCESS_KEY), false);
  assert.equal(signed.includes("Chave de acesso"), false);
  // The protocol stays: without it the office cannot find the request.
  assert.match(signed, /REQ\.2026\.000148/);
});

test("the access receipt is a document nobody signs", () => {
  const document = buildAccessReceipt(cartorioMarinho, receipt);
  assert.equal(document.signee, undefined);
  assert.deepEqual(document.sections, []);
  assert.match(document.title, /Comprovante de acesso/);
  // It has to say what the two codes are for, and that it travels alone.
  assert.ok(document.credentials);
  assert.match(document.credentials.note, /consulta de protocolo/);
  assert.match(document.credentials.note, /não deve ser enviado/);
});

test("the form identifies the office and the act it is for", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  assert.ok(document.office.includes(cartorioMarinho.name));
  // The CNS identifies the serventia to the corregedoria, not to the citizen
  // signing this: the office asked for it out of everything it hands over.
  // It stays on the tenant, for the panel to show whoever is logged in.
  assert.doesNotMatch(document.office.join("\n"), /CNS/);
  assert.equal(cartorioMarinho.cns, "094615");
  const text = flatten(document.sections);
  assert.match(text, /Habilitação de casamento/);
  assert.match(text, /Lei 6\.015 art\. 67/);
});

test("the CPF is printed the way it is written", () => {
  const text = flatten(
    buildRequerimento(cartorioMarinho, marriage, data).sections,
  );
  assert.match(text, /529\.982\.247-25/);
});

test("what the citizen did not fill in does not become an empty line", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, {
    ...data,
    cpf: null,
    description: null,
  });
  const text = flatten(document.sections);
  assert.equal(text.includes("CPF"), false);
  assert.equal(text.includes("Descrição do pedido"), false);
});

test("both declarations are on the paper that gets signed", () => {
  const text = flatten(
    buildRequerimento(cartorioMarinho, marriage, data).sections,
  );
  assert.match(text, /Lei 13\.709\/2018/);
  assert.match(text, /sob as penas da lei/);
});

test("the act's own documents and guidance travel with it", () => {
  const withDocuments = flatten(
    buildRequerimento(cartorioMarinho, marriage, data).sections,
  );
  assert.match(withDocuments, /Certidões de nascimento/);

  const atCounter = flatten(
    buildRequerimento(cartorioMarinho, nameChange, data).sections,
  );
  assert.match(atCounter, /Comparecimento pessoal/);
});

test("the data rights receipt keeps its key in the body", () => {
  // Nobody signs a receipt and sends it back, so there is no sheet to detach
  // the key from: separating it would only cost the holder a page.
  const document = buildDataRightsReceipt(cartorioMarinho, {
    protocolNumber: "LGPD.2026.000021",
    accessKey: "K4TP-2W9C-QJ7M",
    applicantName: "João Batista",
    email: "joao@exemplo.com",
    cpf: null,
    right: "access",
    description: "Quero saber quais dados a serventia guarda sobre mim.",
    createdAt: new Date("2026-08-04T12:00:00Z"),
    deadline: "19/08/2026",
  });
  assert.equal(document.credentials, undefined);
  assert.match(flatten(document.sections), /K4TP-2W9C-QJ7M/);
});

test("the signature block says how to sign it, and who signs", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  assert.match(document.signature.join("\n"), /Gov\.br/);
  assert.equal(document.signee, "Maria José da Silva");
});

test("a declaração de gratuidade entra no papel que o cidadão assina", () => {
  // O checkbox é registro; a declaração assinada é prova. É por isso que ela
  // viaja no requerimento, e não só no banco.
  const comIsencao = buildRequerimento(cartorioMarinho, marriage, {
    ...data,
    exemptionRequested: true,
  });
  const texto = flatten(comIsencao.sections);
  assert.match(texto, /Código Penal art\. 299/);
  assert.match(texto, /CC art\. 1\.512/);

  // Sem pedir, nada disso aparece: quem paga não assina declaração de pobreza.
  const semIsencao = buildRequerimento(cartorioMarinho, marriage, data);
  assert.doesNotMatch(flatten(semIsencao.sections), /Código Penal art\. 299/);
});
