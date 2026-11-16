import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createStationWith,
  finishJobWith,
  jobStatusWith,
  listStationsWith,
  pulseWith,
  releaseWith,
  requestJobWith,
  revokeStationWith,
  setPolicyWith,
  sharedForUserWith,
  stationByKeyWith,
} from "./signing-stations.ts";

// Fictitious office, people and certificate only.
const OFFICE = "cartorio-estacao";
const CERT = {
  id: "B".repeat(40),
  nome: "TABELIAO FICTICIO:11144477735",
  emissor: "AC Teste",
  validade: "2027-01-01T00:00:00Z",
  certificado: "MIIBfake",
  cadeia: ["MIIBfake"],
};
let db: Database;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await createTestDb());
  for (const id of ["escrevente", "auxiliar", "tabeliao"]) {
    await db.insert(user).values({
      id,
      name: `Pessoa ${id}`,
      email: `${id}@exemplo.com`,
      emailVerified: true,
      tenantSlug: OFFICE,
      role: "staff",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
});
after(async () => {
  await close();
});

test("estação compartilha o A3: pede, assina uma vez só, devolve, e desliga", async () => {
  const t0 = new Date("2026-11-16T13:00:00Z");
  const { key } = await createStationWith(
    db,
    OFFICE,
    "Sala do Tabelião",
    "tabeliao",
  );
  const station = await stationByKeyWith(db, key);
  assert.ok(station);
  assert.deepEqual(
    await pulseWith(
      db,
      station,
      { version: "1.1.0", certificates: [CERT] },
      t0,
    ),
    [],
  );

  // Not shared yet: nobody asks.
  await assert.rejects(
    requestJobWith(
      db,
      OFFICE,
      {
        stationId: station.id,
        certificateKey: CERT.id,
        toBeSigned: "AAAA",
        title: "Doc",
      },
      { id: "escrevente", name: "Escrevente" },
      t0,
    ),
    /não está compartilhado/,
  );

  // Shared by period with the escrevente only; not released yet.
  await setPolicyWith(
    db,
    OFFICE,
    {
      stationId: station.id,
      certificateKey: CERT.id,
      shared: true,
      mode: "periodo",
      signerIds: ["escrevente", "outra-pessoa"],
    },
    "tabeliao",
  );
  const shared = await sharedForUserWith(db, OFFICE, "escrevente", t0);
  assert.equal(shared.length, 1);
  assert.equal(shared[0]?.estacao.online, true);
  assert.deepEqual(await sharedForUserWith(db, OFFICE, "auxiliar", t0), []);
  await assert.rejects(
    requestJobWith(
      db,
      OFFICE,
      {
        stationId: station.id,
        certificateKey: CERT.id,
        toBeSigned: "AAAA",
        title: "Doc",
      },
      { id: "escrevente", name: "Escrevente" },
      t0,
    ),
    /não está liberado/,
  );
  await releaseWith(
    db,
    OFFICE,
    {
      stationId: station.id,
      certificateKey: CERT.id,
      until: new Date("2026-11-16T17:00:00Z"),
    },
    "tabeliao",
  );
  await assert.rejects(
    requestJobWith(
      db,
      OFFICE,
      {
        stationId: station.id,
        certificateKey: CERT.id,
        toBeSigned: "AAAA",
        title: "Doc",
      },
      { id: "auxiliar", name: "Auxiliar" },
      t0,
    ),
    /não foi autorizado/,
  );
  const jobId = await requestJobWith(
    db,
    OFFICE,
    {
      stationId: station.id,
      certificateKey: CERT.id,
      toBeSigned: "AAAA",
      title: "Certidão de teste",
    },
    { id: "escrevente", name: "Escrevente Fictícia" },
    t0,
  );
  assert.deepEqual(await jobStatusWith(db, OFFICE, jobId, "escrevente", t0), {
    status: "aguardando",
  });

  const t1 = new Date("2026-11-16T13:00:03Z");
  const tasks = await pulseWith(
    db,
    station,
    { version: "1.1.0", certificates: [CERT] },
    t1,
  );
  assert.deepEqual(
    tasks.map((t) => [t.id, t.modo, t.pedidoPor, t.titulo]),
    [[jobId, "periodo", "Escrevente Fictícia", "Certidão de teste"]],
  );
  // Handed over once: never twice.
  assert.deepEqual(
    await pulseWith(
      db,
      station,
      { certificates: [CERT] },
      new Date("2026-11-16T13:00:06Z"),
    ),
    [],
  );
  assert.equal(
    await finishJobWith(db, station, jobId, {
      assinatura: "c2lnbmF0dXJlLWZpY3RpY2lh",
    }),
    true,
  );
  assert.deepEqual(await jobStatusWith(db, OFFICE, jobId, "escrevente", t1), {
    status: "assinada",
    signature: "c2lnbmF0dXJlLWZpY3RpY2lh",
  });
  // Someone else cannot read another person's job.
  assert.equal(
    (await jobStatusWith(db, OFFICE, jobId, "auxiliar", t1)).status,
    "falhou",
  );

  await revokeStationWith(db, OFFICE, station.id, "tabeliao");
  assert.equal(await stationByKeyWith(db, key), undefined);
  assert.deepEqual(await listStationsWith(db, OFFICE, t1), []);
});

test("estação desligada não recebe pedido; no modo confirmar não precisa de liberação", async () => {
  const t0 = new Date("2026-11-16T14:00:00Z");
  const { key } = await createStationWith(db, OFFICE, "Balcão 1", "tabeliao");
  const station = await stationByKeyWith(db, key);
  assert.ok(station);
  await pulseWith(db, station, { certificates: [CERT] }, t0);
  await setPolicyWith(
    db,
    OFFICE,
    {
      stationId: station.id,
      certificateKey: CERT.id,
      shared: true,
      mode: "cada",
      signerIds: ["escrevente"],
    },
    "tabeliao",
  );
  const later = new Date("2026-11-16T14:05:00Z");
  await assert.rejects(
    requestJobWith(
      db,
      OFFICE,
      {
        stationId: station.id,
        certificateKey: CERT.id,
        toBeSigned: "AAAA",
        title: "Doc",
      },
      { id: "escrevente", name: "Escrevente" },
      later,
    ),
    /está desligada/,
  );
  const jobId = await requestJobWith(
    db,
    OFFICE,
    {
      stationId: station.id,
      certificateKey: CERT.id,
      toBeSigned: "AAAA",
      title: "Nota",
    },
    { id: "escrevente", name: "Escrevente" },
    new Date("2026-11-16T14:00:05Z"),
  );
  const [task] = await pulseWith(
    db,
    station,
    { certificates: [CERT] },
    new Date("2026-11-16T14:00:08Z"),
  );
  assert.equal(task?.modo, "cada");
  await finishJobWith(db, station, jobId, { erro: "recusada na estação" });
  assert.deepEqual(
    await jobStatusWith(
      db,
      OFFICE,
      jobId,
      "escrevente",
      new Date("2026-11-16T14:00:09Z"),
    ),
    { status: "falhou", message: "recusada na estação" },
  );
});
