import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findPrenotationItems,
  formatMoney,
  isTrustedRead,
  parseMoney,
  prenotationCodesFor,
  prenotationNotice,
  type ReadFeeItem,
  readPrenotationTable,
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

// The RN table's codes, as the office confirmed them: RI 2600103 (R$ 57,90),
// RTD 2500140 (R$ 57,90), RCPJ 2400105 (R$ 31,51). The split of each total
// into emolumento and funds here is illustrative; what matters is that the
// parts add up to the total, as they do in the table.
const RN = prenotationCodesFor("RN");

const RN_TABLE = `
TABELA DE EMOLUMENTOS 2026
TABELIONATO DE NOTAS
1100201 Prenotação de testamento cerrado 10,00 1,50 1,00 12,50
REGISTRO CIVIL DAS PESSOAS JURÍDICAS
Código Descrição Emolumento FDJ FRMP Total
2400104 Certidão 20,00 3,00 2,00 25,00 2400105 Prenotação 25,21 3,78 2,52 31,51
REGISTRO DE TÍTULOS E DOCUMENTOS
Obs.: a prenotação (código 2600103 no Registro de Imóveis) não se confunde com esta.
2500140 Prenotação de título ou documento para registro, averbação
46,32 6,95 4,63 57,90
REGISTRO DE IMÓVEIS
2600102 Busca 10,00 1,50 1,00 12,50
2600103 Prenotação 46,32 6,95 4,63 57,90
`;

test("the RN table is read by its codes, each total adding up", () => {
  const read = readPrenotationTable(RN_TABLE, RN);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(read).map(([key, item]) => [
        key,
        [item.code, item.totalCents, item.foundBy, item.check],
      ]),
    ),
    {
      RI: ["2600103", 5790, "code", "sum"],
      RTD: ["2500140", 5790, "code", "sum"],
      RCPJ: ["2400105", 3151, "code", "sum"],
    },
  );
  // Two items on one row: only its own amounts, not the certidão's.
  assert.equal(read.RCPJ?.description, "Prenotação");
  // The total on the line below its description.
  assert.equal(
    read.RTD?.description,
    "Prenotação de título ou documento para registro, averbação",
  );
  for (const item of Object.values(read)) assert.ok(isTrustedRead(item));
});

test("a note that cites a code is not taken for the item", () => {
  const read = readPrenotationTable(
    "Obs.: a prenotação (código 2600103) 1,00\n2600103 Prenotação 46,32 6,95 4,63 57,90",
    RN,
  );
  assert.equal(read.RI?.totalCents, 5790);
});

test("a note naming the code and the prenotação is not the item either", () => {
  const read = readPrenotationTable(
    "Nota: o código 2600103 (prenotação) custa 1,00 por folha\n2600103 Prenotação 46,32 6,95 4,63 57,90",
    RN,
  );
  assert.equal(read.RI?.totalCents, 5790);
  assert.equal(read.RI?.check, "sum");
});

test("a last amount the parts do not add up to is never trusted", () => {
  const read = readPrenotationTable(
    "2600103 Prenotação 46,32 6,95 4,63 57,90 5,79",
    RN,
  );
  assert.equal(read.RI?.check, "unchecked");
  assert.equal(isTrustedRead(read.RI as ReadFeeItem), false);
});

test("a code other than the known one is only a guess", () => {
  const read = readPrenotationTable(
    "REGISTRO DE IMÓVEIS\n2699999 Prenotação 46,32 6,95 4,63 57,90",
    RN,
  );
  assert.equal(read.RI?.foundBy, "section");
  assert.equal(isTrustedRead(read.RI as ReadFeeItem), false);
  assert.equal(read.RTD, undefined);
});

test("an amount is never read as a code", () => {
  const read = readPrenotationTable(
    "2400105 Prenotação 1.234.567,00 2.400.105,00",
    RN,
  );
  assert.equal(read.RCPJ?.code, "2400105");
  assert.equal(read.RCPJ?.check, "unchecked");
});
