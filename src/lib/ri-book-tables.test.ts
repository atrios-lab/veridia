import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import { EMPTY_CONDO, EMPTY_RURAL } from "@/core/ri/property.ts";
import type { Acervo } from "./ri.ts";
import {
  personalIndicatorTable,
  protocolTable,
  realIndicatorTable,
} from "./ri-book-tables.ts";

// Fictitious data only (LGPD).
const property = {
  id: "p1",
  book: 2,
  number: 12,
  recordKind: 0,
  status: 0,
  cnm: "",
  deletedAt: null,
  rural: EMPTY_RURAL,
  condo: EMPTY_CONDO,
  aux: EMPTY_AUX,
} as unknown as Acervo["properties"][number];
const acervo = {
  properties: [property],
  acts: new Map([
    [
      "p1",
      [
        {
          id: "a1",
          seq: 1,
          kind: "R",
          parties: [
            {
              personId: "x",
              name: "Pessoa Exemplo",
              document: "",
              role: "adquirente",
              share: "",
            },
          ],
        },
      ],
    ],
  ]),
  people: new Map(),
} as unknown as Acervo;

test("Livros 4 e 5 saem nas colunas do Provimento nº 223/2020", () => {
  const real = realIndicatorTable(acervo);
  assert.deepEqual(real.columns, [
    "Nº de ordem",
    "Identificação do imóvel",
    "Referência aos demais livros",
    "Anotações",
  ]);
  assert.equal(real.rows[0]?.[0], "1");
  assert.match(real.rows[0]?.[2] ?? "", /Livro 2, matrícula nº 12: R-1/);
  const personal = personalIndicatorTable(acervo);
  assert.equal(personal.columns[1], "Pessoas");
  assert.equal(personal.rows[0]?.[1], "Pessoa Exemplo");
  assert.match(personal.rows[0]?.[2] ?? "", /matrícula nº 12 \(R-1\)/);
});

test("o Protocolo sai na ordem, com o anulado marcado", () => {
  const t = protocolTable([
    {
      number: 2,
      presentedOn: "2026-11-02",
      presenter: "B",
      titleKind: "Escritura",
      acts: "R-2",
      voided: true,
    },
    {
      number: 1,
      presentedOn: "2026-11-01",
      presenter: "A",
      titleKind: "Escritura",
      acts: "R-1",
      voided: false,
    },
  ]);
  assert.equal(t.rows[0]?.[0], "1");
  assert.equal(t.rows[0]?.[1], "01/11/2026");
  assert.match(t.rows[1]?.[4] ?? "", /anulado/);
});
