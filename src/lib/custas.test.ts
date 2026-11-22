import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAdjustments,
  type FeeRow,
  type FeeTableData,
  issOf,
  rowsOf,
  totalOf,
} from "@/core/fees/custas.ts";
import { parseFeeTable } from "@/core/fees/custas-parse.ts";
import { adjustedTable, codeValuesFromText } from "./custas.ts";
import { pdfLines, renderFeeTablePdf } from "./custas-pdf.ts";

function row(
  code: string,
  description: string,
  emol: number,
  frmp: number,
): FeeRow {
  const cents = {
    emolumentos: emol,
    fdj: Math.round(emol / 3),
    frmp,
    fcrcpn: Math.round(emol / 9),
    iss: issOf(emol, 500),
    funaf: 28,
    total: 0,
  };
  cents.total = totalOf(cents);
  return { code, description, cents };
}

// A fictitious table in the office's standard.
const TABLE: FeeTableData = {
  meta: {
    title: "TABELA DE CUSTAS E EMOLUMENTOS 2027",
    subtitle: "SERVIÇOS EXTRAJUDICIAIS",
    source: "Anexo II da tabela fictícia do Tribunal",
    validity:
      "Vigência do FRMP: 01/01/2027 · Publicação: 02/01/2027 · Índice: 1,0500",
    issuer: "EMPRESA FICTÍCIA LTDA",
    footer: "Fonte: tabela fictícia, para teste.",
    region: "Estado Fictício",
    city: "CIDADE FICTÍCIA",
    year: "2027",
    issBasisPoints: 500,
    presentation: [
      "Primeiro parágrafo fictício.",
      "Segundo parágrafo fictício.",
    ],
  },
  blocks: [
    { kind: "heading", level: 1, text: "TABELA I: PROTESTO FICTÍCIO" },
    {
      kind: "group",
      text: "Título apresentado para protesto, sobre o valor do título:",
    },
    ...Array.from({ length: 40 }, (_, i) => ({
      kind: "row" as const,
      row: row(
        String(2100101 + i),
        `De R$ ${i * 50},01 a R$ ${(i + 1) * 50},00`,
        747 + i * 700,
        69 + i * 60,
      ),
    })),
    {
      kind: "row",
      row: row(
        "2100215",
        "Certidão destinada a órgãos de crédito ou entidades de classe similares, por cada 10 títulos, com um texto longo o bastante para quebrar em várias linhas dentro da célula da tabela",
        829,
        18,
      ),
    },
    {
      kind: "notes",
      items: [
        "1. Primeira nota fictícia.",
        "2. Segunda nota fictícia, mais longa, que explica uma regra qualquer de cobrança.",
      ],
    },
    { kind: "heading", level: 1, text: "TABELA II: NOTAS FICTÍCIAS" },
    { kind: "heading", level: 2, text: "TABELA II-A" },
    { kind: "row", row: row("2200101", "Até R$ 10.000,00", 23554, 1856) },
  ],
};

test("a tabela gerada no padrão é lida de volta igual, valor por valor", async () => {
  const pdf = await renderFeeTablePdf(TABLE);
  const { data, warnings } = parseFeeTable(await pdfLines(new Uint8Array(pdf)));
  assert.deepEqual(warnings, []);
  assert.deepEqual(rowsOf(data), rowsOf(TABLE));
  assert.deepEqual(data.meta, TABLE.meta);
  assert.deepEqual(
    data.blocks.filter((b) => b.kind !== "row"),
    TABLE.blocks.filter((b) => b.kind !== "row"),
  );
});

test("o ajuste troca capa e apresentação e mantém as contas", () => {
  const result = adjustedTable(TABLE, {
    adjustments: [{ column: "frmp", mode: "indice", factorMicro: 1_100_000 }],
    title: "TABELA DE CUSTAS E EMOLUMENTOS 2028",
    validity: "Vigência do FRMP: 01/01/2028",
    presentation: "Nova apresentação.\n\nSegundo bloco.",
  });
  assert.equal(result.data.meta.year, "2028");
  assert.deepEqual(result.data.meta.presentation, [
    "Nova apresentação.",
    "Segundo bloco.",
  ]);
  for (const r of rowsOf(result.data))
    assert.equal(r.cents.total, totalOf(r.cents));
  assert.equal(
    result.changes.length,
    applyAdjustments(TABLE, [
      { column: "frmp", mode: "indice", factorMicro: 1_100_000 },
    ]).changes.length,
  );
});

test("planilha código; valor lida sem o assistente", () => {
  const codes = new Set(["2100101", "2100102", "2100103"]);
  assert.deepEqual(
    codeValuesFromText(
      "código;FRMP\n2100101;0,73\n2100102;R$ 1,43\n2100103;2,15\nTotal;9,99",
      codes,
    ),
    [
      { code: "2100101", cents: 73 },
      { code: "2100102", cents: 143 },
      { code: "2100103", cents: 215 },
    ],
  );
  assert.equal(codeValuesFromText("texto qualquer", codes), null);
});
