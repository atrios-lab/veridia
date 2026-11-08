import assert from "node:assert/strict";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, mock, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { getAct } from "@/core/acts/catalog.ts";
import {
  generateAccessKey,
  hashAccessKey,
  verifyAccessKey,
} from "@/core/request/access-key.ts";
import { buildRequesterQualification } from "@/core/request/form.ts";
import {
  readAlternateDocument,
  readRequesterQualification,
  readSearchAnswer,
  serviceRequestDetailsSchema,
} from "@/core/request/kinds.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  emailBounces,
  serviceRequestAttachments,
  serviceRequests,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  answerSearchWith,
  attachToRequestWith,
  createRecordWith,
  createServiceRequestWith,
  findByProtocolWith,
  findByProtocolWithKeyWith,
  findOpenServiceRequestDuplicateWith,
  getAttachmentWith,
  listRequirementsWith,
  purgeExpiredRequestFilesWith,
  reconcileDeadlinePauseWith,
  recoverAccessKeyWith,
  registerRequirementWith,
  resolveRequirementWith,
  respondToRecordWith,
  saveDraftReplyWith,
  setRequestAmountWith,
  updateRequestDataWith,
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

const fileCertificate = (contact: string, actVariant?: string) =>
  createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Lia",
    contact,
    accessKeyHash: hashAccessKey(`chave-${contact}`),
    details: actVariant ? { actVariant } : {},
  });

test("another kind of the same act is not a duplicate", async () => {
  const email = "tipos-diferentes@exemplo.com";
  await fileCertificate(email, "nascimento");

  const duplicate = await findOpenServiceRequestDuplicateWith(
    db,
    TENANT.slug,
    ACT.id,
    { email },
    "casamento",
  );
  assert.equal(duplicate, undefined);
});

test("the same kind of the same act is a duplicate, even behind a newer one", async () => {
  const email = "mesmo-tipo@exemplo.com";
  const first = await fileCertificate(email, "casamento");
  await fileCertificate(email, "nascimento");

  const duplicate = await findOpenServiceRequestDuplicateWith(
    db,
    TENANT.slug,
    ACT.id,
    { email },
    "casamento",
  );
  assert.equal(duplicate, first.protocolNumber);
});

test("an open request with no kind stored does not block one with a kind", async () => {
  const email = "sem-tipo@exemplo.com";
  await fileCertificate(email);

  const duplicate = await findOpenServiceRequestDuplicateWith(
    db,
    TENANT.slug,
    ACT.id,
    { email },
    "casamento",
  );
  assert.equal(duplicate, undefined);
});

const CORRECTION = {
  applicantName: "Lia Corrigida",
  contact: "correcao@exemplo.com",
  phone: "(84) 98888-0000",
  cpf: null,
  purpose: null,
  description: null,
  createdAt: new Date("2026-08-09T12:00:00Z"),
};

test("correcting the kind keeps the rest of details and enters the history", async () => {
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Lia",
      contact: "correcao@exemplo.com",
      accessKeyHash: hashAccessKey("chave-correcao"),
      details: {
        actVariant: "nascimento",
        consents: {
          lgpd: "2026-08-09T12:00:00.000Z",
          truth: "2026-08-09T12:00:00.000Z",
        },
      },
    },
  );

  await updateRequestDataWith(
    db,
    TENANT.slug,
    id,
    { ...CORRECTION, actVariant: "casamento" },
    "operador-1",
  );

  const found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(found);
  const details = found.details as Record<string, unknown>;
  assert.equal(details.actVariant, "casamento");
  assert.equal(details.phone, "(84) 98888-0000");
  assert.ok(details.consents, "os aceites gravados não podem se perder");

  const [entry] = await db
    .select({ actorId: auditLog.actorId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "service-request.edit"),
        eq(auditLog.targetId, id),
      ),
    );
  assert.equal(entry?.actorId, "operador-1");
});

test("a correction stores the other document, and takes it out again", async () => {
  const { id, protocolNumber } = await fileCertificate(
    "correcao-documento@exemplo.com",
    "obito",
  );

  await updateRequestDataWith(
    db,
    TENANT.slug,
    id,
    { ...CORRECTION, alternateDocument: { type: "rg", number: "123456" } },
    "operador-1",
  );
  let found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.deepEqual(readAlternateDocument(found?.details), {
    type: "rg",
    number: "123456",
  });
  assert.equal(found?.cpf, null);

  await updateRequestDataWith(
    db,
    TENANT.slug,
    id,
    { ...CORRECTION, cpf: "52998224725", alternateDocument: null },
    "operador-1",
  );
  found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.equal(found?.cpf, "52998224725");
  assert.equal(
    "alternateDocument" in (found?.details as Record<string, unknown>),
    false,
  );
  assert.equal(
    (found?.details as { actVariant?: string }).actVariant,
    "obito",
    "o resto de details não pode se perder",
  );
});

test("a correction with no document leaves the stored one alone", async () => {
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    ACT,
    {
      applicantName: "Sem CPF",
      contact: "(84) 99999-0000",
      accessKeyHash: hashAccessKey("chave-documento"),
      details: { alternateDocument: { type: "passport", number: "AB123456" } },
    },
  );

  await updateRequestDataWith(db, TENANT.slug, id, CORRECTION, "operador-1");

  const found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.deepEqual(readAlternateDocument(found?.details), {
    type: "passport",
    number: "AB123456",
  });
});

test("an old request with no CPF is still matched as a duplicate by e-mail", async () => {
  const email = "antigo-sem-cpf@exemplo.com";
  const { protocolNumber } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Pedido Antigo",
    contact: email,
    accessKeyHash: hashAccessKey("chave-antigo"),
  });

  assert.equal(
    await findOpenServiceRequestDuplicateWith(db, TENANT.slug, ACT.id, {
      cpf: "52998224725",
      email,
    }),
    protocolNumber,
  );
});

test("a correction with no kind leaves the stored one alone", async () => {
  const { id, protocolNumber } = await fileCertificate(
    "correcao-vazia@exemplo.com",
    "obito",
  );

  await updateRequestDataWith(db, TENANT.slug, id, CORRECTION, "operador-1");

  const found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.equal((found?.details as { actVariant?: string }).actVariant, "obito");
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

async function atInstant<T>(iso: string, run: () => Promise<T>): Promise<T> {
  const zone = process.env.TZ;
  process.env.TZ = "UTC";
  mock.timers.enable({ apis: ["Date"], now: new Date(iso) });
  try {
    return await run();
  } finally {
    mock.timers.reset();
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
}

test("a protocol carries the office's year, with the server in UTC", async () => {
  const file = () =>
    createRecordWith(db, TENANT, "ombudsman", {
      description: "Virada do ano.",
    });

  // 22:00 on 31 December at the office, already next year in UTC.
  const lastNight = await atInstant("2027-01-01T01:00:00Z", file);
  assert.match(lastNight.protocolNumber, /\.2026\./);

  // 00:10 on 1 January at the office.
  const firstMorning = await atInstant("2027-01-01T03:10:00Z", file);
  assert.match(firstMorning.protocolNumber, /\.2027\./);
});

test("a qualificação do inteiro teor é gravada em details e sobrevive à correção", async () => {
  const act = getAct("rcpn-certidao-inteiro-teor");
  assert.ok(act);
  const qualification = buildRequesterQualification({
    requesterRole: "attorney",
    representedName: "João da Silva",
    kinship: "Filho",
    registrantDeceased: "yes",
  });
  // Sem nenhum anexo: o mandato não trava o protocolo, a análise é da serventia.
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    act,
    {
      applicantName: "Dra. Lia",
      contact: "inteiro-teor@exemplo.com",
      purpose: "Aposentadoria rural",
      accessKeyHash: hashAccessKey("chave-inteiro-teor"),
      details: {
        actVariant: "nascimento",
        requesterQualification: qualification,
      },
    },
  );

  await updateRequestDataWith(
    db,
    TENANT.slug,
    id,
    { ...CORRECTION, purpose: "Pensão por morte" },
    "operador-1",
  );

  const found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(found);
  assert.equal(found.status, "new");
  assert.equal(found.purpose, "Pensão por morte");
  assert.deepEqual(readRequesterQualification(found.details), qualification);
  assert.ok(serviceRequestDetailsSchema.safeParse(found.details).success);
});

test("um pedido sem qualificação não inventa respostas", async () => {
  const { protocolNumber } = await fileCertificate(
    "sem-qualificacao@exemplo.com",
    "obito",
  );
  const found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.equal(readRequesterQualification(found?.details), undefined);
});

test("responder a busca conclui o pedido e guarda a resposta sem perder o resto", async () => {
  const busca = getAct("rcpn-busca");
  assert.ok(busca);
  const { id, protocolNumber } = await createServiceRequestWith(
    db,
    TENANT,
    busca,
    {
      applicantName: "Paulo",
      contact: "busca@exemplo.com",
      accessKeyHash: hashAccessKey("chave-busca"),
      description: "Paulo Neto, nascido em 1958. Consta agricultor?",
      purpose: "Aposentadoria rural",
      details: {
        actVariant: "nascimento",
        consents: {
          lgpd: "2026-11-07T12:00:00.000Z",
          truth: "2026-11-07T12:00:00.000Z",
        },
      },
    },
  );

  await answerSearchWith(
    db,
    TENANT.slug,
    id,
    { found: true, text: "Consta a profissão de agricultor." },
    "operador-1",
  );

  const found = await findByProtocolWith(db, TENANT.slug, protocolNumber);
  assert.ok(found);
  assert.equal(found.status, "done");
  assert.equal(found.amountCents, null, "a consulta não ganha valor");
  const answer = readSearchAnswer(found.details);
  assert.equal(answer?.found, true);
  assert.equal(answer?.text, "Consta a profissão de agricultor.");
  const details = found.details as Record<string, unknown>;
  assert.equal(details.actVariant, "nascimento");
  assert.ok(details.consents, "os aceites gravados não podem se perder");

  const [entry] = await db
    .select({ actorId: auditLog.actorId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "service-request.search-answer"),
        eq(auditLog.targetId, id),
      ),
    );
  assert.equal(entry?.actorId, "operador-1");
});

// The 30-day rule for a protocol's files (change
// `expurgar-arquivos-dos-pedidos`): `closed_at` follows every status write,
// and the purge deletes only what is past its 30 days after the closing.

test("closed_at is set on closing, kept between closed statuses, cleared on reopening", async () => {
  const { id } = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Clara",
    contact: "clara@exemplo.com",
    accessKeyHash: hashAccessKey("chave-encerramento"),
  });
  const closedAt = async () =>
    (
      await db
        .select({ closedAt: serviceRequests.closedAt })
        .from(serviceRequests)
        .where(eq(serviceRequests.id, id))
    )[0].closedAt;

  assert.equal(await closedAt(), null);
  await updateRequestStatusWith(db, TENANT.slug, id, "done", "staff-1");
  const first = await closedAt();
  assert.ok(first, "concluir grava o encerramento");

  await updateRequestStatusWith(db, TENANT.slug, id, "archived", "staff-1");
  assert.deepEqual(await closedAt(), first, "arquivar não reinicia os 30 dias");

  await updateRequestStatusWith(db, TENANT.slug, id, "processing", "staff-1");
  assert.equal(await closedAt(), null, "reabrir suspende a contagem");
});

test("answering a data-rights request closes it; a search answer closes a request", async () => {
  const sol = await createRecordWith(db, TENANT, "data-rights", {
    description: "Quero saber quais dados meus o cartório guarda.",
  });
  await respondToRecordWith(
    db,
    TENANT.slug,
    sol.id,
    "data-rights",
    "Segue o relatório.",
    "answered",
    "staff-1",
  );
  const [answered] = await db
    .select({ closedAt: serviceRequests.closedAt })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, sol.id));
  assert.ok(answered.closedAt);

  const req = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Davi",
    contact: "davi@exemplo.com",
    accessKeyHash: hashAccessKey("chave-busca"),
  });
  await answerSearchWith(
    db,
    TENANT.slug,
    req.id,
    { found: true, text: "Livro 3, folha 12." },
    "staff-1",
  );
  const [searched] = await db
    .select({ closedAt: serviceRequests.closedAt })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, req.id));
  assert.ok(searched.closedAt);
});

test("the purge deletes files 30 days after the closing, keeps the record and logs it with no actor", async () => {
  const dir = await mkdtemp(join(tmpdir(), "veridia-purge-"));
  const stored = async (name: string) => {
    const path = join(dir, name);
    await writeFile(path, "%PDF-1.4");
    return {
      storedName: name,
      displayName: name,
      path,
      mimeType: "application/pdf",
      sizeBytes: 8,
    };
  };

  // Closed 40 days before "today": its file goes.
  const old = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Edite",
    contact: "edite@exemplo.com",
    accessKeyHash: hashAccessKey("chave-velha"),
  });
  const [oldFile] = await attachToRequestWith(
    db,
    TENANT.slug,
    old.id,
    [await stored("velho.pdf")],
    "office",
  );
  await updateRequestStatusWith(db, TENANT.slug, old.id, "done", "staff-1");
  await db
    .update(serviceRequests)
    .set({ closedAt: new Date("2026-09-29T15:00:00Z") })
    .where(eq(serviceRequests.id, old.id));
  await db
    .update(serviceRequestAttachments)
    .set({ createdAt: new Date("2026-09-20T15:00:00Z") })
    .where(eq(serviceRequestAttachments.id, oldFile.id));

  // Closed 10 days before: kept. Open for months: kept.
  const recent = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Fábio",
    contact: "fabio@exemplo.com",
    accessKeyHash: hashAccessKey("chave-recente"),
  });
  const [recentFile] = await attachToRequestWith(
    db,
    TENANT.slug,
    recent.id,
    [await stored("recente.pdf")],
    "office",
  );
  await db
    .update(serviceRequests)
    .set({ status: "done", closedAt: new Date("2026-10-29T15:00:00Z") })
    .where(eq(serviceRequests.id, recent.id));

  const open = await createServiceRequestWith(db, TENANT, ACT, {
    applicantName: "Gilda",
    contact: "gilda@exemplo.com",
    accessKeyHash: hashAccessKey("chave-aberta"),
  });
  const [openFile] = await attachToRequestWith(
    db,
    TENANT.slug,
    open.id,
    [await stored("aberto.pdf")],
    "citizen",
  );
  await db
    .update(serviceRequestAttachments)
    .set({ createdAt: new Date("2026-05-01T15:00:00Z") })
    .where(eq(serviceRequestAttachments.id, openFile.id));

  const purged = await purgeExpiredRequestFilesWith(
    db,
    TENANT.slug,
    "2026-11-08",
  );
  assert.equal(purged, 1);

  const gone = await getAttachmentWith(db, TENANT.slug, old.id, oldFile.id);
  assert.ok(gone, "o registro do anexo continua");
  assert.equal(gone.path, null);
  assert.ok(gone.purgedAt);
  assert.equal(gone.displayName, "velho.pdf");
  await assert.rejects(access(oldFile.path ?? ""), "o arquivo saiu do disco");

  const kept = await getAttachmentWith(
    db,
    TENANT.slug,
    recent.id,
    recentFile.id,
  );
  assert.equal(kept?.path, recentFile.path);
  await access(recentFile.path ?? "");
  const held = await getAttachmentWith(db, TENANT.slug, open.id, openFile.id);
  assert.equal(held?.path, openFile.path);

  const trail = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "service-request.attachment-purge"),
        eq(auditLog.targetId, old.id),
      ),
    );
  assert.equal(trail.length, 1);
  assert.equal(trail[0].actorId, null);
  assert.equal(trail[0].targetType, "service-request");

  // A second pass finds nothing left to delete, and logs nothing more.
  assert.equal(
    await purgeExpiredRequestFilesWith(db, TENANT.slug, "2026-11-08"),
    0,
  );
});
