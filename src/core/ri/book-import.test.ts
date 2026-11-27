import assert from "node:assert/strict";
import { test } from "node:test";
import { readForeignImport, readProtocolImport } from "./book-import.ts";

// Fictitious data only (LGPD).
test("o Livro 1 volta da mesma planilha que sai, sem reabrir prazo", () => {
  const r = readProtocolImport(
    [
      [
        "Nº de ordem",
        "Data",
        "Apresentante",
        "Natureza do título",
        "Atos (anotações)",
      ],
      ["1", "02/01/2026", "Pessoa A", "Escritura", "R-1"],
      ["2", "03/01/2026", "Pessoa B", "Contrato", ""],
      [
        "3",
        "04/01/2026",
        "Pessoa C",
        "Escritura",
        "Lançado por engano (anulado)",
      ],
      ["2", "05/01/2026", "Pessoa D", "Escritura", ""],
      ["4", "31/02/2026", "Pessoa E", "Escritura", ""],
    ],
    "2026-11-27",
  );
  assert.deepEqual(
    r.items.map((i) => [i.number, i.status, i.voided]),
    [
      [1, "registrado", false],
      [2, "cessado", false],
      [3, "cessado", true],
    ],
  );
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[0] ?? "", /se repete/);
});

test("sem as colunas do Protocolo, diz quais faltam", () => {
  const r = readProtocolImport([["Nome"], ["x"]], "2026-11-27");
  assert.equal(r.items.length, 0);
  assert.match(r.errors[0] ?? "", /Apresentante/);
});

test("o livro de estrangeiro entra pelo modelo, conferido linha a linha", () => {
  const r = readForeignImport(
    [
      [
        "Nº",
        "Ato (aquisição ou arrendamento)",
        "Data do registro",
        "Quem adquire (física, jurídica estrangeira ou equiparada)",
        "Adquirente",
        "Nacionalidade",
        "Documento do adquirente",
        "Área (ha)",
        "Município",
        "Descrição do imóvel",
        "Área de segurança nacional (sim ou não)",
      ],
      [
        "7",
        "Arrendamento",
        "10/03/2026",
        "física",
        "Pessoa X",
        "Exemplolandesa",
        "Passaporte 0",
        "5",
        "Cidade Exemplo",
        "Gleba",
        "sim",
      ],
      [
        "",
        "Aquisição",
        "10/03/2026",
        "equiparada",
        "Empresa Y",
        "",
        "",
        "5",
        "Cidade Exemplo",
        "Gleba",
        "não",
      ],
    ],
    "2026-11-27",
  );
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0]?.number, 7);
  assert.equal(r.items[0]?.kind, "arrendamento");
  assert.equal(r.items[0]?.securityArea, true);
  assert.match(r.errors[0] ?? "", /Linha 3: .*atos constitutivos/);
});
