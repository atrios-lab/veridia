import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookedLate,
  expenseWarnings,
  looksLikeHolderIncomeTax,
  looksLikeStateFund,
} from "./checks.ts";

test("repasses ao Estado não são despesa (CGJ/RN art. 25, § 3º)", () => {
  assert.ok(looksLikeStateFund("Guia do FDJ de outubro"));
  assert.ok(looksLikeStateFund("recolhimento FRMP"));
  assert.ok(!looksLikeStateFund("Aluguel da sede"));
});

test("IR do titular não é despesa; o IRRF dos funcionários é", () => {
  assert.ok(looksLikeHolderIncomeTax("DARF carnê-leão outubro"));
  assert.ok(looksLikeHolderIncomeTax("Imposto de renda do titular"));
  assert.ok(looksLikeHolderIncomeTax("IRPF 2026"));
  assert.ok(!looksLikeHolderIncomeTax("IRRF retido da folha dos prepostos"));
});

test("despesa de mês encerrado avisa só no lançamento novo", () => {
  assert.ok(bookedLate("2026-09-30", "2026-10-01"));
  assert.ok(!bookedLate("2026-10-01", "2026-10-31"));
  const e = {
    description: "Toner",
    supplier: "Papelaria Exemplo",
    date: "2026-09-10",
  };
  assert.equal(expenseWarnings(e, "2026-10-02").length, 1);
  assert.match(expenseWarnings(e, "2026-10-02")[0] ?? "", /setembro de 2026/);
  assert.equal(expenseWarnings(e, "2026-10-02", false).length, 0);
});

test("despesa comum do serviço não gera aviso", () => {
  assert.deepEqual(
    expenseWarnings(
      {
        description: "Energia elétrica da sede",
        supplier: "Distribuidora Exemplo",
        date: "2026-10-05",
      },
      "2026-10-20",
    ),
    [],
  );
  assert.equal(
    expenseWarnings(
      {
        description: "Supermercado da família",
        supplier: "",
        date: "2026-10-05",
      },
      "2026-10-20",
    ).length,
    1,
  );
});
