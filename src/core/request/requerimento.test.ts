import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import { buildDataRightsReceipt, buildRequerimento } from "./requerimento.ts";

const marriage = getAct("rcpn-habilitacao-casamento");
const nameChange = getAct("rcpn-alteracao-prenome");
if (!marriage || !nameChange) throw new Error("catalogo incompleto");

const data = {
  protocolNumber: "REQ.2026.000148",
  accessKey: "BBM8-6XVB-8PUK",
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

test("the form carries the pair that opens the request", () => {
  // Printed here on purpose: the screen shows the key once, and this is the
  // copy the citizen keeps. It rides in its own block, which is what lets the
  // renderer put it on a page that detaches.
  const credentials = buildRequerimento(
    cartorioMarinho,
    marriage,
    data,
  ).credentials;
  const text = (credentials?.rows ?? [])
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
  assert.match(text, /REQ\.2026\.000148/);
  assert.match(text, /BBM8-6XVB-8PUK/);
});

test("the key is nowhere on the sheet that gets signed", () => {
  // The whole point of the separate page: the signed requerimento goes back
  // to the office through the site, and it must not carry the credential.
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  const signed = [
    document.eyebrow,
    document.title,
    document.subtitle,
    ...document.office,
    flatten(document.sections),
    document.signee ?? "",
    ...document.signature,
    document.footer,
  ].join("\n");
  assert.equal(signed.includes("BBM8-6XVB-8PUK"), false);
  assert.equal(signed.includes("Chave de acesso"), false);
  // The protocol stays: without it the office cannot find the request.
  assert.match(signed, /REQ\.2026\.000148/);
});

test("the credential page says why it is a page of its own", () => {
  const credentials = buildRequerimento(
    cartorioMarinho,
    marriage,
    data,
  ).credentials;
  assert.ok(credentials);
  assert.match(credentials.note, /Destaque esta página/);
  assert.match(credentials.note, /assinado/);
});

test("the form identifies the office and the act it is for", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  assert.ok(document.office.includes(cartorioMarinho.name));
  assert.match(document.office.join("\n"), /CNS 094615/);
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
