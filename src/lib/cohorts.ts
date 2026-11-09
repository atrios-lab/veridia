import { randomUUID } from "node:crypto";
import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { SUPERADMIN_TENANT_SLUG } from "@/core/auth/roles.ts";
import {
  type CohortCreateInput,
  type CohortJoinInput,
  type CohortState,
  type CohortUpdateInput,
  cohortCode,
  cohortState,
  expiryAfter,
  seatsFit,
} from "@/core/cohorts/cohort.ts";
import { type LearnerStatus, learnerStatus } from "@/core/cohorts/progress.ts";
import { addDays, type IsoDate } from "@/core/scheduling/calendar.ts";
import { COURSES_TENANT_SLUG } from "@/core/tenant/courses-tenant.ts";
import { account, user } from "@/db/auth-schema.ts";
import { type Database, db } from "@/db/index.ts";
import {
  certificates,
  cohortMembers,
  courseCohorts,
  courses,
  quizAttempts,
  tutorialProgress,
  tutorials,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

// Course cohorts: the platform account's links for offices that are not
// clients yet, the learners who joined through them, and what each one has
// done in the cohort's course. Every function takes the database, so the
// tests run them against Postgres in process; the screens and the sign-up
// action only add the session, the headers and the redirect.

export type CohortRow = typeof courseCohorts.$inferSelect;

async function memberCountWith(
  database: Database,
  cohortId: string,
): Promise<number> {
  const [row] = await database
    .select({ n: count() })
    .from(cohortMembers)
    .where(eq(cohortMembers.cohortId, cohortId));
  return row?.n ?? 0;
}

async function auditPlatform(
  database: Database,
  actorId: string,
  action: string,
  cohortId: string,
): Promise<void> {
  await recordAuditWith(database, {
    tenantSlug: SUPERADMIN_TENANT_SLUG,
    actorId,
    action,
    targetType: "cohort",
    targetId: cohortId,
  });
}

export class CohortCourseError extends Error {}

/**
 * A new cohort, its link valid through `validDays` from `today` on the
 * office's calendar. The course has to exist and give a certificate: a
 * cohort exists to hand one out. A code collision (40 bits, so in theory)
 * is retried.
 */
export async function createCohortWith(
  database: Database,
  input: CohortCreateInput,
  actorId: string,
  randomBytes: (size: number) => Uint8Array,
  today: IsoDate,
): Promise<CohortRow> {
  const [course] = await database
    .select({ workloadHours: courses.workloadHours })
    .from(courses)
    .where(eq(courses.id, input.courseId));
  if (!course || course.workloadHours === null) {
    throw new CohortCourseError("course without a certificate");
  }
  for (let tries = 0; tries < 3; tries++) {
    const code = cohortCode(randomBytes(5));
    const [taken] = await database
      .select({ id: courseCohorts.id })
      .from(courseCohorts)
      .where(eq(courseCohorts.code, code));
    if (taken) continue;
    const [row] = await database
      .insert(courseCohorts)
      .values({
        code,
        courseId: input.courseId,
        officeName: input.officeName,
        officeCity: input.officeCity,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        seats: input.seats,
        expiresAt: expiryAfter(addDays(today, input.validDays)),
        createdBy: actorId,
      })
      .returning();
    await auditPlatform(database, actorId, "cohort.create", row.id);
    return row;
  }
  throw new Error("cohort code collided three times");
}

export type CohortUpdateResult =
  | { status: "updated" }
  | { status: "not-found" }
  | { status: "seats-below-members"; members: number };

/** Edits a cohort. Seats never go below the learners already in it. */
export async function updateCohortWith(
  database: Database,
  cohortId: string,
  input: CohortUpdateInput,
  actorId: string,
): Promise<CohortUpdateResult> {
  const [existing] = await database
    .select({ id: courseCohorts.id })
    .from(courseCohorts)
    .where(eq(courseCohorts.id, cohortId));
  if (!existing) return { status: "not-found" };
  const members = await memberCountWith(database, cohortId);
  if (!seatsFit(input.seats, members)) {
    return { status: "seats-below-members", members };
  }
  await database
    .update(courseCohorts)
    .set({
      officeName: input.officeName,
      officeCity: input.officeCity,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      seats: input.seats,
      expiresAt: expiryAfter(input.lastDay),
      updatedAt: new Date(),
    })
    .where(eq(courseCohorts.id, cohortId));
  await auditPlatform(database, actorId, "cohort.update", cohortId);
  return { status: "updated" };
}

/** Closes the link by hand, or opens it again. Nothing else changes. */
export async function setCohortClosedWith(
  database: Database,
  cohortId: string,
  closed: boolean,
  actorId: string,
  now: Date,
): Promise<boolean> {
  const updated = await database
    .update(courseCohorts)
    .set({ closedAt: closed ? now : null, updatedAt: now })
    .where(eq(courseCohorts.id, cohortId))
    .returning({ id: courseCohorts.id });
  if (updated.length === 0) return false;
  await auditPlatform(
    database,
    actorId,
    closed ? "cohort.close" : "cohort.reopen",
    cohortId,
  );
  return true;
}

export interface CohortLink {
  cohort: CohortRow;
  courseSlug: string;
  courseTitle: string;
  state: CohortState;
}

/** The cohort behind a link, as the sign-up page shows it. Expects a
 * normalised code. */
export async function cohortByCodeWith(
  database: Database,
  code: string,
  now: Date,
): Promise<CohortLink | undefined> {
  const [row] = await database
    .select({
      cohort: courseCohorts,
      courseSlug: courses.slug,
      courseTitle: courses.title,
    })
    .from(courseCohorts)
    .innerJoin(courses, eq(courses.id, courseCohorts.courseId))
    .where(eq(courseCohorts.code, code));
  if (!row) return undefined;
  const members = await memberCountWith(database, row.cohort.id);
  return { ...row, state: cohortState(row.cohort, members, now) };
}

export type JoinResult =
  | { status: "joined"; userId: string; courseSlug: string }
  | {
      status: "refused";
      reason: "not-found" | Exclude<CohortState, "open"> | "email-taken";
    };

export interface JoinDeps {
  /** The auth library's own hash, so the login reads what is written here. */
  hashPassword: (password: string) => Promise<string>;
  newId?: () => string;
}

/**
 * Creates a learner's account through a cohort link and signs it into the
 * cohort, in one transaction. The cohort's row is locked first and its
 * state checked again inside: two people taking the last seat at once get
 * one account and one "full", never two accounts on a cohort of N.
 *
 * The rows are the ones the auth library itself writes for a password
 * account (see scripts/seed-admin.ts): a `user` with the office and the
 * role, and a `credential` account holding the hash. Written here rather
 * than through the library's adapter so the seat, the account and the
 * membership land together or not at all. The public sign-up endpoint stays
 * disabled: only a valid code reaches this.
 */
export async function joinCohortWith(
  database: Database,
  code: string,
  input: CohortJoinInput,
  deps: JoinDeps,
  now: Date,
): Promise<JoinResult> {
  // Hashing is slow on purpose; it stays outside the lock.
  const passwordHash = await deps.hashPassword(input.password);
  const newId = deps.newId ?? randomUUID;
  return database.transaction(async (tx) => {
    const [cohort] = await tx
      .select()
      .from(courseCohorts)
      .where(eq(courseCohorts.code, code))
      .for("update");
    if (!cohort) return { status: "refused", reason: "not-found" } as const;
    const members = await memberCountWith(tx, cohort.id);
    const state = cohortState(cohort, members, now);
    if (state !== "open") return { status: "refused", reason: state } as const;

    // Unique platform-wide, like every account: the same check createUser
    // makes, here inside the transaction.
    const [taken] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email));
    if (taken) return { status: "refused", reason: "email-taken" } as const;

    const userId = newId();
    await tx.insert(user).values({
      id: userId,
      name: input.fullName,
      email: input.email,
      emailVerified: true,
      role: "learner",
      tenantSlug: COURSES_TENANT_SLUG,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: newId(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(cohortMembers).values({
      userId,
      cohortId: cohort.id,
      joinedAt: now,
      contactConsentAt: input.contactConsent ? now : null,
    });
    await recordAuditWith(tx, {
      tenantSlug: COURSES_TENANT_SLUG,
      actorId: userId,
      action: "cohort.join",
      targetType: "cohort",
      targetId: cohort.id,
    });
    const [course] = await tx
      .select({ slug: courses.slug })
      .from(courses)
      .where(eq(courses.id, cohort.courseId));
    return {
      status: "joined",
      userId,
      courseSlug: course?.slug ?? "",
    } as const;
  });
}

/** The office a learner's certificate names: their cohort's, when they
 * joined through one. */
export async function cohortOfficeNameWith(
  database: Database,
  userId: string,
): Promise<string | undefined> {
  const [row] = await database
    .select({ officeName: courseCohorts.officeName })
    .from(cohortMembers)
    .innerJoin(courseCohorts, eq(courseCohorts.id, cohortMembers.cohortId))
    .where(eq(cohortMembers.userId, userId));
  return row?.officeName;
}

export interface CohortSummary {
  cohort: CohortRow;
  courseTitle: string;
  members: number;
  certified: number;
  state: CohortState;
}

/** Every cohort, newest first, with seats used and certificates issued. */
export async function listCohortsWith(
  database: Database,
  now: Date,
): Promise<CohortSummary[]> {
  const rows = await database
    .select({ cohort: courseCohorts, courseTitle: courses.title })
    .from(courseCohorts)
    .innerJoin(courses, eq(courses.id, courseCohorts.courseId))
    .orderBy(desc(courseCohorts.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.cohort.id);
  const memberRows = await database
    .select({ cohortId: cohortMembers.cohortId, n: count() })
    .from(cohortMembers)
    .where(inArray(cohortMembers.cohortId, ids))
    .groupBy(cohortMembers.cohortId);
  const certifiedRows = await database
    .select({ cohortId: cohortMembers.cohortId, n: count() })
    .from(cohortMembers)
    .innerJoin(courseCohorts, eq(courseCohorts.id, cohortMembers.cohortId))
    .innerJoin(
      certificates,
      and(
        eq(certificates.userId, cohortMembers.userId),
        eq(certificates.courseId, courseCohorts.courseId),
      ),
    )
    .where(inArray(cohortMembers.cohortId, ids))
    .groupBy(cohortMembers.cohortId);
  const membersOf = new Map(memberRows.map((r) => [r.cohortId, r.n]));
  const certifiedOf = new Map(certifiedRows.map((r) => [r.cohortId, r.n]));
  return rows.map(({ cohort, courseTitle }) => {
    const members = membersOf.get(cohort.id) ?? 0;
    return {
      cohort,
      courseTitle,
      members,
      certified: certifiedOf.get(cohort.id) ?? 0,
      state: cohortState(cohort, members, now),
    };
  });
}

export interface CohortLearner {
  userId: string;
  name: string;
  email: string;
  joinedAt: Date;
  contactConsentAt: Date | null;
  watched: number;
  status: LearnerStatus;
}

export interface CohortDetail extends CohortSummary {
  courseSlug: string;
  /** Published videos of the cohort's course: the "of N" in "7 of 14". */
  videoCount: number;
  learners: CohortLearner[];
}

/** One cohort with each learner and how far they went in its course. */
export async function cohortDetailWith(
  database: Database,
  cohortId: string,
  now: Date,
): Promise<CohortDetail | undefined> {
  const [row] = await database
    .select({
      cohort: courseCohorts,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(courseCohorts)
    .innerJoin(courses, eq(courses.id, courseCohorts.courseId))
    .where(eq(courseCohorts.id, cohortId));
  if (!row) return undefined;
  const courseId = row.cohort.courseId;

  const people = await database
    .select({
      userId: cohortMembers.userId,
      name: user.name,
      email: user.email,
      joinedAt: cohortMembers.joinedAt,
      contactConsentAt: cohortMembers.contactConsentAt,
    })
    .from(cohortMembers)
    .innerJoin(user, eq(user.id, cohortMembers.userId))
    .where(eq(cohortMembers.cohortId, cohortId))
    .orderBy(asc(cohortMembers.joinedAt));

  const [videos] = await database
    .select({ n: count() })
    .from(tutorials)
    .where(
      and(eq(tutorials.courseId, courseId), isNotNull(tutorials.publishedAt)),
    );
  const ids = people.map((p) => p.userId);
  const watchedRows =
    ids.length === 0
      ? []
      : await database
          .select({ userId: tutorialProgress.userId, n: count() })
          .from(tutorialProgress)
          .innerJoin(tutorials, eq(tutorials.id, tutorialProgress.videoId))
          .where(
            and(
              inArray(tutorialProgress.userId, ids),
              eq(tutorials.courseId, courseId),
              isNotNull(tutorials.publishedAt),
            ),
          )
          .groupBy(tutorialProgress.userId);
  const attemptRows =
    ids.length === 0
      ? []
      : await database
          .select({
            userId: quizAttempts.userId,
            submittedAt: quizAttempts.submittedAt,
            passed: quizAttempts.passed,
          })
          .from(quizAttempts)
          .where(
            and(
              inArray(quizAttempts.userId, ids),
              eq(quizAttempts.courseId, courseId),
            ),
          );
  const certifiedRows =
    ids.length === 0
      ? []
      : await database
          .select({ userId: certificates.userId })
          .from(certificates)
          .where(
            and(
              inArray(certificates.userId, ids),
              eq(certificates.courseId, courseId),
            ),
          );

  const watchedOf = new Map(watchedRows.map((r) => [r.userId, r.n]));
  const certified = new Set(certifiedRows.map((r) => r.userId));
  const learners = people.map((person) => {
    const attempts = attemptRows.filter((a) => a.userId === person.userId);
    return {
      ...person,
      watched: watchedOf.get(person.userId) ?? 0,
      status: learnerStatus({
        certified: certified.has(person.userId),
        passed: attempts.some((a) => a.passed === true),
        attemptOpen: attempts.some((a) => a.submittedAt === null),
        submitted: attempts.some((a) => a.submittedAt !== null),
      }),
    };
  });

  return {
    cohort: row.cohort,
    courseTitle: row.courseTitle,
    courseSlug: row.courseSlug,
    members: people.length,
    certified: certified.size,
    state: cohortState(row.cohort, people.length, now),
    videoCount: videos?.n ?? 0,
    learners,
  };
}

/** Courses a cohort may be for: the ones that give a certificate. */
export async function certificateCoursesWith(
  database: Database,
): Promise<{ id: string; title: string }[]> {
  return database
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(isNotNull(courses.workloadHours))
    .orderBy(asc(courses.position));
}

// The same, against the app's database: what the screens and actions call.

export function createCohort(
  input: CohortCreateInput,
  actorId: string,
  randomBytes: (size: number) => Uint8Array,
  today: IsoDate,
): Promise<CohortRow> {
  return createCohortWith(db, input, actorId, randomBytes, today);
}

export function updateCohort(
  cohortId: string,
  input: CohortUpdateInput,
  actorId: string,
): Promise<CohortUpdateResult> {
  return updateCohortWith(db, cohortId, input, actorId);
}

export function setCohortClosed(
  cohortId: string,
  closed: boolean,
  actorId: string,
): Promise<boolean> {
  return setCohortClosedWith(db, cohortId, closed, actorId, new Date());
}

export function cohortByCode(code: string): Promise<CohortLink | undefined> {
  return cohortByCodeWith(db, code, new Date());
}

export function joinCohort(
  code: string,
  input: CohortJoinInput,
  deps: JoinDeps,
): Promise<JoinResult> {
  return joinCohortWith(db, code, input, deps, new Date());
}

export function cohortOfficeName(userId: string): Promise<string | undefined> {
  return cohortOfficeNameWith(db, userId);
}

export function listCohorts(): Promise<CohortSummary[]> {
  return listCohortsWith(db, new Date());
}

export function cohortDetail(
  cohortId: string,
): Promise<CohortDetail | undefined> {
  return cohortDetailWith(db, cohortId, new Date());
}

export function certificateCourses(): Promise<{ id: string; title: string }[]> {
  return certificateCoursesWith(db);
}
