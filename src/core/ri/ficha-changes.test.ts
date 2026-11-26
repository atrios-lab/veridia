import assert from "node:assert/strict";
import { test } from "node:test";
import { compareFicha, transportDate } from "./ficha-changes.ts";
import type { ReadAct } from "./matricula-text.ts";

const act = (patch: Partial<ReadAct>): ReadAct => ({
  kind: "AV",
  seq: 1,
  nature: "",
  effect: "outro" as ReadAct["effect"],
  registeredOn: null,
  summary: "",
  parties: [],
  cancelsSeq: null,
  ...patch,
});

test("a new matrícula, new atos and a retificação", () => {
  assert.equal(
    compareFicha({ exists: false, number: 5, known: [], read: [act({})] })[0]
      ?.kind,
    "nova-matricula",
  );
  const changes = compareFicha({
    exists: true,
    number: 5,
    known: [
      {
        seq: 1,
        kind: "R",
        nature: "Compra e venda",
        summary: "Compra e venda a Pessoa Exemplo.",
        registeredOn: null,
      },
      {
        seq: 2,
        kind: "AV",
        nature: "Construção",
        summary: "Averba-se a construção de casa.",
        registeredOn: null,
      },
    ],
    read: [
      act({ seq: 1, kind: "R", summary: "Compra  e venda a pessoa exemplo" }),
      act({ seq: 2, summary: "Averba-se a construção de casa com 80 m²." }),
      act({ seq: 3, kind: "R", nature: "Hipoteca", summary: "Hipoteca." }),
      act({ seq: 4, nature: "Cancelamento", summary: "Cancela-se." }),
    ],
  });
  assert.deepEqual(
    changes.map((c) => [c.kind, c.seq]),
    [
      ["retificacao", 2],
      ["novo-registro", 3],
      ["nova-averbacao", 4],
    ],
  );
  assert.match(changes[1]?.label ?? "", /^R-3-5 \(Hipoteca\)$/);
});

test("the Livro 2 opens on the date of the averbação de transporte", () => {
  assert.deepEqual(
    transportDate({
      openedOn: "1980-01-01",
      acts: [
        act({
          seq: 1,
          nature: "Transporte",
          summary: "Matrícula transportada do Livro 2-A.",
          registeredOn: "2024-03-10",
        }),
      ],
    }),
    { date: "2024-03-10", fromTransport: true },
  );
  assert.deepEqual(transportDate({ openedOn: "1980-01-01", acts: [] }), {
    date: "1980-01-01",
    fromTransport: false,
  });
});
