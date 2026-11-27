import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATTRIBUTION_BOOKS,
  bookOf,
  booksOf,
  detectBook,
  fillEmpty,
  readBookRows,
  rowOf,
  rowsOfJson,
  volumeOf,
  volumesOf,
} from "./catalog.ts";

// Fictitious data only (LGPD).
const TODAY = "2026-11-27";

test("cada atribuição tem os livros do Código de Normas do RN", () => {
  assert.deepEqual(
    booksOf("notas").map((b) => b.key),
    ["escrituras", "testamentos", "procuracoes", "substabelecimentos", "atas"],
  );
  assert.equal(booksOf("titulos-e-documentos").length, 4);
  assert.equal(booksOf("pessoas-juridicas").length, 3);
  assert.equal(booksOf("protesto").length, 2);
  for (const b of ATTRIBUTION_BOOKS) {
    assert.equal(b.columns[0]?.key, "numero", b.name);
    assert.ok(b.source.includes("156/2016"), b.name);
  }
});

test("a planilha volta ao livro, com erros por linha", () => {
  const book = bookOf("notas", "procuracoes");
  assert.ok(book);
  const header = book.columns.map((c) => c.label);
  const r = readBookRows(
    book,
    [
      header,
      [
        "1",
        "02/01/2026",
        "Livro 3, fl. 10",
        "Ad judicia",
        "Pessoa A e Pessoa B",
        "",
        "",
        "",
        "",
      ],
      ["2", "31/02/2026", "", "Pública", "Pessoa C", "", "", "", ""],
      ["3", "05/01/2026", "", "", "Pessoa D", "", "", "", ""],
      ["1", "06/01/2026", "", "Pública", "Pessoa E", "", "", "", ""],
    ],
    TODAY,
  );
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0]?.date, "2026-01-02");
  assert.equal(r.errors.length, 3);
  assert.equal(rowOf(book, r.items[0] as never)[1], "02/01/2026");
});

test("importar tudo: o livro é reconhecido pelas colunas e pelo nome do arquivo", () => {
  const protocol = bookOf("protesto", "protocolo");
  const registro = bookOf("protesto", "registro");
  assert.equal(
    detectBook("protesto", protocol?.columns.map((c) => c.label) ?? [])?.key,
    "protocolo",
  );
  assert.equal(
    detectBook("protesto", registro?.columns.map((c) => c.label) ?? [])?.key,
    "registro",
  );
  const notarial =
    bookOf("notas", "escrituras")?.columns.map((c) => c.label) ?? [];
  assert.equal(
    detectBook("notas", notarial, "testamentos-2010.xlsx")?.key,
    "testamentos",
  );
  assert.equal(detectBook("notas", ["Nome", "Endereço"]), null);
});

test("os volumes anteriores saem da coluna Livro e folha", () => {
  assert.equal(volumeOf("Livro 12, fl. 34"), "12");
  assert.equal(volumeOf("Livro nº 2-A fls. 1"), "2-A");
  assert.equal(volumeOf("L-7 F-3"), "7");
  assert.equal(volumeOf("10/45"), "10");
  assert.equal(volumeOf(""), "");
  assert.deepEqual(
    volumesOf([
      { data: { livroFolha: "Livro 10, fl. 1" } },
      { data: { livroFolha: "Livro 2, fl. 1" } },
      { data: { livroFolha: "Livro 2, fl. 9" } },
      { data: {} },
    ]),
    ["2", "10"],
  );
});

test("JSON exportado volta como linhas; completar nunca troca valor", () => {
  const book = bookOf("titulos-e-documentos", "livro-d");
  assert.ok(book);
  const rows = rowsOfJson(
    book,
    JSON.stringify({
      lancamentos: [
        {
          "Nº de ordem": "1",
          Nome: "Pessoa A",
          "Referência aos demais livros": "Livro B nº 3",
        },
      ],
    }),
  );
  assert.equal(rows[1]?.[1], "Pessoa A");
  assert.deepEqual(fillEmpty({ a: "x", b: "" }, { a: "y", b: "z" }), {
    a: "x",
    b: "z",
  });
  assert.equal(fillEmpty({ a: "x" }, { a: "y" }), null);
});
