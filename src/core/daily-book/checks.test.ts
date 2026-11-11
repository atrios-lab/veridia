import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookedLate,
  expenseWarnings,
  looksLikeIncomeTax,
  looksLikeStateFund,
} from "./checks.ts";

test("repasses ao Estado não são despesa (CGJ/RN art. 25, § 3º)", () => {
  assert.ok(looksLikeStateFund("Guia do FDJ de outubro"));
  assert.ok(looksLikeStateFund("recolhimento FRMP"));
  assert.ok(!looksLikeStateFund("Aluguel da sede"));
});

test("IR: despesa do titular; aviso só na serventia sob interinidade", () => {
  assert.ok(looksLikeIncomeTax("DARF carnê-leão outubro"));
  assert.ok(looksLikeIncomeTax("Imposto de renda do interino"));
  assert.ok(!looksLikeIncomeTax("IRRF retido da folha dos prepostos"));
  const e = {
    description: "DARF carnê-leão de outubro",
    supplier: "",
    date: "2026-10-30",
  };
  assert.deepEqual(expenseWarnings(e, "2026-10-31"), []);
  const interim = expenseWarnings(e, "2026-10-31", { interim: true });
  assert.equal(interim.length, 1);
  assert.match(interim[0] ?? "", /interino.*art\. 25, § 2º/);
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
  assert.equal(expenseWarnings(e, "2026-10-02", { isNew: false }).length, 0);
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
