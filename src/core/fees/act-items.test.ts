import assert from "node:assert/strict";
import test from "node:test";
import { actItemKind, findActItems } from "./act-items.ts";

// A fictitious table, laid out as the readers put it back: one row per line.
const TABLE = `
TABELA DE EMOLUMENTOS (exemplo fictício)
REGISTRO DE TÍTULOS E DOCUMENTOS
1100140 Prenotação de título ou documento 46,32 6,95 4,63 57,90
1100150 Averbação sem conteúdo econômico 30,00 4,50 3,00 37,50
REGISTRO DE IMÓVEIS
1200103 Prenotação 46,32 6,95 4,63 57,90
1200135 Averbação sem conteúdo
econômico 40,00 6,00 4,00 50,00
1200136 Averbação com conteúdo econômico, por faixa 80,00 12,00 8,00 100,00
1200140 Registro com valor declarado 200,00 30,00 20,00 250,00
1200150 Certidão de inteiro teor 20,00 3,00 2,00 25,00
`;

test("os itens de averbação e de registro da tabela, Imóveis primeiro", () => {
  const found = findActItems(TABLE);
  assert.deepEqual(
    found["averbacao-sem-valor"]?.map((i) => [i.code, i.section, i.totalCents]),
    [
      ["1200135", "RI", 5000],
      ["1100150", "RTD", 3750],
    ],
  );
  assert.equal(
    found["averbacao-sem-valor"]?.[0]?.description,
    "Averbação sem conteúdo econômico",
  );
  assert.equal(found["averbacao-com-valor"]?.[0]?.code, "1200136");
  assert.equal(found["registro-com-valor"]?.[0]?.code, "1200140");
});

test("prenotação, certidão e texto sem tipo não são itens de ato", () => {
  assert.equal(actItemKind("Prenotação"), null);
  assert.equal(actItemKind("Certidão de inteiro teor"), null);
  assert.equal(actItemKind("Averbação"), null);
  assert.equal(
    actItemKind("Averbação sem valor declarado"),
    "averbacao-sem-valor",
  );
  assert.equal(
    actItemKind("Registro com conteúdo financeiro"),
    "registro-com-valor",
  );
});

test("tabela sem os itens não acha nada", () => {
  assert.deepEqual(findActItems("1200103 Prenotação 57,90"), {});
});
