import assert from "node:assert/strict";
import { test } from "node:test";
import {
  protocolDate,
  protocolNumber,
  readForeignImport,
  readProtocolImport,
} from "./book-import.ts";

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
      [4, "cessado", false],
    ],
  );
  assert.equal(r.merged, 1);
  assert.match(r.items[1]?.acts ?? "", /Também lançado sob o nº 2/);
  assert.match(
    r.items[3]?.acts ?? "",
    /Data no livro original: "31\/02\/2026"/,
  );
  assert.equal(r.items[3]?.presentedOn, "2026-01-05");
  assert.equal(r.errors.length, 0);
});

test("o livro antigo como o cartório digitou: datas, números e cancelados", () => {
  const r = readProtocolImport(
    [
      [
        "Número de Ordem",
        "Data",
        "Nome do Apresentante",
        "Natureza do Título",
        "Anotações",
      ],
      [
        "001",
        "",
        "CANCELADO",
        "CANCELADO / NUMERAÇÃO NÃO UTILIZADA",
        "Números de ordem 001 a 004 não constam",
      ],
      [
        "005",
        "13-09-81 [sic - grafado 13/09/80]",
        "Pessoa A",
        "Escritura",
        "Registrado no livro 2-G",
      ],
      ["1.504", "17-09-003", "Pessoa B", "Escritura", "Registrado"],
      ["1.505-A", "02-set-2024", "Pessoa C", "Escritura", ""],
      ["1.505", "15-agosto-2022 [dia incerto]", "Pessoa D", "Escritura", ""],
      ["2.3 [EM BRANCO]", "", "", "", ""],
    ],
    "2026-11-27",
  );
  assert.equal(r.gaps, 1501);
  assert.deepEqual(
    r.items
      .filter((i) => i.titleKind !== "Protocolo não utilizado (cancelado)")
      .map((i) => [i.number, i.presentedOn, i.voided]),
    [
      [1, "1981-09-13", true],
      [5, "1981-09-13", false],
      [1504, "2003-09-17", false],
      [1505, "2024-09-02", false],
    ],
  );
  const byNumber = new Map(r.items.map((i) => [i.number, i]));
  assert.match(byNumber.get(1)?.acts ?? "", /Data não consta/);
  assert.match(byNumber.get(5)?.acts ?? "", /sic - grafado 13\/09\/80/);
  assert.equal(r.merged, 1);
  assert.match(byNumber.get(1505)?.acts ?? "", /1505-A|1505/);
  assert.equal(r.blank, 1);
  assert.equal(r.errors.length, 0);
});

test("datas do livro antigo", () => {
  assert.equal(protocolDate("13-09-81", "2026-11-27"), "1981-09-13");
  assert.equal(protocolDate("17-09-003", "2026-11-27"), "2003-09-17");
  assert.equal(protocolDate("02-set-2024", "2026-11-27"), "2024-09-02");
  assert.equal(protocolDate("06-dezembro-1999", "2026-11-27"), "1999-12-06");
  assert.equal(protocolDate("30-08-82 / 03-09-82", "2026-11-27"), "1982-08-30");
  assert.equal(protocolDate("30-02-91", "2026-11-27"), null);
  assert.deepEqual(protocolNumber("1.234-A [sic]"), {
    number: 1234,
    suffix: "A",
    note: "sic",
  });
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

test("números que faltam entram como protocolo não utilizado (cancelado)", () => {
  const r = readProtocolImport(
    [
      [
        "Nº de ordem",
        "Data",
        "Apresentante",
        "Natureza do título",
        "Anotações",
      ],
      ["1", "02/01/2026", "Pessoa A", "Escritura", "Registrado"],
      ["4", "05/01/2026", "Pessoa B", "Escritura", "[não lido] Registrado"],
      ["2.3 [EM BRANCO]", "", "", "", ""],
    ],
    "2026-11-27",
  );
  assert.deepEqual(
    r.items.map((i) => [i.number, i.voided, i.presentedOn]),
    [
      [1, false, "2026-01-02"],
      [2, true, "2026-01-02"],
      [3, true, "2026-01-02"],
      [4, false, "2026-01-05"],
    ],
  );
  assert.equal(r.gaps, 2);
  assert.equal(r.blank, 1);
  assert.equal(r.errors.length, 0);
  assert.equal(r.items[1]?.titleKind, "Protocolo não utilizado (cancelado)");
  assert.match(r.items[3]?.acts ?? "", /ilegível ou incerto/);
});
