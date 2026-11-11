import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mayAccess } from "@/core/auth/access-hours.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  AccessHoursError,
  decideReleaseWith,
  getAccessHoursWith,
  listPeopleWith,
  requestReleaseWith,
  saveAccessWindowWith,
} from "./access-hours.ts";

let db: Database;
let close: () => Promise<void>;
// Fictitious people only (LGPD).
const OFFICE = "cartorio-marinho";
const at = (hhmm: string) => new Date(`2026-11-11T${hhmm}:00-03:00`);

before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values([
    {
      id: "titular",
      name: "Maria Exemplo da Silva",
      email: "maria.horario@exemplo.com",
      tenantSlug: OFFICE,
      role: "admin",
    },
    {
      id: "escrevente",
      name: "João Fictício de Souza",
      email: "joao.horario@exemplo.com",
      tenantSlug: OFFICE,
      role: "staff",
    },
  ]);
});
after(async () => {
  await close();
});

test("fora do horário: pede, o titular libera só hoje, depois retira", async () => {
  await assert.rejects(
    requestReleaseWith(
      db,
      OFFICE,
      { id: "escrevente", name: "João" },
      "oi",
      at("19:00"),
    ),
    AccessHoursError,
  );
  await requestReleaseWith(
    db,
    OFFICE,
    { id: "escrevente", name: "João Fictício de Souza" },
    "Conferir protocolo fictício com prazo amanhã cedo.",
    at("19:00"),
  );
  let hours = await getAccessHoursWith(db, OFFICE);
  assert.equal(hours.requests.length, 1);
  assert.equal(mayAccess(hours, "staff", "escrevente", at("19:05")), false);

  await decideReleaseWith(
    db,
    OFFICE,
    "escrevente",
    "hoje",
    "titular",
    at("19:10"),
  );
  hours = await getAccessHoursWith(db, OFFICE);
  assert.equal(hours.requests.length, 0);
  assert.equal(mayAccess(hours, "staff", "escrevente", at("23:00")), true);
  // Tomorrow night the release is over.
  assert.equal(
    mayAccess(
      hours,
      "staff",
      "escrevente",
      new Date("2026-11-12T19:00:00-03:00"),
    ),
    false,
  );

  await decideReleaseWith(
    db,
    OFFICE,
    "escrevente",
    "sempre",
    "titular",
    at("19:20"),
  );
  hours = await getAccessHoursWith(db, OFFICE);
  assert.ok(hours.always.includes("escrevente"));
  await decideReleaseWith(
    db,
    OFFICE,
    "escrevente",
    "retirar",
    "titular",
    at("19:30"),
  );
  hours = await getAccessHoursWith(db, OFFICE);
  assert.equal(mayAccess(hours, "staff", "escrevente", at("19:31")), false);

  const acts = (
    await db.select({ action: auditLog.action }).from(auditLog)
  ).map((row) => row.action);
  for (const action of [
    "access-hours.request",
    "access-hours.release",
    "access-hours.revoke",
  ]) {
    assert.ok(acts.includes(action), action);
  }
  // The holder is not on the list the hours apply to.
  assert.deepEqual(
    (await listPeopleWith(db, OFFICE)).map((p) => p.id),
    ["escrevente"],
  );
});

test("o titular muda o horário; horário invertido não salva", async () => {
  await assert.rejects(
    saveAccessWindowWith(
      db,
      OFFICE,
      { enabled: true, start: "18:00", end: "07:00" },
      "titular",
    ),
    AccessHoursError,
  );
  await saveAccessWindowWith(
    db,
    OFFICE,
    { enabled: true, start: "08:00", end: "17:00" },
    "titular",
  );
  const hours = await getAccessHoursWith(db, OFFICE);
  assert.equal(hours.start, "08:00");
  assert.equal(mayAccess(hours, "staff", "escrevente", at("07:30")), false);
});
