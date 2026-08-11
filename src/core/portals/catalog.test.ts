import assert from "node:assert/strict";
import { test } from "node:test";
import { portalGroupsFor } from "./catalog.ts";

test("tenant with every attribution sees all groups", () => {
  const groups = portalGroupsFor([
    "RCPN",
    "NOTAS",
    "RI",
    "PROTESTO",
    "RTD",
    "RCPJ",
  ]);
  assert.deepEqual(
    groups.map((g) => g.label),
    [
      "Registro Civil",
      "Tabelionato de Notas",
      "Protesto de Títulos",
      "Registro de Imóveis",
      "Títulos e Documentos · Pessoas Jurídicas",
    ],
  );
});

test("tenant without RI does not see Registro de Imóveis", () => {
  const groups = portalGroupsFor(["RCPN", "NOTAS", "PROTESTO", "RTD", "RCPJ"]);
  assert.ok(!groups.some((g) => g.label === "Registro de Imóveis"));
});

test("RTD alone still unlocks the Títulos e Documentos group", () => {
  const groups = portalGroupsFor(["RTD"]);
  assert.ok(
    groups.some((g) => g.label === "Títulos e Documentos · Pessoas Jurídicas"),
  );
});

test("RCPJ alone still unlocks the Títulos e Documentos group", () => {
  const groups = portalGroupsFor(["RCPJ"]);
  assert.ok(
    groups.some((g) => g.label === "Títulos e Documentos · Pessoas Jurídicas"),
  );
});

test("tenant with a single unrelated attribution sees no groups", () => {
  const groups = portalGroupsFor(["NOTAS"]);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["Tabelionato de Notas"],
  );
});
