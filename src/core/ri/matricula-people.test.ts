import assert from "node:assert/strict";
import { test } from "node:test";
import { type Act, matriculaPeople } from "./acts.ts";

// Fictitious names only (LGPD).
const act = (patch: Partial<Act>): Act => ({
  id: `a${patch.seq}`,
  seq: 1,
  kind: "R",
  effect: "transmissao",
  nature: "",
  registeredOn: null,
  summary: "",
  cancelsActId: null,
  parties: [],
  ...patch,
});
const person = (
  id: string,
  name: string,
  role: Act["parties"][number]["role"],
) => ({
  personId: id,
  name,
  document: "",
  role,
  share: "",
});

test("o Livro 5 da matrícula: proprietário atual, anterior e credor", () => {
  const people = matriculaPeople([
    act({
      seq: 1,
      kind: "M",
      effect: "titularidade",
      parties: [person("p1", "Ana Exemplo", "titular")],
    }),
    act({
      seq: 2,
      parties: [
        person("p1", "Ana Exemplo", "transmitente"),
        person("p2", "Bruno Exemplo", "adquirente"),
      ],
    }),
    act({
      seq: 3,
      effect: "onus",
      nature: "Hipoteca",
      parties: [
        person("p3", "Banco Exemplo S.A.", "credor"),
        person("p2", "Bruno Exemplo", "devedor"),
      ],
    }),
  ]);
  assert.deepEqual(
    people.map((p) => [p.name, p.acts.join(","), p.situation.join(",")]),
    [
      ["Ana Exemplo", "Situação na migração,R-2", "Proprietário anterior"],
      ["Banco Exemplo S.A.", "R-3", "Credor"],
      ["Bruno Exemplo", "R-2,R-3", "Proprietário atual,Devedor"],
    ],
  );
});
