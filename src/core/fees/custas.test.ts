import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyAdjustments,
  changeTotals,
  checkTable,
  type FeeRow,
  type FeeTableData,
  issOf,
  parseCents,
  parseFactor,
  totalOf,
} from "./custas.ts";

function row(
  code: string,
  emol: number,
  fdj: number,
  frmp: number,
  fcrcpn: number,
  funaf: number,
  iss?: number,
): FeeRow {
  const i = iss ?? issOf(emol, 500);
  const cents = {
    emolumentos: emol,
    fdj,
    frmp,
    fcrcpn,
    iss: i,
    funaf,
    total: 0,
  };
  cents.total = totalOf(cents);
  return { code, description: `Ato ${code}`, cents };
}

// Fictitious values, in the shape of the office's table.
const TABLE: FeeTableData = {
  meta: {
    title: "TABELA DE CUSTAS E EMOLUMENTOS 2026",
    subtitle: "SERVIÇOS EXTRAJUDICIAIS",
    source: "",
    validity: "",
    issuer: "",
    footer: "",
    region: "",
    city: "",
    year: "2026",
    issBasisPoints: 500,
    presentation: [],
  },
  blocks: [
    { kind: "heading", level: 1, text: "TABELA I: TESTE" },
    { kind: "row", row: row("1100101", 747, 234, 69, 78, 28) },
    { kind: "row", row: row("1100106", 4314, 1433, 418, 478, 28) },
    { kind: "row", row: row("1100106", 4314, 1433, 418, 478, 77) },
    { kind: "row", row: row("1100200", 11155, 0, 0, 0, 0, 0) },
  ],
};

test("ISS arredonda meio centavo para cima e o total é a soma", () => {
  assert.equal(issOf(747, 500), 37); // 37,35
  assert.equal(issOf(4314, 500), 216); // 215,7
  assert.equal(issOf(3, 500), 0); // 0,15
  assert.equal(issOf(10, 500), 1); // 0,5 -> 1
  assert.equal(
    totalOf({
      emolumentos: 747,
      fdj: 234,
      frmp: 69,
      fcrcpn: 78,
      iss: 37,
      funaf: 28,
    }),
    1193,
  );
});

test("índice e valores lidos do jeito que vêm", () => {
  assert.equal(parseFactor("1,0521"), 1_052_100);
  assert.equal(parseFactor("5,21%"), 1_052_100);
  assert.equal(parseFactor("abc"), null);
  assert.equal(parseCents("R$ 1.234,56"), 123456);
  assert.equal(parseCents("0,7"), 70);
  assert.equal(parseCents("12.50"), 1250);
  assert.equal(parseCents("x"), null);
});

test("índice no FRMP: arredonda, recalcula o total e não mexe no ISS", () => {
  const result = applyAdjustments(TABLE, [
    { column: "frmp", mode: "indice", factorMicro: 1_052_100 },
  ]);
  const first = result.changes[0];
  assert.equal(first?.code, "1100101");
  assert.equal(first?.after.frmp, 73); // 69 x 1,0521 = 72,59
  assert.equal(first?.after.iss, first?.before.iss);
  assert.equal(first?.after.total, (first?.before.total ?? 0) + 4);
  // The row with FRMP zero does not change.
  assert.equal(
    result.changes.some((c) => c.code === "1100200"),
    false,
  );
  assert.deepEqual(checkTable(result.data).errors, []);
  // The table passed in is untouched.
  assert.equal((TABLE.blocks[1] as { row: FeeRow }).row.cents.frmp, 69);
});

test("valores por código: um valor vale para todas as faixas; um por faixa, na ordem", () => {
  const one = applyAdjustments(TABLE, [
    {
      column: "frmp",
      mode: "valores",
      values: [{ code: "1100106", cents: 500 }],
    },
  ]);
  assert.equal(one.changes.length, 2);
  assert.ok(one.changes.every((c) => c.after.frmp === 500));
  const each = applyAdjustments(TABLE, [
    {
      column: "funaf",
      mode: "valores",
      values: [
        { code: "1100106", cents: 30 },
        { code: "1100106", cents: 80 },
        { code: "9999999", cents: 1 },
      ],
    },
  ]);
  assert.deepEqual(
    each.changes.map((c) => c.after.funaf),
    [30, 80],
  );
  assert.deepEqual(each.notFound, ["9999999"]);
  const odd = applyAdjustments(TABLE, [
    {
      column: "funaf",
      mode: "valores",
      values: [
        { code: "1100106", cents: 1 },
        { code: "1100106", cents: 2 },
        { code: "1100106", cents: 3 },
      ],
    },
  ]);
  assert.deepEqual(odd.ambiguous, ["1100106"]);
  assert.equal(odd.changes.length, 0);
});

test("emolumentos mudam: ISS recalculado; linha isenta de ISS continua isenta", () => {
  const result = applyAdjustments(TABLE, [
    { column: "emolumentos", mode: "indice", factorMicro: 1_100_000 },
  ]);
  const first = result.changes.find((c) => c.code === "1100101");
  assert.equal(first?.after.emolumentos, 822); // 821,7
  assert.equal(first?.after.iss, 41); // 41,1
  const exempt = result.changes.find((c) => c.code === "1100200");
  assert.equal(exempt?.after.iss, 0);
  assert.equal(exempt?.after.total, exempt?.after.emolumentos);
  const totals = changeTotals(result.changes);
  assert.equal(totals.emolumentos.rows, 4);
  assert.equal(totals.fdj.rows, 0);
});

test("a conferência acusa total que não fecha e ISS fora da alíquota", () => {
  const broken: FeeTableData = {
    meta: TABLE.meta,
    blocks: [
      {
        kind: "row",
        row: {
          ...row("1", 1000, 0, 0, 0, 0),
          cents: {
            emolumentos: 1000,
            fdj: 0,
            frmp: 0,
            fcrcpn: 0,
            iss: 50,
            funaf: 0,
            total: 1051,
          },
        },
      },
    ],
  };
  const check = checkTable(broken);
  assert.equal(check.errors.length, 1);
  assert.equal(checkTable(TABLE).issExceptions.length, 1);
});
