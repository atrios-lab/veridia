import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { SUPERADMIN_TENANT_SLUG } from "@/core/auth/roles.ts";
import type {
  AssessmentSettings,
  QuestionFormInput,
} from "@/core/courses/questions.ts";
import {
  canStart,
  drawAttempt,
  type Grade,
  grade,
  originalAnswers,
  type Question,
  type RandomInt,
  type ShownQuestion,
  shownQuestions,
} from "@/core/courses/quiz.ts";
import { type Database, db } from "@/db/index.ts";
import {
  certificates,
  courseQuestions,
  courses,
  quizAttempts,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { listPublishedTutorialsWith, listWatchedIdsWith } from "./tutorials.ts";

// A course's assessment: the questions, each person's attempts and what the
// course page shows about them. Only this module reads `correct_index`, and
// nothing it returns to a page carries it.

type QuestionRow = typeof courseQuestions.$inferSelect;
type CourseRow = typeof courses.$inferSelect;

function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    prompt: row.prompt,
    options: row.options,
    correctIndex: row.correctIndex,
  };
}

async function courseRow(
  database: Database,
  courseId: string,
): Promise<CourseRow | undefined> {
  const [row] = await database
    .select()
    .from(courses)
    .where(eq(courses.id, courseId));
  return row;
}

async function activeQuestions(
  database: Database,
  courseId: string,
): Promise<Question[]> {
  const rows = await database
    .select()
    .from(courseQuestions)
    .where(
      and(
        eq(courseQuestions.courseId, courseId),
        eq(courseQuestions.active, true),
      ),
    )
    .orderBy(asc(courseQuestions.position));
  return rows.map(toQuestion);
}

/** Whether the course gives a certificate and has something to ask. */
function hasAssessment(course: CourseRow, questions: readonly Question[]) {
  return course.workloadHours !== null && questions.length > 0;
}

/** How many of the course's published videos this person has not watched.
 * The assessment opens at zero. */
export async function videosLeftWith(
  database: Database,
  userId: string,
  courseId: string,
): Promise<number> {
  const [all, watched] = await Promise.all([
    listPublishedTutorialsWith(database),
    listWatchedIdsWith(database, userId),
  ]);
  return all.filter((t) => t.courseId === courseId && !watched.has(t.id))
    .length;
}

async function lastSubmitted(
  database: Database,
  userId: string,
  courseId: string,
) {
  const [row] = await database
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.courseId, courseId),
        isNotNull(quizAttempts.submittedAt),
      ),
    )
    .orderBy(desc(quizAttempts.submittedAt))
    .limit(1);
  return row;
}

async function openAttempt(
  database: Database,
  userId: string,
  courseId: string,
) {
  const [row] = await database
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.courseId, courseId),
        isNull(quizAttempts.submittedAt),
      ),
    );
  return row;
}

async function questionsById(
  database: Database,
  ids: readonly string[],
): Promise<Map<string, Question>> {
  if (ids.length === 0) return new Map();
  const rows = await database
    .select()
    .from(courseQuestions)
    .where(sql`${courseQuestions.id} in ${ids}`);
  return new Map(rows.map((r) => [r.id, toQuestion(r)]));
}

export interface LastResult {
  correct: number;
  total: number;
}

/** What the course page shows in its "Avaliação" block. */
export type AssessmentState =
  | { kind: "none" }
  | { kind: "locked"; videosLeft: number }
  | { kind: "available"; last: LastResult | null; questionCount: number }
  | { kind: "open"; attemptId: string; questions: ShownQuestion[] }
  | { kind: "wait"; remainingMs: number; last: LastResult }
  | { kind: "passed"; score: number }
  | { kind: "certified"; code: string; issuedAt: Date };

export async function assessmentStateWith(
  database: Database,
  userId: string,
  courseId: string,
  now: Date,
): Promise<AssessmentState> {
  const course = await courseRow(database, courseId);
  if (!course) return { kind: "none" };
  const questions = await activeQuestions(database, courseId);
  if (!hasAssessment(course, questions)) return { kind: "none" };

  const [certificate] = await database
    .select({ code: certificates.code, issuedAt: certificates.issuedAt })
    .from(certificates)
    .where(
      and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)),
    );
  if (certificate) return { kind: "certified", ...certificate };

  const videosLeft = await videosLeftWith(database, userId, courseId);
  if (videosLeft > 0) return { kind: "locked", videosLeft };

  const open = await openAttempt(database, userId, courseId);
  if (open) {
    const byId = await questionsById(database, open.questionIds);
    return {
      kind: "open",
      attemptId: open.id,
      questions: shownQuestions(
        { questionIds: open.questionIds, optionOrders: open.optionOrders },
        byId,
      ),
    };
  }

  const last = await lastSubmitted(database, userId, courseId);
  const lastResult = last
    ? { correct: last.correct ?? 0, total: last.total ?? 0 }
    : null;
  const check = canStart(
    last?.submittedAt
      ? { submittedAt: last.submittedAt, passed: last.passed === true }
      : undefined,
    now,
    course.retryHours,
  );
  if (check.kind === "passed") {
    return { kind: "passed", score: scoreOf(last) };
  }
  if (check.kind === "wait" && lastResult) {
    return { kind: "wait", remainingMs: check.remainingMs, last: lastResult };
  }
  return {
    kind: "available",
    last: lastResult,
    questionCount: questions.length,
  };
}

export async function assessmentState(
  userId: string,
  courseId: string,
): Promise<AssessmentState> {
  return assessmentStateWith(db, userId, courseId, new Date());
}

function scoreOf(
  attempt: { correct: number | null; total: number | null } | undefined,
): number {
  if (!attempt?.total) return 0;
  return Math.floor(((attempt.correct ?? 0) * 100) / attempt.total);
}

export type StartResult =
  | { status: "started"; attemptId: string }
  | {
      status: "refused";
      reason: "no-assessment" | "videos-left" | "passed" | "wait";
    };

/**
 * Starts an attempt, or hands back the one already open. Every condition
 * the page checks is checked again here: the page is a picture, this is
 * the rule.
 */
export async function startAttemptWith(
  database: Database,
  userId: string,
  courseId: string,
  random: RandomInt,
  now: Date,
): Promise<StartResult> {
  const course = await courseRow(database, courseId);
  const questions = course ? await activeQuestions(database, courseId) : [];
  if (!course || !hasAssessment(course, questions)) {
    return { status: "refused", reason: "no-assessment" };
  }
  if ((await videosLeftWith(database, userId, courseId)) > 0) {
    return { status: "refused", reason: "videos-left" };
  }
  const open = await openAttempt(database, userId, courseId);
  if (open) return { status: "started", attemptId: open.id };
  const last = await lastSubmitted(database, userId, courseId);
  const check = canStart(
    last?.submittedAt
      ? { submittedAt: last.submittedAt, passed: last.passed === true }
      : undefined,
    now,
    course.retryHours,
  );
  if (check.kind !== "can-start") {
    return { status: "refused", reason: check.kind };
  }
  const draw = drawAttempt(questions, random);
  const [row] = await database
    .insert(quizAttempts)
    .values({
      userId,
      courseId,
      questionIds: draw.questionIds,
      optionOrders: draw.optionOrders,
      startedAt: now,
    })
    .returning({ id: quizAttempts.id });
  return { status: "started", attemptId: row.id };
}

export type SubmitResult =
  | { status: "graded"; grade: Grade }
  | { status: "refused"; reason: "not-found" | "submitted" | "incomplete" };

/** Grades the person's open attempt from the positions they picked on
 * screen. A blank or a second submission is refused whole. */
export async function submitAttemptWith(
  database: Database,
  userId: string,
  attemptId: string,
  shownPicks: readonly (number | null)[],
  now: Date,
): Promise<SubmitResult> {
  const [attempt] = await database
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)),
    );
  if (!attempt) return { status: "refused", reason: "not-found" };
  if (attempt.submittedAt) return { status: "refused", reason: "submitted" };
  const answers = originalAnswers(
    { questionIds: attempt.questionIds, optionOrders: attempt.optionOrders },
    shownPicks,
  );
  if (!answers) return { status: "refused", reason: "incomplete" };
  const course = await courseRow(database, attempt.courseId);
  const result = grade(
    attempt.questionIds,
    answers,
    await questionsById(database, attempt.questionIds),
    course?.passingScore ?? 100,
  );
  // Guarded on `submitted_at is null`: two submissions racing, one wins.
  const [updated] = await database
    .update(quizAttempts)
    .set({
      submittedAt: now,
      answers,
      correct: result.correct,
      total: result.total,
      passed: result.passed,
    })
    .where(
      and(eq(quizAttempts.id, attemptId), isNull(quizAttempts.submittedAt)),
    )
    .returning({ id: quizAttempts.id });
  if (!updated) return { status: "refused", reason: "submitted" };
  return { status: "graded", grade: result };
}

/** The person's passed attempt for the course, if any: what a certificate
 * is issued from. */
export async function passedAttemptWith(
  database: Database,
  userId: string,
  courseId: string,
): Promise<{ id: string; score: number } | undefined> {
  const [row] = await database
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.courseId, courseId),
        eq(quizAttempts.passed, true),
      ),
    )
    .orderBy(desc(quizAttempts.submittedAt))
    .limit(1);
  return row ? { id: row.id, score: scoreOf(row) } : undefined;
}

// Management: the platform's questions and settings.

export type AdminQuestion = QuestionRow & { used: boolean };

/** Every question of the course, active or not, and whether an attempt has
 * already shown it (which keeps it from being deleted). */
export async function listQuestionsWith(
  database: Database,
  courseId: string,
): Promise<AdminQuestion[]> {
  const rows = await database
    .select()
    .from(courseQuestions)
    .where(eq(courseQuestions.courseId, courseId))
    .orderBy(asc(courseQuestions.position));
  const used = new Set<string>();
  const attempts = await database
    .select({ questionIds: quizAttempts.questionIds })
    .from(quizAttempts)
    .where(eq(quizAttempts.courseId, courseId));
  for (const a of attempts) for (const id of a.questionIds) used.add(id);
  return rows.map((r) => ({ ...r, used: used.has(r.id) }));
}

async function audit(
  database: Database,
  action: string,
  targetId: string,
  actorId: string,
): Promise<void> {
  await recordAuditWith(database, {
    tenantSlug: SUPERADMIN_TENANT_SLUG,
    actorId,
    action,
    targetType: "course-question",
    targetId,
  });
}

export async function createQuestionWith(
  database: Database,
  courseId: string,
  input: QuestionFormInput,
  actorId: string,
): Promise<QuestionRow> {
  const [last] = await database
    .select({ position: courseQuestions.position })
    .from(courseQuestions)
    .where(eq(courseQuestions.courseId, courseId))
    .orderBy(desc(courseQuestions.position))
    .limit(1);
  const [row] = await database
    .insert(courseQuestions)
    .values({
      courseId,
      prompt: input.prompt,
      options: input.options,
      correctIndex: input.correctIndex,
      position: (last?.position ?? 0) + 1,
    })
    .returning();
  await audit(database, "course-question.create", row.id, actorId);
  return row;
}

export async function updateQuestionWith(
  database: Database,
  id: string,
  input: QuestionFormInput,
  actorId: string,
): Promise<boolean> {
  const [row] = await database
    .update(courseQuestions)
    .set({
      prompt: input.prompt,
      options: input.options,
      correctIndex: input.correctIndex,
      updatedAt: new Date(),
    })
    .where(eq(courseQuestions.id, id))
    .returning({ id: courseQuestions.id });
  if (!row) return false;
  await audit(database, "course-question.update", id, actorId);
  return true;
}

export async function setQuestionActiveWith(
  database: Database,
  id: string,
  active: boolean,
  actorId: string,
): Promise<boolean> {
  const [row] = await database
    .update(courseQuestions)
    .set({ active, updatedAt: new Date() })
    .where(eq(courseQuestions.id, id))
    .returning({ id: courseQuestions.id });
  if (!row) return false;
  await audit(
    database,
    active ? "course-question.activate" : "course-question.deactivate",
    id,
    actorId,
  );
  return true;
}

export type DeleteQuestionResult = "deleted" | "used" | "not-found";

/** Deletes a question no attempt has shown; one that has is only ever
 * deactivated, so the attempt can still be read and audited. */
export async function deleteQuestionWith(
  database: Database,
  id: string,
  actorId: string,
): Promise<DeleteQuestionResult> {
  const [row] = await database
    .select({ courseId: courseQuestions.courseId })
    .from(courseQuestions)
    .where(eq(courseQuestions.id, id));
  if (!row) return "not-found";
  const [used] = await database
    .select({ id: quizAttempts.id })
    .from(quizAttempts)
    .where(sql`${quizAttempts.questionIds} @> ${JSON.stringify([id])}::jsonb`)
    .limit(1);
  if (used) return "used";
  await database.delete(courseQuestions).where(eq(courseQuestions.id, id));
  // Written out rather than through `audit()` above: the deletion and its
  // trail stay in one function, where check:destructive can see them.
  await recordAuditWith(database, {
    tenantSlug: SUPERADMIN_TENANT_SLUG,
    actorId,
    action: "course-question.delete",
    targetType: "course-question",
    targetId: id,
  });
  return "deleted";
}

export async function updateAssessmentSettingsWith(
  database: Database,
  courseId: string,
  settings: AssessmentSettings,
  actorId: string,
): Promise<boolean> {
  const [row] = await database
    .update(courses)
    .set({ ...settings, updatedAt: new Date() })
    .where(eq(courses.id, courseId))
    .returning({ id: courses.id });
  if (!row) return false;
  await recordAuditWith(database, {
    tenantSlug: SUPERADMIN_TENANT_SLUG,
    actorId,
    action: "course.assessment-settings",
    targetType: "course",
    targetId: courseId,
  });
  return true;
}

/** Every course's questions at once, for the management screen. */
export async function listAllQuestionsWith(
  database: Database,
): Promise<Map<string, AdminQuestion[]>> {
  const ids = await database.select({ id: courses.id }).from(courses);
  const out = new Map<string, AdminQuestion[]>();
  for (const { id } of ids) out.set(id, await listQuestionsWith(database, id));
  return out;
}

export async function listAllQuestions(): Promise<
  Map<string, AdminQuestion[]>
> {
  return listAllQuestionsWith(db);
}
