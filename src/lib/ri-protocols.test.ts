import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { EMPTY_AUX } from "@/core/ri/auxiliary.ts";
import { EMPTY_CONDO, EMPTY_RURAL } from "@/core/ri/property.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import { createActWith, createPropertyWith } from "./ri.ts";
import {
  countersOf,
  createProtocolWith,
  issueRequirementsWith,
  listProtocolsWith,
  protocolWith,
  readProtocolInput,
  readRequirements,
  reentryWith,
  registerProtocolWith,
  setProtocolStatusWith,
  setProtocolVoidedWith,
  updateProtocolWith,
} from "./ri-protocols.ts";

let db: Database;
let close: () => Promise<void>;
// Fictitious data only (LGPD).
const TENANT = "cartorio-teste-ri-protocolo";
const ACTOR = { id: "u-oficial" };
const NO_HOLIDAYS = {};
let propertyId = "";

before(async () => {
  ({ db, close } = await createTestDb());
  propertyId = await createPropertyWith(
    db,
    TENANT,
    {
      book: 2,
      number: 500,
      recordKind: 1,
      status: 0,
      cnm: "",
      cnmInPgv: false,
      openedOn: "2001-01-01",
      origin: "",
      ficha: "",
      location: 0,
      propertyKind: 1,
      streetKind: 250,
      street: "das Flores",
      streetNumber: "1",
      district: "Centro",
      cep: "",
      complement: "",
      quadra: "",
      setor: "",
      conjunto: "",
      lote: "",
      loteamento: "",
      contributors: [],
      rural: { ...EMPTY_RURAL },
      condo: { ...EMPTY_CONDO },
      area: "",
      auxKind: "",
      linkedNumbers: "",
      priorActs: 0,
      aux: { ...EMPTY_AUX, parties: [] },
      description: "",
      notes: "",
    },
    ACTOR,
    { owners: [{ name: "ANA FICTÍCIA", document: "11144477735" }] },
  );
});
after(async () => {
  await close();
});

const form = (over: Record<string, unknown> = {}) =>
  readProtocolInput(
    {
      presentedOn: "02/03/2026",
      presenterName: "Bruno Fictício",
      titleKind: "Escritura pública",
      actsSummary: "Compra e venda",
      matriculas: "500; 9.999",
      ...over,
    },
    "2026-03-10",
  );

test("número de ordem e prazos em dias úteis (arts. 188 e 205)", async () => {
  // 02/03/2026 is a Monday: 10 dias úteis → 16/03; 20 → 30/03.
  const first = await createProtocolWith(
    db,
    TENANT,
    form(),
    NO_HOLIDAYS,
    ACTOR,
  );
  assert.equal(first.number, 1);
  assert.deepEqual(first.missing, ["9.999"]);
  const row = await protocolWith(db, TENANT, first.id);
  assert.equal(row?.qualifyBy, "2026-03-16");
  assert.equal(row?.prenotationEnds, "2026-03-30");
  assert.deepEqual(row?.propertyIds, [propertyId]);
  const second = await createProtocolWith(
    db,
    TENANT,
    form({ fast: "on" }),
    NO_HOLIDAYS,
    ACTOR,
  );
  assert.equal(second.number, 2);
  assert.equal(
    (await protocolWith(db, TENANT, second.id))?.qualifyBy,
    "2026-03-09",
  );
  // Exame e cálculo: its own numbering, no prenotação (art. 12).
  const exam = await createProtocolWith(
    db,
    TENANT,
    form({ kind: "exame" }),
    NO_HOLIDAYS,
    ACTOR,
  );
  assert.equal(exam.number, 1);
  assert.equal(
    (await protocolWith(db, TENANT, exam.id))?.prenotationEnds,
    null,
  );
  assert.throws(() => form({ presentedOn: "11/03/2026" }), /depois de hoje/);
});

test("nota devolutiva, reingresso em 5 dias úteis e registro com selo", async () => {
  const { id, number } = await createProtocolWith(
    db,
    TENANT,
    form(),
    NO_HOLIDAYS,
    ACTOR,
  );
  const reqs = readRequirements(
    "1. Apresente a certidão de ITBI | Lei nº 6.015/1973, art. 289\nConsulte a CNIB",
  );
  assert.deepEqual(reqs[0], {
    text: "Apresente a certidão de ITBI",
    source: "Lei nº 6.015/1973, art. 289",
  });
  await issueRequirementsWith(db, TENANT, id, reqs, ACTOR);
  assert.equal((await protocolWith(db, TENANT, id))?.status, "exigencia");
  await reentryWith(db, TENANT, id, "13/03/2026", NO_HOLIDAYS, ACTOR);
  const back = await protocolWith(db, TENANT, id);
  assert.equal(back?.status, "prenotado");
  assert.equal(back?.qualifyBy, "2026-03-20");
  await assert.rejects(
    registerProtocolWith(db, TENANT, id, ACTOR),
    /Lance antes o ato/,
  );
  const act = {
    kind: "R" as const,
    effect: "transmissao" as const,
    nature: "Compra e venda",
    registeredOn: "2026-03-18",
    summary: "",
    cancelsActId: null,
    protocol: String(number),
    seal: "",
    valueCents: null,
    parties: [
      {
        name: "BRUNO FICTÍCIO",
        document: "",
        role: "adquirente" as const,
        share: "",
      },
    ],
  };
  await createActWith(db, TENANT, propertyId, act, ACTOR);
  await assert.rejects(
    registerProtocolWith(db, TENANT, id, ACTOR),
    /Falta o selo/,
  );
  await createActWith(
    db,
    TENANT,
    propertyId,
    { ...act, seal: "SELO-FICTICIO" },
    ACTOR,
  );
  // The first ato still has no selo: still refused.
  await assert.rejects(
    registerProtocolWith(db, TENANT, id, ACTOR),
    /Falta o selo/,
  );
});

test("situação com motivo, apagar só marca e restaura, edição guarda o antes", async () => {
  const { id } = await createProtocolWith(
    db,
    TENANT,
    form(),
    NO_HOLIDAYS,
    ACTOR,
  );
  await assert.rejects(
    setProtocolStatusWith(db, TENANT, id, "desistencia", "", ACTOR),
    /motivo/,
  );
  await setProtocolStatusWith(
    db,
    TENANT,
    id,
    "desistencia",
    "Pedido do apresentante",
    ACTOR,
  );
  assert.equal((await protocolWith(db, TENANT, id))?.status, "desistencia");
  const changed = await updateProtocolWith(
    db,
    TENANT,
    id,
    form({ presenterName: "Bruno Fictício Filho" }),
    NO_HOLIDAYS,
    ACTOR,
  );
  assert.equal(changed.changed, 1);
  await setProtocolVoidedWith(
    db,
    TENANT,
    id,
    true,
    "Lançado por engano",
    ACTOR,
  );
  assert.ok(
    (await listProtocolsWith(db, TENANT, { voided: true })).some(
      (r) => r.id === id,
    ),
  );
  await setProtocolVoidedWith(db, TENANT, id, false, "Era válido", ACTOR);
  const row = await protocolWith(db, TENANT, id);
  assert.equal(row?.voidedAt, null);
  assert.ok(((row?.history as unknown[]) ?? []).length >= 5);
  const counters = countersOf(
    await listProtocolsWith(db, TENANT),
    "2026-03-17",
  );
  assert.ok(counters.open >= 1);
  assert.ok(counters.qualifyLate >= 1);
});
