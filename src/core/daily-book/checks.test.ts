import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bookedLate,
  expenseWarnings,
  looksLikeIncomeTax,
  PERSONAL_EXPENSE_RULE,
} from "./checks.ts";

test("o § 2º do art. 191-A é transcrito como está na lei", () => {
  assert.match(
    PERSONAL_EXPENSE_RULE,
    /^Não poderão ser lançadas despesas de natureza exclusivamente pessoal ou estranhas à prestação do serviço delegado/,
  );
});

test("despesa de mês encerrado: aviso com o texto do art. 191-A, só no lançamento novo", () => {
  assert.ok(bookedLate("2026-09-30", "2026-10-01"));
  assert.ok(!bookedLate("2026-10-01", "2026-10-31"));
  const e = {
    description: "Toner",
    supplier: "Papelaria Exemplo",
    date: "2026-09-10",
  };
  const [notice] = expenseWarnings(e, "2026-10-02");
  assert.match(notice ?? "", /setembro de 2026/);
  assert.match(notice ?? "", /até o encerramento do mês em que se efetivarem/);
  assert.deepEqual(expenseWarnings(e, "2026-10-02", { isNew: false }), []);
});

test("sem listas de palavras próprias: só o que a lei diz gera aviso", () => {
  for (const description of [
    "Supermercado da família",
    "Guia do FDJ",
    "DARF carnê-leão de outubro",
    "Energia elétrica da sede",
  ]) {
    assert.deepEqual(
      expenseWarnings(
        { description, supplier: "", date: "2026-10-05" },
        "2026-10-20",
      ),
      [],
      description,
    );
  }
});

test("IR do interino: aviso do CGJ/RN art. 25, § 2º, só na serventia sob interinidade", () => {
  assert.ok(looksLikeIncomeTax("DARF carnê-leão outubro"));
  assert.ok(!looksLikeIncomeTax("IRRF retido da folha dos prepostos"));
  const e = {
    description: "DARF carnê-leão de outubro",
    supplier: "",
    date: "2026-10-30",
  };
  assert.deepEqual(expenseWarnings(e, "2026-10-31"), []);
  const [notice] = expenseWarnings(e, "2026-10-31", { interim: true });
  assert.match(
    notice ?? "",
    /O Imposto de Renda devido pelo interino não é considerado como despesa da serventia/,
  );
});
