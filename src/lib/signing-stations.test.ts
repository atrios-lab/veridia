import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { signedDocuments, stationCertificatePolicies } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createStationWith,
  finishJobWith,
  jobStatusWith,
  linkJobWith,
  listStationsWith,
  pulseWith,
  releaseWith,
  requestJobWith,
  revokeStationWith,
  setPolicyWith,
  sharedForUserWith,
  stationByKeyWith,
  stationHistoryWith,
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
        kind: "pedidos",
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
      grants: [
        { userId: "escrevente", kinds: ["pedidos"] },
        { userId: "outra-pessoa", kinds: [] },
      ],
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
        kind: "pedidos",
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
        kind: "pedidos",
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
      kind: "pedidos",
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
      grants: [{ userId: "escrevente", kinds: [] }],
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
        kind: "pedidos",
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
      kind: "pedidos",
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

test("controle total: o que cada um assina, até que horas, e o histórico do que assinou", async () => {
  // 13:00 UTC = 10:00 no cartório.
  const t0 = new Date("2026-11-16T13:00:00Z");
  const { key } = await createStationWith(db, OFFICE, "Sala 2", "tabeliao");
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
      grants: [
        {
          userId: "escrevente",
          kinds: ["assinador"],
          from: "08:00",
          until: "12:00",
          expiresOn: "2026-11-30",
        },
        // Someone from outside the office never gets in.
        { userId: "de-fora", kinds: [] },
      ],
    },
    "tabeliao",
  );
  const [policy] = await db
    .select({ grants: stationCertificatePolicies.grants })
    .from(stationCertificatePolicies);
  assert.ok(policy);
  const saved = (await sharedForUserWith(db, OFFICE, "escrevente", t0)).find(
    (c) => c.estacao.id === station.id,
  );
  assert.deepEqual(saved?.estacao.autorizacao, {
    userId: "escrevente",
    kinds: ["assinador"],
    from: "08:00",
    until: "12:00",
    expiresOn: "2026-11-30",
  });
  assert.equal((await sharedForUserWith(db, OFFICE, "de-fora", t0)).length, 0);
  await assert.rejects(
    setPolicyWith(
      db,
      OFFICE,
      {
        stationId: station.id,
        certificateKey: CERT.id,
        shared: true,
        mode: "cada",
        grants: [
          { userId: "escrevente", kinds: [], from: "18:00", until: "08:00" },
        ],
      },
      "tabeliao",
    ),
    /antes do horário de fim/,
  );

  const ask = (kind: "assinador" | "iss", at: Date) =>
    requestJobWith(
      db,
      OFFICE,
      {
        stationId: station.id,
        certificateKey: CERT.id,
        toBeSigned: "AAAA",
        title: "Documento",
        kind,
      },
      { id: "escrevente", name: "Escrevente Fictícia" },
      at,
    );
  await assert.rejects(ask("iss", t0), /não está autorizado a assinar/);
  // 15:30 UTC = 12:30 no cartório: fora do horário. (The station was seen
  // at t0; a fresh pulse keeps it on.)
  const lunch = new Date("2026-11-16T15:30:00Z");
  await pulseWith(db, station, { certificates: [CERT] }, lunch);
  await assert.rejects(ask("assinador", lunch), /das 08:00 às 12:00/);
  // Dezembro: a autorização venceu.
  const december = new Date("2026-12-01T13:00:00Z");
  await pulseWith(db, station, { certificates: [CERT] }, december);
  await assert.rejects(ask("assinador", december), /venceu/);

  const t1 = new Date("2026-11-16T13:10:00Z");
  await pulseWith(db, station, { certificates: [CERT] }, t1);
  const jobId = await ask("assinador", t1);
  const [task] = await pulseWith(
    db,
    station,
    { certificates: [CERT] },
    new Date("2026-11-16T13:10:03Z"),
  );
  assert.equal(task?.id, jobId);
  await finishJobWith(db, station, jobId, {
    assinatura: "c2lnbmF0dXJlLWZpY3RpY2lh",
  });
  const [doc] = await db
    .insert(signedDocuments)
    .values({
      tenantSlug: OFFICE,
      code: "AB12CD34EF56",
      title: "Declaração fictícia",
      originalName: "declaracao.pdf",
      originalSha256: "0".repeat(64),
      pageCount: 1,
      fileExpiresAt: new Date("2027-11-16T00:00:00Z"),
    })
    .returning({ id: signedDocuments.id });
  assert.ok(doc);
  // Only the person who asked links it, and only once.
  assert.equal(await linkJobWith(db, OFFICE, jobId, "auxiliar", doc.id), false);
  assert.equal(
    await linkJobWith(db, OFFICE, jobId, "escrevente", doc.id),
    true,
  );
  assert.equal(
    await linkJobWith(db, OFFICE, jobId, "escrevente", doc.id),
    false,
  );

  const mine = await stationHistoryWith(db, OFFICE, {
    userId: "escrevente",
    kind: "assinador",
  });
  assert.equal(mine.length, 1);
  assert.deepEqual(
    {
      title: mine[0]?.title,
      code: mine[0]?.signedCode,
      holder: mine[0]?.holderName,
      kind: mine[0]?.kind,
      status: mine[0]?.status,
      station: mine[0]?.stationName,
    },
    {
      title: "Declaração fictícia",
      code: "AB12CD34EF56",
      holder: "TABELIAO FICTICIO",
      kind: "assinador",
      status: "assinada",
      station: "Sala 2",
    },
  );
  assert.deepEqual(
    await stationHistoryWith(db, OFFICE, { userId: "auxiliar" }),
    [],
  );
  assert.ok((await stationHistoryWith(db, OFFICE)).length >= 3);
});
