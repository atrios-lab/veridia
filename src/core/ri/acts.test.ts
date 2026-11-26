import assert from "node:assert/strict";
import { test } from "node:test";
import { situationOf } from "./acts.ts";

test("na matrícula aberta por cédula, o devedor é o proprietário", () => {
  const owners = situationOf([
    {
      id: "c1",
      seq: 1,
      kind: "R",
      effect: "onus",
      nature: "Cédula rural pignoratícia e hipotecária",
      registeredOn: null,
      summary: "",
      cancelsActId: null,
      parties: [
        {
          personId: "d",
          name: "Pessoa Exemplo",
          document: "",
          role: "devedor",
          share: "",
        },
        {
          personId: "c",
          name: "Banco Exemplo S/A",
          document: "",
          role: "credor",
          share: "",
        },
      ],
    },
  ]).owners;
  assert.deepEqual(
    owners.map((o) => o.name),
    ["Pessoa Exemplo"],
  );
});
