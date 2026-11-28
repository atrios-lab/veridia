import assert from "node:assert/strict";
import { test } from "node:test";
import { letterOf, protocolIndex, searchIndex } from "./protocol-index.ts";

// Fictitious data only (LGPD).
const rows = [
  {
    presenter: "Zélia Fictícia",
    presentedOn: "2024-07-04",
    titleKind: "Escritura",
    number: 3,
    sheet: "75",
  },
  {
    presenter: "Álvaro Fictício",
    presentedOn: "2024-07-05",
    titleKind: "Formal de partilha",
    number: 7,
    sheet: "75-v",
  },
  {
    presenter: "alvaro fictício",
    presentedOn: "2024-07-01",
    titleKind: "Escritura",
    number: 1,
    sheet: "74",
  },
];

test("índice em ordem alfabética, sem acento nem maiúscula, e depois pelo número", () => {
  assert.deepEqual(
    protocolIndex(rows).map((r) => r.number),
    [1, 7, 3],
  );
  assert.equal(letterOf("Álvaro"), "A");
});

test("consulta por nome, natureza ou número com ponto", () => {
  assert.deepEqual(
    searchIndex(rows, "alvaro").map((r) => r.number),
    [7, 1],
  );
  assert.deepEqual(
    searchIndex(rows, "partilha").map((r) => r.number),
    [7],
  );
  assert.deepEqual(
    searchIndex(rows, "3").map((r) => r.number),
    [3],
  );
});
