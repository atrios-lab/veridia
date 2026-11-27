import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readForeignInput } from "@/core/ri/foreign.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addForeignAverbacaoWith,
  createForeignWith,
  entriesOfQuarter,
  entryOf,
  listForeignReportsWith,
  listForeignWith,
  recordForeignReportWith,
  setForeignDeletedWith,
  updateForeignWith,
} from "./ri-foreign.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const T = "cartorio-teste-estrangeiro";
const ACTOR = { id: "u-oficial" };
const input = readForeignInput(
  {
    registeredOn: "15/05/2026",
    acquirerName: "Pessoa Estrangeira Exemplo",
    nationality: "Exemplolandesa",
    acquirerDocument: "Passaporte X000000",
    area: "10",
    municipality: "Cidade Exemplo",
    description: "Gleba rural.",
  },
  "2026-11-27",
);

test("lança em ordem, altera com histórico, averba e apaga sem tirar do banco", async () => {
  const id = await createForeignWith(db, T, input, ACTOR);
  await createForeignWith(db, T, input, ACTOR);
  let rows = await listForeignWith(db, T);
  assert.deepEqual(
    rows.map((r) => r.number),
    [1, 2],
  );
  await updateForeignWith(
    db,
    T,
    id,
    { ...input, area: "11" },
    "Área corrigida",
    ACTOR,
  );
  await addForeignAverbacaoWith(db, T, id, "Retificação de área", ACTOR);
  rows = await listForeignWith(db, T);
  const first = rows.find((r) => r.id === id);
  assert.equal(first?.area, "11");
  assert.equal(
    (first?.history as { before: { area: string } }[])[0]?.before.area,
    "10",
  );
  assert.match(entryOf(first as never).averbacoes[0] ?? "", /^Av-1/);
  await setForeignDeletedWith(db, T, id, true, "Lançado em duplicidade", ACTOR);
  assert.equal((await listForeignWith(db, T)).length, 1);
  assert.equal((await listForeignWith(db, T, { deleted: true })).length, 1);
  // The next number never reuses a deleted one.
  await createForeignWith(db, T, input, ACTOR);
  const numbers = (await listForeignWith(db, T)).map((r) => r.number);
  assert.deepEqual(numbers, [2, 3]);
  assert.equal(
    entriesOfQuarter(await listForeignWith(db, T), 2026, 2).length,
    2,
  );
});

test("registra o envio do trimestre", async () => {
  await recordForeignReportWith(
    db,
    T,
    {
      year: 2026,
      quarter: 2,
      kind: "positiva",
      recipients: ["Corregedoria Geral da Justiça"],
      sentOn: "2026-07-05",
      notes: "Malote Digital",
    },
    ACTOR,
  );
  const reports = await listForeignReportsWith(db, T);
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.quarter, 2);
});
