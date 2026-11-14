import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { RandomInt } from "@/core/courses/quiz.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  auditLog,
  courseQuestions,
  courses,
  quizAttempts,
} from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  certificateByCodeWith,
  certificateForUserWith,
  issueCertificateWith,
} from "@/lib/certificates.ts";
import { createCourseWith, setCoursePublishedWith } from "@/lib/courses.ts";
import {
  assessmentStateWith,
  createQuestionWith,
  deleteQuestionWith,
  startAttemptWith,
  submitAttemptWith,
  updateAssessmentSettingsWith,
} from "@/lib/quiz.ts";
import {
  createTutorialWith,
  markWatchedWith,
  setTutorialPublishedWith,
} from "@/lib/tutorials.ts";

// The assessment end to end against Postgres in process: closed until every
// video is watched, a fail and the five-hour wait, a pass, the certificate
// and what stays protected (the right answer, a second submission, a second
// certificate, a question already shown).

let db: Database;
let close: () => Promise<void>;
let courseId: string;
const videoIds: string[] = [];

const ATRIOS = "user-atrios";
const ANA = "user-ana";
const CPF = "52998224725";
const T0 = new Date("2026-11-07T10:00:00Z");
const HOUR = 3_600_000;

/** Math.random would do; a fixed source keeps failures reproducible. */
function seeded(seed: number): RandomInt {
  let x = seed;
  return (max) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x % max;
  };
}

before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values([
    {
      id: ATRIOS,
      name: "Átrios",
      email: "p@atrios.test",
      tenantSlug: "atrios",
    },
    {
      id: ANA,
      name: "Ana Souza",
      email: "ana@exemplo.com",
      tenantSlug: "marinho",
    },
  ]);
  const course = await createCourseWith(
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
  courseId = course.id;
  await setCoursePublishedWith(db, courseId, true, ATRIOS);
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
        courseId,
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
  for (let i = 0; i < 10; i++) {
    await createQuestionWith(
      db,
      courseId,
      {
        prompt: `Pergunta ${i + 1}?`,
        options: ["A", "B", "C", "D"],
        correctIndex: i % 4,
      },
      ATRIOS,
    );
  }
});

after(async () => {
  await close();
});

test("a course without hours has no assessment", async () => {
  assert.deepEqual(await assessmentStateWith(db, ANA, courseId, T0), {
    kind: "none",
  });
  await updateAssessmentSettingsWith(
    db,
    courseId,
    {
      passingScore: 70,
      workloadHours: 2,
      retryHours: 5,
      certificateKind: "completion",
    },
    ATRIOS,
  );
});

test("closed until every video is watched, Encerramento included", async () => {
  await markWatchedWith(db, ANA, videoIds[0]);
  await markWatchedWith(db, ANA, videoIds[1]);
  assert.deepEqual(await assessmentStateWith(db, ANA, courseId, T0), {
    kind: "locked",
    videosLeft: 1,
  });
  assert.deepEqual(await startAttemptWith(db, ANA, courseId, seeded(1), T0), {
    status: "refused",
    reason: "videos-left",
  });
  await markWatchedWith(db, ANA, videoIds[2]);
  const state = await assessmentStateWith(db, ANA, courseId, T0);
  assert.equal(state.kind, "available");
});

/** The picks (positions on screen) that answer every question right, or
 * every one wrong, read from the stored draw and answer key. */
async function picksFor(attemptId: string, right: number) {
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.id, attemptId));
  const questions = await db.select().from(courseQuestions);
  const key = new Map(questions.map((q) => [q.id, q.correctIndex]));
  return attempt.questionIds.map((id, q) => {
    const correctShown = attempt.optionOrders[q].indexOf(key.get(id) ?? 0);
    return q < right ? correctShown : (correctShown + 1) % 4;
  });
}

let firstAttempt: string;

test("an attempt shows the questions without the right answer, and keeps its order", async () => {
  const started = await startAttemptWith(db, ANA, courseId, seeded(7), T0);
  assert.equal(started.status, "started");
  firstAttempt = started.status === "started" ? started.attemptId : "";
  const state = await assessmentStateWith(db, ANA, courseId, T0);
  assert.equal(state.kind, "open");
  if (state.kind !== "open") return;
  assert.equal(state.questions.length, 10);
  assert.ok(
    !JSON.stringify(state.questions).includes("correct"),
    "nothing about the right answer",
  );
  // Starting again (a reload) hands back the same attempt and order.
  const again = await startAttemptWith(db, ANA, courseId, seeded(99), T0);
  assert.deepEqual(again, { status: "started", attemptId: firstAttempt });
  const reloaded = await assessmentStateWith(db, ANA, courseId, T0);
  assert.deepEqual(reloaded, state);
});

test("a blank answer refuses the whole attempt", async () => {
  const picks = await picksFor(firstAttempt, 10);
  picks[3] = null as unknown as number;
  assert.deepEqual(await submitAttemptWith(db, ANA, firstAttempt, picks, T0), {
    status: "refused",
    reason: "incomplete",
  });
});

test("6 of 10 fails, and the next attempt waits five hours", async () => {
  const result = await submitAttemptWith(
    db,
    ANA,
    firstAttempt,
    await picksFor(firstAttempt, 6),
    T0,
  );
  assert.deepEqual(result, {
    status: "graded",
    grade: { correct: 6, total: 10, percent: 60, passed: false },
  });
  assert.deepEqual(
    await submitAttemptWith(
      db,
      ANA,
      firstAttempt,
      await picksFor(firstAttempt, 10),
      T0,
    ),
    { status: "refused", reason: "submitted" },
  );
  const at14 = await assessmentStateWith(
    db,
    ANA,
    courseId,
    new Date(T0.getTime() + 4 * HOUR),
  );
  assert.deepEqual(at14, {
    kind: "wait",
    remainingMs: HOUR,
    last: { correct: 6, total: 10 },
  });
  assert.deepEqual(
    await startAttemptWith(
      db,
      ANA,
      courseId,
      seeded(3),
      new Date(T0.getTime() + 4 * HOUR),
    ),
    { status: "refused", reason: "wait" },
  );
  // Nothing issued from a fail.
  assert.deepEqual(
    await issueCertificateWith(
      db,
      {
        userId: ANA,
        courseId,
        tenantSlug: "marinho",
        tenantName: "Cartório X",
        host: "x",
      },
      { fullName: "Ana Souza", cpf: CPF, roleTitle: "Escrevente" },
      randomBytes,
      T0,
    ),
    { status: "refused", reason: "not-passed" },
  );
});

test("7 of 10 passes; no attempt after a pass", async () => {
  const at15 = new Date(T0.getTime() + 5 * HOUR);
  const started = await startAttemptWith(db, ANA, courseId, seeded(11), at15);
  assert.equal(started.status, "started");
  if (started.status !== "started") return;
  assert.notEqual(started.attemptId, firstAttempt);
  const result = await submitAttemptWith(
    db,
    ANA,
    started.attemptId,
    await picksFor(started.attemptId, 7),
    at15,
  );
  assert.equal(result.status === "graded" && result.grade.passed, true);
  assert.deepEqual(await assessmentStateWith(db, ANA, courseId, at15), {
    kind: "passed",
    score: 70,
  });
  assert.deepEqual(await startAttemptWith(db, ANA, courseId, seeded(5), at15), {
    status: "refused",
    reason: "passed",
  });
});

test("the certificate is issued once, with a snapshot and a code", async () => {
  const context = {
    userId: ANA,
    courseId,
    tenantSlug: "marinho",
    tenantName: "Cartório Ielmo Marinho/RN",
    host: "marinho.atrioss.com",
  };
  const issued = await issueCertificateWith(
    db,
    context,
    { fullName: "Ana Souza", cpf: CPF, roleTitle: "Escrevente" },
    randomBytes,
    T0,
  );
  assert.equal(issued.status, "issued");
  if (issued.status !== "issued") return;
  const cert = issued.certificate;
  assert.match(cert.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.equal(cert.score, 70);
  assert.equal(cert.workloadHours, 2);
  assert.equal(cert.courseTitle, "LGPD no cartório");
  assert.equal(cert.cpf, CPF);

  // Renaming the course later does not touch it.
  await db
    .update(courses)
    .set({ title: "Outro nome" })
    .where(eq(courses.id, courseId));
  assert.equal(
    (await certificateByCodeWith(db, cert.code))?.courseTitle,
    "LGPD no cartório",
  );
  assert.equal((await certificateForUserWith(db, ANA, courseId))?.id, cert.id);
  assert.deepEqual(
    await issueCertificateWith(
      db,
      context,
      { fullName: "Ana Souza", cpf: CPF, roleTitle: "Escrevente" },
      randomBytes,
      T0,
    ),
    { status: "refused", reason: "already-issued" },
  );
  const [audit] = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, cert.id));
  assert.equal(audit.tenantSlug, "marinho");
  assert.equal(audit.action, "course.certificate.issue");
  assert.deepEqual(await assessmentStateWith(db, ANA, courseId, T0), {
    kind: "certified",
    code: cert.code,
    issuedAt: cert.issuedAt,
  });
});

test("a question already shown is never deleted; a fresh one is", async () => {
  const [shown] = await db.select().from(courseQuestions).limit(1);
  assert.equal(await deleteQuestionWith(db, shown.id, ATRIOS), "used");
  const fresh = await createQuestionWith(
    db,
    courseId,
    {
      prompt: "Nova pergunta?",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
    },
    ATRIOS,
  );
  assert.equal(await deleteQuestionWith(db, fresh.id, ATRIOS), "deleted");
  assert.equal(await deleteQuestionWith(db, fresh.id, ATRIOS), "not-found");
});

test("a participation course: no assessment, the certificate after every video", async () => {
  const course = await createCourseWith(
    db,
    {
      title: "Segurança da informação",
      slug: "provimento-213",
      description: "",
      sequential: true,
    },
    { posterUrl: null, materialUrl: null },
    ATRIOS,
  );
  await setCoursePublishedWith(db, course.id, true, ATRIOS);
  await updateAssessmentSettingsWith(
    db,
    course.id,
    {
      passingScore: 70,
      workloadHours: 1,
      retryHours: 5,
      certificateKind: "participation",
    },
    ATRIOS,
  );
  // A question left over does not bring an assessment back.
  await createQuestionWith(
    db,
    course.id,
    { prompt: "Sobrou?", options: ["A", "B", "C", "D"], correctIndex: 0 },
    ATRIOS,
  );
  const ids: string[] = [];
  for (const kind of ["intro", "lesson"] as const) {
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
        courseId: course.id,
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
    ids.push(id);
  }
  const context = {
    userId: ANA,
    courseId: course.id,
    tenantSlug: "marinho",
    tenantName: "Ofício Único de Ielmo Marinho / RN",
    host: "marinho.atrioss.com",
  };
  const request = { fullName: "Ana Souza", cpf: CPF, roleTitle: "Escrevente" };

  await markWatchedWith(db, ANA, ids[0]);
  assert.deepEqual(await assessmentStateWith(db, ANA, course.id, T0), {
    kind: "locked",
    videosLeft: 1,
  });
  assert.deepEqual(
    await issueCertificateWith(db, context, request, randomBytes, T0),
    { status: "refused", reason: "videos-left" },
  );

  await markWatchedWith(db, ANA, ids[1]);
  assert.deepEqual(await assessmentStateWith(db, ANA, course.id, T0), {
    kind: "ready",
  });
  assert.deepEqual(await startAttemptWith(db, ANA, course.id, seeded(3), T0), {
    status: "refused",
    reason: "no-assessment",
  });

  const issued = await issueCertificateWith(
    db,
    context,
    request,
    randomBytes,
    T0,
  );
  assert.equal(issued.status, "issued");
  if (issued.status !== "issued") return;
  assert.equal(issued.certificate.score, null);
  assert.equal(issued.certificate.attemptId, null);
  assert.equal(issued.certificate.workloadHours, 1);
  assert.deepEqual(await assessmentStateWith(db, ANA, course.id, T0), {
    kind: "certified",
    code: issued.certificate.code,
    issuedAt: issued.certificate.issuedAt,
  });
});
