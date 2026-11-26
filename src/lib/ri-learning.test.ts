import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  forgetLearnedActWith,
  learnActWith,
  listLearnedActsWith,
} from "./ri-learning.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

const T = "cartorio-teste-aprendizado";
const A = { id: "u-oficial" };

test("cada ato salvo ensina; a última correção vale; esquecer só marca", async () => {
  await learnActWith(
    db,
    T,
    { nature: "Compra e venda", kind: "R", effect: "transmissao" },
    A,
  );
  await learnActWith(
    db,
    T,
    { nature: "COMPRA E VENDA", kind: "R", effect: "transmissao" },
    A,
  );
  await learnActWith(
    db,
    T,
    { nature: "Cédula rural pignoratícia", kind: "R", effect: "onus" },
    A,
  );
  await learnActWith(
    db,
    T,
    { nature: "Cedula rural pignoraticia", kind: "AV", effect: "onus" },
    A,
  );
  let list = await listLearnedActsWith(db, T);
  assert.equal(list.find((l) => l.cue === "compra venda")?.uses, 2);
  assert.equal(list.find((l) => l.cue.startsWith("cedula"))?.kind, "AV");
  const id = list.find((l) => l.cue === "compra venda")?.id as string;
  await forgetLearnedActWith(db, T, id, "teste", A);
  await learnActWith(
    db,
    T,
    { nature: "Compra e venda", kind: "R", effect: "transmissao" },
    A,
  );
  list = await listLearnedActsWith(db, T);
  assert.equal(
    list.some((l) => l.cue === "compra venda"),
    false,
  );
});
