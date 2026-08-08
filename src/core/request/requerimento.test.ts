import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import { buildRequerimento } from "./requerimento.ts";

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
  // copy the citizen keeps.
  const text = flatten(
    buildRequerimento(cartorioMarinho, marriage, data).sections,
  );
  assert.match(text, /REQ\.2026\.000148/);
  assert.match(text, /BBM8-6XVB-8PUK/);
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

test("the signature block says how to sign it", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  assert.match(document.signature.join("\n"), /Gov\.br/);
  assert.match(document.signature.join("\n"), /Maria José da Silva/);
});
