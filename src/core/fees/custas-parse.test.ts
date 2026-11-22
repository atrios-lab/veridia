import assert from "node:assert/strict";
import { test } from "node:test";
import { type PdfLine, parseFeeTable } from "./custas-parse.ts";

/** A line of pieces, each [x, text]; widths are a rough 4 pt a letter. */
function line(page: number, y: number, ...pieces: [number, string][]): PdfLine {
  return {
    page,
    y,
    pieces: pieces.map(([x, text]) => ({ x, end: x + text.length * 4, text })),
  };
}
const money = (x: number, ...values: string[]) =>
  values.map((v, i) => [x + i * 60, `R$ ${v}`] as [number, string]);

// A fictitious table in the standard's layout: code at x 70, descriptions
// at x 120, group captions at x 62, headings at x 55, notes at x 75.
const LINES: PdfLine[] = [
  line(1, 100, [300, "EMPRESA FICTÍCIA LTDA"]),
  line(1, 200, [250, "TABELA DE CUSTAS E EMOLUMENTOS 2026"]),
  line(1, 215, [280, "SERVIÇOS EXTRAJUDICIAIS"]),
  line(1, 240, [220, "Anexo II da tabela fictícia"]),
  line(1, 252, [220, "Vigência do FRMP: 01/01/2026 · Índice: 1,0500"]),
  line(1, 290, [300, "Valores com ISS de 5%"]),
  line(1, 370, [330, "CIDADE"]),
  line(1, 384, [335, "2026"]),
  line(2, 30, [
    80,
    "TABELA DE CUSTAS E EMOLUMENTOS 2026: SERVIÇOS EXTRAJUDICIAIS",
  ]),
  line(2, 40, [80, "Estado Fictício · valores com ISS de 5%"]),
  line(2, 80, [55, "APRESENTAÇÃO"]),
  line(2, 100, [80, "Primeiro parágrafo da apresentação,"]),
  line(2, 110, [55, "que continua aqui."]),
  line(2, 120, [80, "Segundo parágrafo."]),
  line(2, 560, [55, "Fonte: Fonte fictícia."], [700, "Valores com ISS de 5%"]),
  line(3, 30, [
    80,
    "TABELA DE CUSTAS E EMOLUMENTOS 2026: SERVIÇOS EXTRAJUDICIAIS",
  ]),
  line(3, 80, [55, "TABELA I: PROTESTO FICTÍCIO"]),
  line(3, 95, [70, "Código"], [200, "Discriminação"], [400, "Emolumentos"]),
  line(3, 110, [62, "Título apresentado para protesto:"]),
  line(
    3,
    125,
    [70, "1100101"],
    [120, "De R$ 0,01 a R$ 50,00"],
    ...money(380, "7,47", "2,34", "0,69", "0,78", "0,37", "0,28", "11,93"),
  ),
  line(3, 137, [120, "Certidão destinada a órgãos de crédito"]),
  line(
    3,
    142,
    [70, "1100215"],
    ...money(380, "8,29", "0,62", "0,18", "0,21", "0,41", "0,00", "9,71"),
  ),
  line(3, 147, [120, "por cada 10 títulos"]),
  line(3, 165, [75, "NOTAS EXPLICATIVAS"]),
  line(3, 177, [75, "1. Primeira nota"]),
  line(3, 187, [75, "que continua."]),
  line(3, 205, [55, "B) REGISTRO FICTÍCIO NO LIVRO 2,"]),
  line(3, 215, [55, "INCLUSIVE ANOTAÇÕES"]),
  line(3, 230, [62, "TÍTULOS COM VALOR"]),
  line(
    3,
    245,
    [70, "2600104"],
    [120, "Até R$ 10.000,00"],
    ...money(
      380,
      "106,16",
      "47,12",
      "13,73",
      "15,71",
      "5,31",
      "5,71",
      "193,74",
    ),
  ),
];

test("lê a capa, a apresentação, títulos, grupos, linhas e notas", () => {
  const { data, warnings } = parseFeeTable(LINES);
  assert.deepEqual(warnings, []);
  assert.equal(data.meta.title, "TABELA DE CUSTAS E EMOLUMENTOS 2026");
  assert.equal(data.meta.issuer, "EMPRESA FICTÍCIA LTDA");
  assert.equal(
    data.meta.validity,
    "Vigência do FRMP: 01/01/2026 · Índice: 1,0500",
  );
  assert.equal(data.meta.issBasisPoints, 500);
  assert.equal(data.meta.city, "CIDADE");
  assert.equal(data.meta.region, "Estado Fictício");
  assert.equal(data.meta.footer, "Fonte: Fonte fictícia.");
  assert.deepEqual(data.meta.presentation, [
    "Primeiro parágrafo da apresentação, que continua aqui.",
    "Segundo parágrafo.",
  ]);
  assert.deepEqual(
    data.blocks.map((b) =>
      b.kind === "row"
        ? `row ${b.row.code} ${b.row.description}`
        : b.kind === "notes"
          ? `notes ${b.items.join(" | ")}`
          : `${b.kind} ${b.text}`,
    ),
    [
      "heading TABELA I: PROTESTO FICTÍCIO",
      "group Título apresentado para protesto:",
      "row 1100101 De R$ 0,01 a R$ 50,00",
      "row 1100215 Certidão destinada a órgãos de crédito por cada 10 títulos",
      "notes 1. Primeira nota que continua.",
      "heading B) REGISTRO FICTÍCIO NO LIVRO 2, INCLUSIVE ANOTAÇÕES",
      "group TÍTULOS COM VALOR",
      "row 2600104 Até R$ 10.000,00",
    ],
  );
  const first = data.blocks.find((b) => b.kind === "row");
  assert.deepEqual(first?.kind === "row" && first.row.cents, {
    emolumentos: 747,
    fdj: 234,
    frmp: 69,
    fcrcpn: 78,
    iss: 37,
    funaf: 28,
    total: 1193,
  });
});

test("sem TABELA I não há tabela", () => {
  const { data, warnings } = parseFeeTable([
    line(1, 10, [10, "qualquer coisa"]),
  ]);
  assert.equal(data.blocks.length, 0);
  assert.equal(warnings.length, 1);
});
