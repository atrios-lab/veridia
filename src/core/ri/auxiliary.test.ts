import assert from "node:assert/strict";
import { test } from "node:test";
import { auxGuideFor, auxOf, auxText, readAux } from "./auxiliary.ts";
import { fichaContent } from "./ficha.ts";
import { EMPTY_CONDO, EMPTY_RURAL, readProperty } from "./property.ts";
import { propertyTable, readPropertyTable } from "./transfer.ts";

// Fictitious data only (LGPD).
const FORM: Record<string, unknown> = {
  book: "3",
  number: "70",
  auxKind: "Contrato de penhor rural",
  openedOn: "10/07/2026",
  "aux.title": "Cédula rural pignoratícia nº 001/2026",
  "aux.issuedOn": "01/07/2026",
  "aux.value": "R$ 12.500,00",
  "aux.dueOn": "30/06/2027",
  "aux.guarantees": "Em penhor cedular de 1º grau, 20 bovinos fictícios.",
  "aux.goodsPlace": "Sítio Exemplo, matrícula 1.234 deste Registro",
  "aux.party.0.name": "  Ana   Fictícia ",
  "aux.party.0.document": "111.444.777-35",
  "aux.party.0.role": "emitente",
  "aux.party.1.name": "Banco Exemplo S.A.",
  "aux.party.1.document": "11.222.333/0001-81",
  "aux.party.1.role": "credor",
  "aux.party.2.name": "",
  "aux.party.2.role": "avalista",
};

test("o Livro 3 não tem imóvel: título, partes, valor e bens", () => {
  const p = readProperty(FORM);
  assert.equal(p.book, 3);
  assert.equal(p.aux.title, "Cédula rural pignoratícia nº 001/2026");
  assert.equal(p.aux.valueCents, 1250000);
  assert.equal(p.aux.dueOn, "2027-06-30");
  assert.deepEqual(
    p.aux.parties.map((x) => `${x.role}:${x.name}:${x.document}`),
    [
      "emitente:Ana Fictícia:11144477735",
      "credor:Banco Exemplo S.A.:11222333000181",
    ],
  );
  // What is stored comes back the same.
  assert.deepEqual(auxOf(JSON.parse(JSON.stringify(p.aux))), p.aux);
  // The Livro 2 ignores the Livro 3 fields.
  assert.equal(readProperty({ ...FORM, book: "2" }).aux.title, "");
});

test("o texto do registro segue o modelo: título, partes, valor, garantias", () => {
  const aux = readAux(FORM);
  const lines = auxText("Contrato de penhor rural", aux, "1.234");
  assert.match(
    lines[0] ?? "",
    /^TÍTULO: Cédula rural pignoratícia nº 001\/2026, emitido em 01\/07\/2026\.$/,
  );
  assert.ok(lines.includes("EMITENTE: Ana Fictícia, CPF 111.444.777-35."));
  assert.ok(lines.some((l) => /^VALOR: R\$\s?12\.500,00\.$/.test(l)));
  assert.ok(lines.some((l) => l.startsWith("GARANTIAS:")));
  assert.ok(lines.includes("MATRÍCULA(S) RELACIONADA(S): 1.234."));
});

test("como fazer: cada natureza com a regra vigente", () => {
  const penhor = auxGuideFor("Contrato de penhor rural");
  assert.ok(penhor.goods && penhor.money && !penhor.pacto);
  assert.ok(penhor.howTo.some((h) => /13\.986\/2020/.test(h.source)));
  const pacto = auxGuideFor("Convenção antenupcial (pacto antenupcial)");
  assert.ok(pacto.pacto && !pacto.goods);
  assert.ok(pacto.howTo.some((h) => /\b244\b/.test(h.source)));
  // Cédula rural hipotecária: no Livro 3; the hipoteca goes to the matrícula.
  const crh = auxGuideFor("Cédula rural hipotecária");
  assert.ok(crh.howTo.some((h) => /não abre registro no Livro 3/.test(h.step)));
  assert.ok(auxGuideFor("qualquer coisa").howTo.length > 0);
});

test("a ficha do Livro 3 sai sem imóvel nem proprietário", () => {
  const p = readProperty(FORM);
  const ficha = fichaContent({
    office: { name: "Cartório Exemplo", city: "Cidade Exemplo", state: "RN" },
    property: { ...p, rural: { ...EMPTY_RURAL }, condo: { ...EMPTY_CONDO } },
    acts: [],
    signer: null,
  });
  assert.equal(ficha.blocks[0]?.label, "Registro");
  assert.match(
    ficha.blocks[0]?.text ?? "",
    /NATUREZA: Contrato de penhor rural/,
  );
  assert.match(ficha.blocks[0]?.text ?? "", /CREDOR: Banco Exemplo S\.A\./);
  assert.doesNotMatch(ficha.blocks[0]?.text ?? "", /Proprietário/);
});

test("planilha: o Livro 3 vai e volta com as partes e os valores", () => {
  const p = readProperty(FORM);
  const table = propertyTable([{ ...p, owners: [] }]);
  const back = readPropertyTable(table);
  assert.equal(back.errors.length, 0);
  assert.deepEqual(back.rows[0]?.input.aux, p.aux);
  assert.equal(back.rows[0]?.input.auxKind, "Contrato de penhor rural");
});
