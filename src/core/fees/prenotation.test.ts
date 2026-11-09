import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findPrenotationItems,
  formatMoney,
  parseMoney,
  prenotationNotice,
} from "./prenotation.ts";

// A fee table as its PDF reads out: section headings, then one line per item
// with code, description, emolumento, funds and the total last.
const TABLE = `
TABELA DE EMOLUMENTOS 2026
TABELIONATO DE NOTAS
2600010 Escritura com valor declarado 1.000,00 200,00 1.200,00
2600011 Prenotação de testamento cerrado 10,00 2,00 12,00
REGISTRO DE IMÓVEIS
2600103 Prenotação 48,25 9,65 57,90
2600104 Registro com valor declarado 300,00 60,00 360,00
REGISTRO DE TÍTULOS E DOCUMENTOS
2600301 Prenotação de título ou documento 20,10 4,02 24,12
REGISTRO CIVIL DAS PESSOAS JURÍDICAS
2600401 Prenotação
30,00 6,00 36,00
`;

test("each prenotação is found under its own section, total last", () => {
  const items = findPrenotationItems(TABLE);
  assert.deepEqual(items.RI, {
    code: "2600103",
    description: "Prenotação",
    totalCents: 5790,
  });
  assert.equal(items.RTD?.code, "2600301");
  assert.equal(items.RTD?.totalCents, 2412);
  assert.equal(items.RTD?.description, "Prenotação de título ou documento");
  // The total wrapped to the next line.
  assert.deepEqual(items.RCPJ, {
    code: "2600401",
    description: "Prenotação",
    totalCents: 3600,
  });
});

test("a prenotação outside the three registries is not taken", () => {
  const items = findPrenotationItems(
    "TABELIONATO DE NOTAS\n2600011 Prenotação de testamento 10,00 2,00 12,00",
  );
  assert.deepEqual(items, {});
});

test("a line that names its registry wins over the section", () => {
  const items = findPrenotationItems(
    "OUTROS ATOS\n2600900 Prenotação - Registro de Imóveis 57,90",
  );
  assert.equal(items.RI?.totalCents, 5790);
});

test("money reads and writes the Brazilian way", () => {
  assert.equal(parseMoney("57,90"), 5790);
  assert.equal(parseMoney("R$ 1.234,56"), 123456);
  assert.equal(parseMoney("12.5"), undefined);
  assert.equal(formatMoney(5790), "R$ 57,90");
  assert.equal(formatMoney(123456), "R$ 1.234,56");
});

test("the notice says it is the prenotação, with code and table", () => {
  const notice = prenotationNotice(
    { code: "2600103", description: "Prenotação", totalCents: 5790 },
    "Tabela de Emolumentos 2026",
  );
  assert.equal(
    notice.headline,
    "Prenotação: R$ 57,90 (código 2600103 da Tabela de Emolumentos 2026)",
  );
  assert.match(notice.detail, /Este valor é a prenotação/);
});
