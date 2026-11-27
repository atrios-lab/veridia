import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ForeignError,
  foreignRow,
  foreignWarnings,
  lastClosedQuarter,
  quarterOf,
  quarterRule,
  quarterSpan,
  readForeignInput,
  recipientsFor,
} from "./foreign.ts";

// Fictitious data only (LGPD).
const base = {
  kind: "aquisicao",
  registeredOn: "15/05/2026",
  matricula: "12",
  actRef: "R-3",
  acquirerKind: "pf-estrangeira",
  acquirerName: "Pessoa Estrangeira Exemplo",
  nationality: "Exemplolandesa",
  acquirerDocument: "Passaporte X000000",
  area: "12,5000",
  municipality: "Cidade Exemplo",
  description: "Gleba rural com limites e confrontações conforme matrícula.",
};

test("o assento exige os dados da lei e diz o que falta", () => {
  const ok = readForeignInput(base, "2026-11-27");
  assert.equal(ok.registeredOn, "2026-05-15");
  assert.equal(ok.matricula, 12);
  assert.throws(
    () =>
      readForeignInput(
        { ...base, acquirerDocument: "", nationality: "" },
        "2026-11-27",
      ),
    (e: unknown) =>
      e instanceof ForeignError &&
      /passaporte ou RNM/.test(e.message) &&
      /nacionalidade/.test(e.message),
  );
  assert.throws(
    () =>
      readForeignInput({ ...base, registeredOn: "01/01/2027" }, "2026-11-27"),
    ForeignError,
  );
});

test("pessoa jurídica ou faixa de fronteira sem autorização gera aviso", () => {
  const pj = readForeignInput(
    { ...base, acquirerKind: "pj-equiparada" },
    "2026-11-27",
  );
  assert.match(foreignWarnings(pj).join(" "), /INCRA/);
  const border = readForeignInput(
    { ...base, securityArea: "on" },
    "2026-11-27",
  );
  assert.match(foreignWarnings(border).join(" "), /segurança nacional/);
});

test("trimestres e destinatários da relação", () => {
  assert.deepEqual(quarterOf("2026-05-15"), { year: 2026, quarter: 2 });
  assert.deepEqual(quarterSpan(2026, 1), {
    from: "2026-01-01",
    to: "2026-03-31",
    label: "1º trimestre de 2026",
  });
  assert.deepEqual(lastClosedQuarter("2026-02-10"), { year: 2025, quarter: 4 });
  assert.equal(recipientsFor([{ securityArea: false }]).length, 2);
  assert.match(recipientsFor([{ securityArea: true }]).join(" "), /Conselho/);
  assert.match(quarterRule(0, "RN"), /dispensada/);
  assert.match(quarterRule(2, "RN"), /Corregedoria/);
});

test("o assento sai nas 5 colunas do modelo", () => {
  const input = readForeignInput(base, "2026-11-27");
  const row = foreignRow({ ...input, number: 1, averbacoes: [] });
  assert.equal(row.length, 5);
  assert.match(row[1] ?? "", /Exemplolandesa/);
  assert.match(
    row[2] ?? "",
    /Matrícula nº 12, R-3, registrada em 15\/05\/2026/,
  );
  assert.match(row[3] ?? "", /Sem autorização/);
});
