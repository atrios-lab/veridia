import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import type { CohortJoinInput } from "@/core/cohorts/cohort.ts";
import { COURSES_TENANT_SLUG } from "@/core/tenant/courses-tenant.ts";
import { account, user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  cohortMembers,
  courseCohorts,
  quizAttempts,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { issueCertificateWith } from "@/lib/certificates.ts";
import {
  CohortCourseError,
  certificateCoursesWith,
  cohortByCodeWith,
  cohortDetailWith,
  createCohortWith,
  joinCohortWith,
  listCohortsWith,
  setCohortClosedWith,
  updateCohortWith,
} from "@/lib/cohorts.ts";
import { createCourseWith, setCoursePublishedWith } from "@/lib/courses.ts";
import { updateAssessmentSettingsWith } from "@/lib/quiz.ts";
import {
  createTutorialWith,
  markWatchedWith,
  setTutorialPublishedWith,
} from "@/lib/tutorials.ts";

// Course cohorts against Postgres in process: the platform account creates
// a link, learners join through it (and are refused when it is closed,
// expired, full or their e-mail is taken), the last seat goes to one person
// only, the cohort screen reads each learner's progress and the
// certificate names the cohort's office.

let db: Database;
let close: () => Promise<void>;
let lgpdId: string;
let panelId: string;
const videoIds: string[] = [];

const ATRIOS = "user-atrios";
const TODAY = "2026-11-09";
const NOW = new Date("2026-11-09T15:00:00Z");
const HOUR = 3_600_000;

// A stand-in hash: fast, and enough where the password is not what is
// tested. The test that checks the login reads it uses the real one.
const deps = { hashPassword: async (p: string) => `hash:${p}` };

const COHORT = {
  officeName: "2º Ofício de Xique-Xique/RN",
  officeCity: "Xique-Xique/RN",
  contactName: "Fulano de Tal",
  contactPhone: "(84) 99999-0000",
  seats: 3,
  validDays: 30,
};

function learner(n: number, patch: Partial<CohortJoinInput> = {}) {
  return {
    fullName: `Aluno Número ${n}`,
    email: `aluno${n}@exemplo.com`,
    password: "segredo123",
    contactConsent: false,
    ...patch,
  };
}

async function newCohort(patch: Partial<typeof COHORT> = {}) {
  return createCohortWith(
    db,
    { courseId: lgpdId, ...COHORT, ...patch },
    ATRIOS,
    randomBytes,
    TODAY,
  );
}

before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values({
    id: ATRIOS,
    name: "Átrios",
    email: "p@atrios.test",
    role: "superadmin",
    tenantSlug: "atrios",
  });
  const lgpd = await createCourseWith(
    db,
    {
      title: "LGPD no cartório",
      slug: "lgpd",
      description: "",
      sequential: true,
    },
    { posterUrl: null, materialUrl: null },
    ATRIOS,
  );
  lgpdId = lgpd.id;
  await setCoursePublishedWith(db, lgpdId, true, ATRIOS);
  await updateAssessmentSettingsWith(
    db,
    lgpdId,
    {
      passingScore: 70,
      workloadHours: 2,
      retryHours: 5,
      certificateKind: "completion",
    },
    ATRIOS,
  );
  for (const kind of ["intro", "lesson", "outro"] as const) {
    const id = randomUUID();
    await createTutorialWith(
      db,
      id,
      {
        title: kind,
        description: "",
        durationSeconds: 60,
        route: null,
        trail: false,
        courseId: lgpdId,
        kind,
      },
      {
        videoUrl: `https://store.example.test/treinamento/${id}.mp4`,
        captionsUrl: null,
        posterUrl: null,
      },
      ATRIOS,
    );
    await setTutorialPublishedWith(db, id, true, ATRIOS);
    videoIds.push(id);
  }
  const panel = await createCourseWith(
    db,
    {
      title: "Uso do painel 2",
      slug: "painel-2",
      description: "",
      sequential: false,
    },
    { posterUrl: null, materialUrl: null },
    ATRIOS,
  );
  panelId = panel.id;
});

after(async () => {
  await close();
});

test("a cohort gets a code, a link valid through 30 days and an audit row", async () => {
  const cohort = await newCohort();
  assert.match(cohort.code, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  // Valid through 09/12 in Natal: it stops at 03:00 UTC on the 10th.
  assert.equal(cohort.expiresAt.toISOString(), "2026-12-10T03:00:00.000Z");
  const [row] = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "cohort.create"),
        eq(auditLog.targetId, cohort.id),
      ),
    );
  assert.equal(row?.tenantSlug, "atrios");
});

test("a cohort is only for a course that gives a certificate", async () => {
  await assert.rejects(
    createCohortWith(
      db,
      { courseId: panelId, ...COHORT },
      ATRIOS,
      randomBytes,
      TODAY,
    ),
    CohortCourseError,
  );
  const offered = await certificateCoursesWith(db);
  assert.deepEqual(
    offered.map((c) => c.id),
    [lgpdId],
  );
});

test("a learner joins: an account in the courses office, a password the login reads", async () => {
  const cohort = await newCohort();
  const result = await joinCohortWith(
    db,
    cohort.code,
    learner(1, { contactConsent: true }),
    { hashPassword: (await import("better-auth/crypto")).hashPassword },
    NOW,
  );
  assert.equal(result.status, "joined");
  if (result.status !== "joined") return;
  assert.equal(result.courseSlug, "lgpd");

  const [person] = await db
    .select()
    .from(user)
    .where(eq(user.id, result.userId));
  assert.equal(person.role, "learner");
  assert.equal(person.tenantSlug, COURSES_TENANT_SLUG);
  assert.equal(person.email, "aluno1@exemplo.com");
  assert.equal(person.emailVerified, true);

  // The row the auth library reads at sign-in: a credential account whose
  // hash checks against the password typed.
  const [credential] = await db
    .select()
    .from(account)
    .where(eq(account.userId, result.userId));
  assert.equal(credential.providerId, "credential");
  assert.equal(credential.accountId, result.userId);
  assert.ok(
    await verifyPassword({
      hash: credential.password ?? "",
      password: "segredo123",
    }),
  );

  const [member] = await db
    .select()
    .from(cohortMembers)
    .where(eq(cohortMembers.userId, result.userId));
  assert.equal(member.cohortId, cohort.id);
  assert.ok(member.contactConsentAt);
});

test("not ticking the box leaves the consent empty", async () => {
  const cohort = await newCohort();
  const result = await joinCohortWith(db, cohort.code, learner(2), deps, NOW);
  assert.equal(result.status, "joined");
  if (result.status !== "joined") return;
  const [member] = await db
    .select()
    .from(cohortMembers)
    .where(eq(cohortMembers.userId, result.userId));
  assert.equal(member.contactConsentAt, null);
});

test("an e-mail already in use is refused, and nothing is written", async () => {
  const cohort = await newCohort();
  const result = await joinCohortWith(
    db,
    cohort.code,
    learner(9, { email: "p@atrios.test" }),
    deps,
    NOW,
  );
  assert.deepEqual(result, { status: "refused", reason: "email-taken" });
  const members = await db
    .select()
    .from(cohortMembers)
    .where(eq(cohortMembers.cohortId, cohort.id));
  assert.equal(members.length, 0);
});

test("an unknown, closed or expired link takes nobody", async () => {
  assert.deepEqual(
    await joinCohortWith(db, "ZZZZ-ZZZZ", learner(10), deps, NOW),
    { status: "refused", reason: "not-found" },
  );

  const closed = await newCohort();
  await setCohortClosedWith(db, closed.id, true, ATRIOS, NOW);
  assert.deepEqual(
    await joinCohortWith(db, closed.code, learner(11), deps, NOW),
    { status: "refused", reason: "closed" },
  );
  // Reopened, it takes sign-ups again.
  await setCohortClosedWith(db, closed.id, false, ATRIOS, NOW);
  assert.equal(
    (await joinCohortWith(db, closed.code, learner(11), deps, NOW)).status,
    "joined",
  );

  const expiring = await newCohort({ validDays: 1 });
  const dayAfter = new Date(expiring.expiresAt.getTime() + HOUR);
  assert.deepEqual(
    await joinCohortWith(db, expiring.code, learner(12), deps, dayAfter),
    { status: "refused", reason: "expired" },
  );
});

test("the last seat goes to one person only", async () => {
  const cohort = await newCohort({ seats: 1 });
  const results = await Promise.all([
    joinCohortWith(db, cohort.code, learner(20), deps, NOW),
    joinCohortWith(db, cohort.code, learner(21), deps, NOW),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ["joined", "refused"]);
  const refused = results.find((r) => r.status === "refused");
  assert.deepEqual(refused, { status: "refused", reason: "full" });
  const members = await db
    .select()
    .from(cohortMembers)
    .where(eq(cohortMembers.cohortId, cohort.id));
  assert.equal(members.length, 1);
  const link = await cohortByCodeWith(db, cohort.code, NOW);
  assert.equal(link?.state, "full");
});

test("seats never go below the learners in; an edit moves the last day", async () => {
  const cohort = await newCohort({ seats: 5 });
  await joinCohortWith(db, cohort.code, learner(30), deps, NOW);
  await joinCohortWith(db, cohort.code, learner(31), deps, NOW);
  const edit = {
    officeName: "2º Ofício de Xique-Xique/RN",
    officeCity: "Xique-Xique/RN",
    contactName: "Fulano de Tal",
    contactPhone: "(84) 99999-0000",
    lastDay: "2027-01-31",
  };
  assert.deepEqual(
    await updateCohortWith(db, cohort.id, { ...edit, seats: 1 }, ATRIOS),
    { status: "seats-below-members", members: 2 },
  );
  assert.deepEqual(
    await updateCohortWith(db, cohort.id, { ...edit, seats: 2 }, ATRIOS),
    { status: "updated" },
  );
  const [row] = await db
    .select()
    .from(courseCohorts)
    .where(eq(courseCohorts.id, cohort.id));
  assert.equal(row.seats, 2);
  assert.equal(row.expiresAt.toISOString(), "2027-02-01T03:00:00.000Z");
});

test("the cohort screen reads progress, attempts and certificates", async () => {
  const cohort = await newCohort({
    seats: 4,
    officeName: "Cartório de Pau dos Ferros Teste",
  });
  const joined = [];
  for (const n of [40, 41, 42, 43]) {
    const r = await joinCohortWith(db, cohort.code, learner(n), deps, NOW);
    assert.equal(r.status, "joined");
    if (r.status === "joined") joined.push(r.userId);
  }
  const [watcher, failer, passer, opener] = joined;
  for (const id of videoIds) await markWatchedWith(db, passer, id);
  await markWatchedWith(db, watcher, videoIds[0]);
  await db.insert(quizAttempts).values([
    {
      userId: failer,
      courseId: lgpdId,
      questionIds: [],
      optionOrders: [],
      submittedAt: NOW,
      answers: [],
      correct: 3,
      total: 10,
      passed: false,
    },
    {
      userId: passer,
      courseId: lgpdId,
      questionIds: [],
      optionOrders: [],
      submittedAt: NOW,
      answers: [],
      correct: 9,
      total: 10,
      passed: true,
    },
    {
      userId: opener,
      courseId: lgpdId,
      questionIds: [],
      optionOrders: [],
    },
  ]);
  const issued = await issueCertificateWith(
    db,
    {
      userId: passer,
      courseId: lgpdId,
      tenantSlug: COURSES_TENANT_SLUG,
      tenantName: "Cartório Vale do Silício",
      host: "curso.atrioss.com",
    },
    {
      fullName: "Aluno Número 42",
      cpf: "52998224725",
      roleTitle: "Escrevente",
    },
    randomBytes,
    NOW,
  );
  assert.equal(issued.status, "issued");
  // The certificate names the cohort's office, not the courses office.
  if (issued.status === "issued") {
    assert.equal(
      issued.certificate.tenantName,
      "Cartório de Pau dos Ferros Teste",
    );
    assert.equal(issued.certificate.tenantSlug, COURSES_TENANT_SLUG);
  }

  const detail = await cohortDetailWith(db, cohort.id, NOW);
  assert.ok(detail);
  assert.equal(detail.videoCount, 3);
  assert.equal(detail.members, 4);
  assert.equal(detail.certified, 1);
  const byId = new Map(detail.learners.map((l) => [l.userId, l]));
  assert.equal(byId.get(watcher)?.watched, 1);
  assert.equal(byId.get(watcher)?.status, "not-taken");
  assert.equal(byId.get(failer)?.status, "failed");
  assert.equal(byId.get(opener)?.status, "in-attempt");
  assert.equal(byId.get(passer)?.watched, 3);
  assert.equal(byId.get(passer)?.status, "certified");

  const summary = (await listCohortsWith(db, NOW)).find(
    (s) => s.cohort.id === cohort.id,
  );
  assert.equal(summary?.members, 4);
  assert.equal(summary?.certified, 1);
  assert.equal(summary?.state, "full");

  // Renaming the office afterwards leaves the issued certificate alone.
  await updateCohortWith(
    db,
    cohort.id,
    {
      officeName: "Outro nome",
      officeCity: "X/RN",
      contactName: "Fulano",
      contactPhone: "(84) 99999-0000",
      seats: 4,
      lastDay: "2026-12-31",
    },
    ATRIOS,
  );
  const again = await issueCertificateWith(
    db,
    {
      userId: passer,
      courseId: lgpdId,
      tenantSlug: COURSES_TENANT_SLUG,
      tenantName: "Cartório Vale do Silício",
      host: "curso.atrioss.com",
    },
    {
      fullName: "Aluno Número 42",
      cpf: "52998224725",
      roleTitle: "Escrevente",
    },
    randomBytes,
    NOW,
  );
  assert.deepEqual(again, { status: "refused", reason: "already-issued" });
});

test("someone outside any cohort keeps their own office on the certificate", async () => {
  await db.insert(user).values({
    id: "user-ana",
    name: "Ana Souza",
    email: "ana@exemplo.com",
    tenantSlug: "cartorio-marinho",
  });
  await db.insert(quizAttempts).values({
    userId: "user-ana",
    courseId: lgpdId,
    questionIds: [],
    optionOrders: [],
    submittedAt: NOW,
    answers: [],
    correct: 8,
    total: 10,
    passed: true,
  });
  const issued = await issueCertificateWith(
    db,
    {
      userId: "user-ana",
      courseId: lgpdId,
      tenantSlug: "cartorio-marinho",
      tenantName: "Cartório Ielmo Marinho",
      host: "cartorioielmomarinhorn.com",
    },
    { fullName: "Ana Souza", cpf: "52998224725", roleTitle: "Escrevente" },
    randomBytes,
    NOW,
  );
  assert.equal(issued.status, "issued");
  if (issued.status === "issued") {
    assert.equal(issued.certificate.tenantName, "Cartório Ielmo Marinho");
  }
});
