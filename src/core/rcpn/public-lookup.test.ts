import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerLookup,
  isFullName,
  type LookupCandidate,
  sameFullName,
} from "./public-lookup.ts";
import type { RcpnPerson } from "./record.ts";

// Fictitious people only.
function person(over: Partial<RcpnPerson>): RcpnPerson {
  return {
    role: "registrado",
    name: "Joana Exemplo da Silva",
    marriedName: "",
    motherName: "Maria Fictícia da Silva",
    fatherName: "José Teste da Silva",
    birthDate: "1960-05-10",
    profession: "",
    fatherProfession: "Agricultor",
    motherProfession: "",
    ...over,
  };
}

const birth: LookupCandidate = {
  kind: "nascimento",
  subtype: "",
  person: person({}),
};
const marriage: LookupCandidate = {
  kind: "casamento",
  subtype: "",
  person: person({
    role: "conjuge2",
    marriedName: "Joana Exemplo da Silva Souza",
    profession: "Professora",
  }),
};

test("nome completo: todas as palavras, sem acento e sem de/da", () => {
  assert.equal(
    sameFullName("JOANA EXEMPLO SILVA", "Joana Exemplo da Silva"),
    true,
  );
  assert.equal(sameFullName("Joana Silva", "Joana Exemplo da Silva"), false);
  assert.equal(isFullName("Joana"), false);
  assert.equal(isFullName("Joana Silva"), true);
});

test("com nome completo e mãe, consta; data é opcional", () => {
  const answer = answerLookup(
    {
      name: "Joana Exemplo da Silva",
      mother: "Maria Ficticia da Silva",
      birthDate: "",
    },
    [birth, marriage],
  );
  assert.equal(answer.found, true);
  if (!answer.found) return;
  assert.deepEqual(
    answer.items.map((i) => i.kind),
    ["nascimento", "casamento"],
  );
  // At birth, the parents' professions; at marriage, the person's own.
  assert.deepEqual(answer.items[0]?.professions, [
    { whose: "do pai", value: "Agricultor" },
  ]);
  assert.deepEqual(answer.items[1]?.professions, [
    { whose: "do cônjuge consultado", value: "Professora" },
  ]);
});

test("data informada e diferente não confirma; nome parcial ou mãe errada também não", () => {
  const base = {
    name: "Joana Exemplo da Silva",
    mother: "Maria Fictícia da Silva",
  };
  assert.equal(
    answerLookup({ ...base, birthDate: "1961-01-01" }, [birth]).found,
    false,
  );
  const ok = answerLookup({ ...base, birthDate: "1960-05-10" }, [birth]);
  assert.equal(ok.found && ok.dateChecked, true);
  assert.equal(
    answerLookup({ ...base, name: "Joana Silva", birthDate: "" }, [birth])
      .found,
    false,
  );
  assert.equal(
    answerLookup({ ...base, mother: "Maria Outra", birthDate: "" }, [birth])
      .found,
    false,
  );
});

test("sem profissão nos dados, diz que o livro pode trazer, sem afirmar ausência", () => {
  const answer = answerLookup(
    {
      name: "Joana Exemplo da Silva",
      mother: "Maria Fictícia da Silva",
      birthDate: "",
    },
    [{ ...birth, person: person({ fatherProfession: "" }) }],
  );
  assert.equal(answer.found && answer.items[0]?.professionMissing, true);
});
