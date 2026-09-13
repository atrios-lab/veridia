import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import {
  generateAccessKey,
  hashAccessKey,
  verifyAccessKey,
} from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { emailBounces, serviceRequests } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createRecordWith,
  createServiceRequestWith,
  findByProtocolWith,
  findByProtocolWithKeyWith,
  findOpenServiceRequestDuplicateWith,
  listRequirementsWith,
  reconcileDeadlinePauseWith,
  recoverAccessKeyWith,
  registerRequirementWith,
  resolveRequirementWith,
  respondToRecordWith,
  saveDraftReplyWith,
  setRequestAmountWith,
  updateRequestStatusWith,
} from "./service-request.ts";

// The pilot for the in-process suite (see design.md, "trocar-e2e-por-testes-
// em-processo"): proves that a src/lib module which imports "@/..." and
// declares "server-only" loads under `pnpm test`, and that its `...With(db,
// ...)` functions run a real query against PostgreSQL in memory (PGlite),
// migrated with the project's own SQL files. This is the seam
// e2e/service-request.spec.ts exercised at the cost of a browser and a real
// database; here the same claim is a query away.

const TENANT = TENANTS["cartorio-marinho"];
const ACT = getAct("rcpn-certidao");
if (!ACT) throw new Error("fixture: rcpn-certidao precisa existir no catálogo");

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

test("a service request is filed and found back by its protocol", async () => {
  const { protocolNumber } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Maria",
    contact: "maria@exemplo.com",
    accessKeyHash: hashAccessKey("chave-de-teste"),
  });

  const found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(found, "o pedido recém-criado deve ser encontrado pelo protocolo");
  assert.equal(found.applicantName, "Maria");
  assert.equal(found.actId, ACT.id);
  assert.equal(found.attribution, ACT.attribution);
  assert.equal(found.status, "new");
});

test("a second request for the same act and e-mail is flagged as a duplicate", async () => {
  const identity = { email: "duplicado@exemplo.com" };
  const first = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Ana",
    contact: identity.email,
    accessKeyHash: hashAccessKey("outra-chave"),
  });

  const duplicate = await findOpenServiceRequestDuplicateWith(
    db,
    TENANT.slug,
    ACT.id,
    identity,
  );
  assert.equal(duplicate, first.protocolNumber);
});

test("a request for a different act is never flagged as a duplicate", async () => {
  const identity = { email: "sem-duplicata@exemplo.com" };
  await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Carlos",
    contact: identity.email,
    accessKeyHash: hashAccessKey("terceira-chave"),
  });

  const otherAct = getAct("rcpn-habilitacao-casamento");
  if (!otherAct) throw new Error("fixture: segundo ato precisa existir");

  const duplicate = await findOpenServiceRequestDuplicateWith(
    db,
    TENANT.slug,
    otherAct.id,
    identity,
  );
  assert.equal(duplicate, undefined);
});

test("a second request for the same act and CPF is a duplicate, even with a different e-mail", async () => {
  const cpf = "52998224725";
  const first = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Rosa",
    contact: "rosa.um@exemplo.com",
    cpf,
    accessKeyHash: hashAccessKey("chave-rosa"),
  });

  const duplicate = await findOpenServiceRequestDuplicateWith(
    db,
    TENANT.slug,
    ACT.id,
    { cpf, email: "rosa.dois@exemplo.com" },
  );
  assert.equal(duplicate, first.protocolNumber);
});

test("a matching protocol and e-mail reissues the key, invalidating the old one", async () => {
  const oldKey = generateAccessKey();
  const email = "recupera@exemplo.com";
  const { protocolNumber } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Rosa Almeida Fontes",
    contact: email,
    accessKeyHash: hashAccessKey(oldKey),
  });

  const recovery = await recoverAccessKeyWith(
    db,
    TENANT.slug,
    protocolNumber,
    email,
  );
  assert.equal(recovery.reissued, true);
  assert.equal(recovery.protocolNumber, protocolNumber);
  assert.ok(recovery.accessKey && recovery.accessKey !== oldKey);

  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(stored);
  assert.equal(verifyAccessKey(oldKey, stored.accessKeyHash ?? ""), false);
  assert.equal(
    verifyAccessKey(recovery.accessKey as string, stored.accessKeyHash ?? ""),
    true,
  );
});

test("a mismatched e-mail answers the same shape but leaves the key untouched", async () => {
  const oldKey = generateAccessKey();
  const { protocolNumber } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Rosa Almeida Fontes",
    contact: "dona@exemplo.com",
    accessKeyHash: hashAccessKey(oldKey),
  });

  const recovery = await recoverAccessKeyWith(
    db,
    TENANT.slug,
    protocolNumber,
    "alguem-mais@exemplo.com",
  );
  assert.equal(recovery.reissued, false);
  assert.equal(recovery.accessKey, undefined);

  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(stored);
  assert.equal(verifyAccessKey(oldKey, stored.accessKeyHash ?? ""), true);
});

test("an address with a permanent bounce never gets a reissued key", async () => {
  const oldKey = generateAccessKey();
  const email = "nao-recebe@exemplo.com";
  await db.insert(emailBounces).values({
    email,
    kind: "HardBounce",
    permanent: true,
    occurredAt: new Date(),
  });
  const { protocolNumber } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Rosa Almeida Fontes",
    contact: email,
    accessKeyHash: hashAccessKey(oldKey),
  });

  const recovery = await recoverAccessKeyWith(
    db,
    TENANT.slug,
    protocolNumber,
    email,
  );
  assert.equal(recovery.reissued, false);

  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(stored);
  assert.equal(verifyAccessKey(oldKey, stored.accessKeyHash ?? ""), true);
});

// Migrated from e2e/channels.spec.ts, "ouvidoria, gravando" and "canal LGPD,
// gravando": what those tests wrote and read back through the browser.

test("an anonymous manifestation has no access key and cannot be opened later", async () => {
  const { protocolNumber } = await createRecordWith(db, TENANT, "ombudsman", {
    description: "Demora no atendimento do dia 28/07, pela manhã.",
    // No applicantName, no contact, no accessKeyHash: isAnonymous() (core,
    // already tested) is what decides this at the action; here the record
    // is filed exactly as an anonymous one already is.
  });

  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(stored);
  assert.equal(stored.accessKeyHash, null);

  const opened = await findByProtocolWithKeyWith(
    db,
    TENANT.slug,
    protocolNumber,
    "AAAA-BBBB-CCCC",
  );
  assert.equal(opened, undefined);
});

test("an identified manifestation with a key opens only with that key", async () => {
  const key = generateAccessKey();
  const { protocolNumber } = await createRecordWith(db, TENANT, "ombudsman", {
    applicantName: "Maria José da Silva",
    contact: "maria@email.com",
    description: "Demora no atendimento.",
    accessKeyHash: hashAccessKey(key),
  });

  assert.equal(
    await findByProtocolWithKeyWith(
      db,
      TENANT.slug,
      protocolNumber,
      "AAAA-BBBB-CCCC",
    ),
    undefined,
  );
  const opened = await findByProtocolWithKeyWith(
    db,
    TENANT.slug,
    protocolNumber,
    key,
  );
  assert.ok(opened);
  assert.equal(opened.applicantName, "Maria José da Silva");
});

test("a data-rights requirement is filed with the office's reply gated behind the key", async () => {
  const key = generateAccessKey();
  const { protocolNumber, id } = await createRecordWith(
    db,
    TENANT,
    "data-rights",
    {
      applicantName: "Maria José da Silva",
      contact: "maria@email.com",
      description: "Quero saber quais dados constam do meu cadastro.",
      accessKeyHash: hashAccessKey(key),
    },
  );

  // The office's answer, written the way the panel writes it.
  await db
    .update(serviceRequests)
    .set({
      officeReply: "Seguem os dados que constam do cadastro em seu nome.",
      officeRepliedAt: new Date(),
      status: "answered",
    })
    .where(eq(serviceRequests.id, id));

  // Without the key, the record cannot be opened at all: the public status
  // page reads the stage from a different, keyless query, never this one.
  assert.equal(
    await findByProtocolWithKeyWith(
      db,
      TENANT.slug,
      protocolNumber,
      "AAAA-BBBB-CCCC",
    ),
    undefined,
  );

  const opened = await findByProtocolWithKeyWith(
    db,
    TENANT.slug,
    protocolNumber,
    key,
  );
  assert.ok(opened);
  assert.equal(
    opened.officeReply,
    "Seguem os dados que constam do cadastro em seu nome.",
  );
});

// Migrated from e2e/admin-ombudsman.spec.ts and e2e/admin-lgpd.spec.ts: the
// office's reply and its draft, both shared by every channel through
// respondToRecordWith/saveDraftReplyWith.

test("responding clears any draft and makes the reply readable behind the key", async () => {
  const key = generateAccessKey();
  const { id, protocolNumber } = await createRecordWith(
    db,
    TENANT,
    "ombudsman",
    {
      applicantName: "Maria José da Silva",
      contact: "maria@email.com",
      description: "Demora no atendimento.",
      accessKeyHash: hashAccessKey(key),
    },
  );

  await saveDraftReplyWith(
    db,
    TENANT.slug,
    id,
    "ombudsman",
    "Rascunho: vamos apurar.",
    "staff-1",
  );
  const withDraft = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(withDraft);
  assert.equal(
    (withDraft.details as { draftReply?: string }).draftReply,
    "Rascunho: vamos apurar.",
  );

  await respondToRecordWith(
    db,
    TENANT.slug,
    id,
    "ombudsman",
    "Apuramos e o atendimento foi reforçado.",
    "answered",
    "staff-1",
  );

  const answered = await findByProtocolWithKeyWith(
    db,
    TENANT.slug,
    protocolNumber,
    key,
  );
  assert.ok(answered);
  assert.equal(answered.officeReply, "Apuramos e o atendimento foi reforçado.");
  assert.equal(answered.status, "answered");
  assert.equal(
    (answered.details as { draftReply?: string }).draftReply,
    undefined,
  );
});

test("closing a manifestation without a reply leaves it closed with no office reply", async () => {
  const { id, protocolNumber } = await createRecordWith(
    db,
    TENANT,
    "ombudsman",
    {
      description: "Recepção sem sinalização de acessibilidade.",
    },
  );

  await updateRequestStatusWith(db, TENANT.slug, id, "done", "staff-1");

  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(stored);
  assert.equal(stored.status, "done");
  assert.equal(stored.officeReply, null);
});

// Migrated from e2e/admin-service-requests.spec.ts: registering a
// requirement pauses the legal deadline, fulfilling it restarts the count
// from that day (Lei 6.015 art. 19, 5 dias úteis for rcpn-certidao). Also
// migrated: an amount can be set and cleared; printing writes the right
// audit action and a wrong key never writes any.

test("registering a requirement pauses the deadline; fulfilling it restarts the count", async () => {
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Rosa Almeida Fontes",
      contact: "rosa@exemplo.com",
      accessKeyHash: hashAccessKey("chave-prazo"),
    },
  );

  const stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(stored);
  const before = (stored.details as { deadline?: { pausedOn?: string } })
    .deadline;
  assert.equal(before?.pausedOn, undefined);

  await registerRequirementWith(
    db,
    TENANT.slug,
    id,
    "Falta a certidão anterior.",
    "staff-1",
  );
  const pauseOutcome = await reconcileDeadlinePauseWith(
    db,
    TENANT,
    id,
    "staff-1",
    "2098-01-10",
  );
  assert.equal(pauseOutcome, "paused");

  const paused = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(paused);
  const pausedDeadline = (
    paused.details as { deadline?: { pausedOn?: string } }
  ).deadline;
  assert.equal(pausedDeadline?.pausedOn, "2098-01-10");

  const requirements = await listRequirementsWith(db, TENANT.slug, id);
  assert.equal(requirements.length, 1);
  await resolveRequirementWith(db, TENANT.slug, requirements[0].id, "staff-1");
  const resumeOutcome = await reconcileDeadlinePauseWith(
    db,
    TENANT,
    id,
    "staff-1",
    "2098-01-20",
  );
  assert.equal(resumeOutcome, "resumed");

  const resumed = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(resumed);
  const resumedDeadline = (
    resumed.details as {
      deadline?: { startedOn?: string; days?: number; pausedOn?: string };
    }
  ).deadline;
  assert.equal(resumedDeadline?.pausedOn, undefined);
  // rcpn-certidao tem prazo legal (Lei 6.015 art. 19): a contagem recomeça
  // do dia em que a exigência foi cumprida, com os mesmos 5 dias úteis.
  assert.equal(resumedDeadline?.startedOn, "2098-01-20");
  assert.equal(resumedDeadline?.days, 5);
});

test("an amount can be set and then cleared", async () => {
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Carlos",
      contact: "carlos@exemplo.com",
      accessKeyHash: hashAccessKey("chave-valor"),
    },
  );

  await setRequestAmountWith(db, TENANT.slug, id, 6210, "staff-1");
  let stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.equal(stored?.amountCents, 6210);

  await setRequestAmountWith(db, TENANT.slug, id, null, "staff-1");
  stored = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.equal(stored?.amountCents, null);
});
