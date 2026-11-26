import assert from "node:assert/strict";
import { test } from "node:test";
import type { Act } from "@/core/ri/acts.ts";
import { ownerCountOf, pendencyKey } from "./ri-pendencies.ts";

// Fictitious data only (LGPD).
const act = (effect: Act["effect"], role: string): Act => ({
  id: "a1",
  seq: 1,
  kind: "R",
  effect,
  nature: "Ato",
  registeredOn: null,
  summary: "",
  cancelsActId: null,
  parties: [
    {
      personId: "p1",
      name: "Pessoa Exemplo",
      document: "",
      role: role as Act["parties"][number]["role"],
      share: "",
    },
  ],
});

test("proprietário lançado num ato lido da ficha antiga também conta", () => {
  assert.equal(ownerCountOf([act("transmissao", "adquirente")]), 1);
  assert.equal(ownerCountOf([act("outro", "titular")]), 1);
  assert.equal(ownerCountOf([act("onus", "credor")]), 0);
  assert.equal(pendencyKey("proprietario", ["b", "a"]), "proprietario:a,b");
});
