import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Database } from "@/db/index.ts";
import { riProtocols } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  closeDaysWith,
  closedDaysWith,
  closePhysicalDaysWith,
  lastImportedDayWith,
  pendingDaysWith,
  reopenDayWith,
} from "./ri-protocol-days.ts";
import { createProtocolWith, readProtocolInput } from "./ri-protocols.ts";

let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
});
after(async () => {
  await close();
});

// Fictitious data only (LGPD).
const TENANT = "cartorio-teste-ri-dias";
const ACTOR = { id: "u-oficial" };
const entry = {
  tenantSlug: TENANT,
  presenterName: "Pessoa Exemplo",
  titleKind: "Escritura",
};

test("a semana encerrada na sexta: cada dia com a sua data e o seu motivo", async () => {
  // 2026-11-16 (segunda) a 2026-11-22 (domingo); 20/11 é feriado (Consciência Negra).
  await db.insert(riProtocols).values([
    { ...entry, number: 1, presentedOn: "2026-11-16" },
    { ...entry, number: 2, presentedOn: "2026-11-16" },
    { ...entry, number: 3, presentedOn: "2026-11-18" },
  ]);
  const pending = await pendingDaysWith(db, TENANT, "2026-11-22");
  assert.equal(pending[0], "2026-11-16");
  assert.equal(pending.length, 7);
  const n = await closeDaysWith(
    db,
    TENANT,
    { from: "2026-11-16", to: "2026-11-22" },
    {},
    ACTOR,
    "2026-11-22",
  );
  assert.equal(n, 7);
  const days = await closedDaysWith(db, TENANT);
  assert.equal(days.get("2026-11-16")?.kind, "movimento");
  assert.equal(days.get("2026-11-16")?.count, 2);
  assert.equal(days.get("2026-11-17")?.kind, "sem-movimento");
  assert.equal(days.get("2026-11-20")?.kind, "feriado");
  assert.equal(days.get("2026-11-21")?.kind, "fim-de-semana");
  assert.deepEqual(await pendingDaysWith(db, TENANT, "2026-11-22"), []);
  // Closing again changes nothing.
  assert.equal(
    await closeDaysWith(
      db,
      TENANT,
      { from: "2026-11-16", to: "2026-11-22" },
      {},
      ACTOR,
      "2026-11-22",
    ),
    0,
  );
});

test("dia encerrado não aceita prenotação; reaberto, aceita", async () => {
  const input = readProtocolInput(
    {
      presenterName: "Pessoa Exemplo",
      titleKind: "Escritura pública",
      presentedOn: "17/11/2026",
    },
    "2026-11-26",
  );
  await assert.rejects(
    createProtocolWith(db, TENANT, input, {}, ACTOR),
    /já foi encerrado/,
  );
  await reopenDayWith(
    db,
    TENANT,
    "2026-11-17",
    "Título esquecido no balcão.",
    ACTOR,
  );
  const created = await createProtocolWith(db, TENANT, input, {}, ACTOR);
  assert.ok(created.number > 0);
  assert.deepEqual(await pendingDaysWith(db, TENANT, "2026-11-22"), [
    "2026-11-17",
  ]);
  await closeDaysWith(
    db,
    TENANT,
    { from: "2026-11-17", to: "2026-11-17" },
    {},
    ACTOR,
    "2026-11-22",
  );
  assert.equal((await closedDaysWith(db, TENANT)).get("2026-11-17")?.count, 1);
});

test("Protocolo importado: os dias do livro físico saem do aviso sem termo novo", async () => {
  const T = "cartorio-teste-livro-fisico";
  // Fictitious títulos of the paper book, imported long after their days.
  const { importProtocolsWith } = await import("./ri-protocols.ts");
  await importProtocolsWith(
    db,
    T,
    [
      {
        number: 1,
        presentedOn: "2026-11-02",
        presenter: "Pessoa A",
        titleKind: "Escritura",
        acts: "Registrado",
        status: "registrado",
        voided: false,
      },
      {
        number: 2,
        presentedOn: "2026-11-20",
        presenter: "Pessoa B",
        titleKind: "Escritura",
        acts: "Registrado",
        status: "registrado",
        voided: false,
      },
    ],
    { id: "u-oficial" },
  );
  const before1 = await pendingDaysWith(db, T, "2026-11-27");
  assert.equal(before1[0], "2026-11-02");
  assert.equal(await lastImportedDayWith(db, T), "2026-11-20");
  const n = await closePhysicalDaysWith(
    db,
    T,
    "2026-11-20",
    { id: "u-oficial" },
    "2026-11-27",
  );
  assert.equal(n, 19);
  const after1 = await pendingDaysWith(db, T, "2026-11-27");
  assert.deepEqual(after1, [
    "2026-11-21",
    "2026-11-22",
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
    "2026-11-27",
  ]);
  const closed = await closedDaysWith(db, T);
  assert.equal(closed.get("2026-11-02")?.kind, "livro-fisico");
  await assert.rejects(
    closePhysicalDaysWith(db, T, "2026-11-27", { id: "u" }, "2026-11-27"),
  );
});
