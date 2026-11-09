import "server-only";
import { and, eq } from "drizzle-orm";
import {
  type CertificateRequest,
  certificateCode,
} from "@/core/courses/certificate.ts";
import { type Database, db } from "@/db/index.ts";
import { certificates, courses } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { cohortOfficeNameWith } from "./cohorts.ts";
import { passedAttemptWith } from "./quiz.ts";

// Course certificates: issued once per person and course from a passed
// attempt, read back by their owner (for the PDF) and by code (for the
// public check). What a certificate says is the snapshot taken at issue.

export type CertificateRow = typeof certificates.$inferSelect;

export interface IssueContext {
  userId: string;
  courseId: string;
  tenantSlug: string;
  tenantName: string;
  /** The host of the request: the public check's address. */
  host: string;
}

export type IssueResult =
  | { status: "issued"; certificate: CertificateRow }
  | {
      status: "refused";
      reason: "not-passed" | "already-issued" | "no-certificate";
    };

/**
 * Issues the person's certificate for the course. Needs a passed attempt
 * and a course that gives certificates; refuses a second one. The code is
 * random; a collision (60 bits, so in theory) is retried.
 */
export async function issueCertificateWith(
  database: Database,
  context: IssueContext,
  request: CertificateRequest,
  randomBytes: (size: number) => Uint8Array,
  now: Date,
): Promise<IssueResult> {
  const [course] = await database
    .select({ title: courses.title, workloadHours: courses.workloadHours })
    .from(courses)
    .where(eq(courses.id, context.courseId));
  if (!course || course.workloadHours === null) {
    return { status: "refused", reason: "no-certificate" };
  }
  const existing = await certificateForUserWith(
    database,
    context.userId,
    context.courseId,
  );
  if (existing) return { status: "refused", reason: "already-issued" };
  const passed = await passedAttemptWith(
    database,
    context.userId,
    context.courseId,
  );
  if (!passed) return { status: "refused", reason: "not-passed" };
  // A course learner works at their cohort's office, not at the courses
  // office their account lives in: the certificate names the cohort's,
  // typed by the platform account, never by the learner.
  const officeName =
    (await cohortOfficeNameWith(database, context.userId)) ??
    context.tenantName;

  for (let tries = 0; tries < 3; tries++) {
    const code = certificateCode(randomBytes(8));
    const [taken] = await database
      .select({ id: certificates.id })
      .from(certificates)
      .where(eq(certificates.code, code));
    if (taken) continue;
    const [row] = await database
      .insert(certificates)
      .values({
        code,
        userId: context.userId,
        courseId: context.courseId,
        attemptId: passed.id,
        fullName: request.fullName,
        cpf: request.cpf,
        roleTitle: request.roleTitle,
        tenantSlug: context.tenantSlug,
        tenantName: officeName,
        issuedHost: context.host,
        courseTitle: course.title,
        workloadHours: course.workloadHours,
        score: passed.score,
        issuedAt: now,
      })
      .returning();
    // The person's own act, so under their office, like their other ones.
    await recordAuditWith(database, {
      tenantSlug: context.tenantSlug,
      actorId: context.userId,
      action: "course.certificate.issue",
      targetType: "certificate",
      targetId: row.id,
    });
    return { status: "issued", certificate: row };
  }
  throw new Error("certificate code collided three times");
}

export async function issueCertificate(
  context: IssueContext,
  request: CertificateRequest,
  randomBytes: (size: number) => Uint8Array,
): Promise<IssueResult> {
  return issueCertificateWith(db, context, request, randomBytes, new Date());
}

export async function certificateForUserWith(
  database: Database,
  userId: string,
  courseId: string,
): Promise<CertificateRow | undefined> {
  const [row] = await database
    .select()
    .from(certificates)
    .where(
      and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)),
    );
  return row;
}

export async function certificateForUser(
  userId: string,
  courseId: string,
): Promise<CertificateRow | undefined> {
  return certificateForUserWith(db, userId, courseId);
}

/** By code, for the public check. Expects a normalised code. */
export async function certificateByCodeWith(
  database: Database,
  code: string,
): Promise<CertificateRow | undefined> {
  const [row] = await database
    .select()
    .from(certificates)
    .where(eq(certificates.code, code));
  return row;
}

export async function certificateByCode(
  code: string,
): Promise<CertificateRow | undefined> {
  return certificateByCodeWith(db, code);
}
