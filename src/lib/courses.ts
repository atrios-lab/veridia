import "server-only";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { SUPERADMIN_TENANT_SLUG } from "@/core/auth/roles.ts";
import { type Course, PANEL_COURSE_SLUG } from "@/core/tutorials/catalog.ts";
import type { CourseFormInput } from "@/core/tutorials/video.ts";
import { type Database, db } from "@/db/index.ts";
import { courses, tutorials } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

// The platform's courses: the same rows for every office, written only by
// the platform account (the actions check `tutorials.manage`), audited under
// the platform's own slug. Like src/lib/tutorials.ts, files are not this
// module's: a write that replaces or removes the cover or the support PDF
// returns the URLs nothing references any more, and the action deletes
// them from the store afterwards.

export type CourseRow = typeof courses.$inferSelect;

export function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    posterUrl: row.posterPath,
    materialUrl: row.materialPath,
    sequential: row.sequential,
  };
}

async function audit(
  database: Database,
  action: string,
  id: string,
  actorId: string,
): Promise<void> {
  await recordAuditWith(database, {
    tenantSlug: SUPERADMIN_TENANT_SLUG,
    actorId,
    action,
    targetType: "course",
    targetId: id,
  });
}

/** Published courses in catalog order. Whether each has a published video
 * to show is the catalog's to decide, from the videos it already reads. */
export async function listPublishedCoursesWith(
  database: Database,
): Promise<Course[]> {
  const rows = await database
    .select()
    .from(courses)
    .where(isNotNull(courses.publishedAt))
    .orderBy(asc(courses.position));
  return rows.map(toCourse);
}

export async function listPublishedCourses(): Promise<Course[]> {
  return listPublishedCoursesWith(db);
}

/** A course an office may open: published, by its address. */
export async function getPublishedCourseBySlugWith(
  database: Database,
  slug: string,
): Promise<Course | undefined> {
  const [row] = await database
    .select()
    .from(courses)
    .where(and(eq(courses.slug, slug), isNotNull(courses.publishedAt)));
  return row ? toCourse(row) : undefined;
}

export async function getPublishedCourseBySlug(
  slug: string,
): Promise<Course | undefined> {
  return getPublishedCourseBySlugWith(db, slug);
}

/** Every course, drafts included, with how many videos each has: the
 * management screen. */
export async function listAllCoursesWith(
  database: Database,
): Promise<(CourseRow & { videoCount: number })[]> {
  const rows = await database
    .select({ course: courses, videoCount: count(tutorials.id) })
    .from(courses)
    .leftJoin(tutorials, eq(tutorials.courseId, courses.id))
    .groupBy(courses.id)
    .orderBy(asc(courses.position));
  return rows.map((r) => ({ ...r.course, videoCount: r.videoCount }));
}

export async function listAllCourses(): Promise<
  (CourseRow & { videoCount: number })[]
> {
  return listAllCoursesWith(db);
}

export async function getCourseWith(
  database: Database,
  id: string,
): Promise<CourseRow | undefined> {
  const [row] = await database.select().from(courses).where(eq(courses.id, id));
  return row;
}

/** Another course already answers at that address. */
export class SlugTakenError extends Error {
  constructor() {
    super("Já existe um curso com esse endereço.");
  }
}

/** The panel course is found by its slug (trail, overview card, "Como usar
 * esta tela"): renaming it would silently empty all three. */
export class PanelCourseError extends Error {}

async function assertSlugFree(
  database: Database,
  slug: string,
  exceptId: string | null,
): Promise<void> {
  const [taken] = await database
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.slug, slug),
        exceptId ? sql`${courses.id} <> ${exceptId}` : undefined,
      ),
    )
    .limit(1);
  if (taken) throw new SlugTakenError();
}

export interface CourseFiles {
  posterUrl: string | null;
  materialUrl: string | null;
}

/** A new course, as a draft, at the end of the catalog. */
export async function createCourseWith(
  database: Database,
  input: CourseFormInput,
  files: CourseFiles,
  actorId: string,
): Promise<CourseRow> {
  await assertSlugFree(database, input.slug, null);
  const [last] = await database
    .select({ position: courses.position })
    .from(courses)
    .orderBy(desc(courses.position))
    .limit(1);
  const [row] = await database
    .insert(courses)
    .values({
      slug: input.slug,
      title: input.title,
      description: input.description,
      sequential: input.sequential,
      posterPath: files.posterUrl,
      materialPath: files.materialUrl,
      position: (last?.position ?? 0) + 1,
      createdBy: actorId,
    })
    .returning();
  await audit(database, "course.create", row.id, actorId);
  return row;
}

export async function createCourse(
  input: CourseFormInput,
  files: CourseFiles,
  actorId: string,
): Promise<CourseRow> {
  return createCourseWith(db, input, files, actorId);
}

export interface CourseUpdateResult {
  row: CourseRow;
  /** Stored files the row no longer points at, for the caller to delete. */
  orphaned: string[];
}

/**
 * Edits a course. `files` fields left undefined keep what is stored; null
 * removes the file. The panel course keeps its address.
 */
export async function updateCourseWith(
  database: Database,
  id: string,
  input: CourseFormInput,
  files: Partial<CourseFiles>,
  actorId: string,
): Promise<CourseUpdateResult | undefined> {
  const current = await getCourseWith(database, id);
  if (!current) return undefined;
  if (current.slug === PANEL_COURSE_SLUG && input.slug !== PANEL_COURSE_SLUG) {
    throw new PanelCourseError(
      "O endereço do curso do painel não muda: a trilha e o link das telas dependem dele.",
    );
  }
  await assertSlugFree(database, input.slug, id);
  const [row] = await database
    .update(courses)
    .set({
      slug: input.slug,
      title: input.title,
      description: input.description,
      sequential: input.sequential,
      ...(files.posterUrl !== undefined ? { posterPath: files.posterUrl } : {}),
      ...(files.materialUrl !== undefined
        ? { materialPath: files.materialUrl }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(courses.id, id))
    .returning();
  await audit(database, "course.update", id, actorId);
  const orphaned: string[] = [];
  if (
    files.posterUrl !== undefined &&
    current.posterPath &&
    files.posterUrl !== current.posterPath
  ) {
    orphaned.push(current.posterPath);
  }
  if (
    files.materialUrl !== undefined &&
    current.materialPath &&
    files.materialUrl !== current.materialPath
  ) {
    orphaned.push(current.materialPath);
  }
  return { row, orphaned };
}

export async function updateCourse(
  id: string,
  input: CourseFormInput,
  files: Partial<CourseFiles>,
  actorId: string,
): Promise<CourseUpdateResult | undefined> {
  return updateCourseWith(db, id, input, files, actorId);
}

export async function setCoursePublishedWith(
  database: Database,
  id: string,
  published: boolean,
  actorId: string,
): Promise<boolean> {
  const [row] = await database
    .update(courses)
    .set({ publishedAt: published ? new Date() : null, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning({ id: courses.id });
  if (!row) return false;
  await audit(
    database,
    published ? "course.publish" : "course.unpublish",
    id,
    actorId,
  );
  return true;
}

export async function setCoursePublished(
  id: string,
  published: boolean,
  actorId: string,
): Promise<boolean> {
  return setCoursePublishedWith(db, id, published, actorId);
}

/** Swaps the course with its neighbour in the catalog. */
export async function moveCourseWith(
  database: Database,
  id: string,
  direction: "up" | "down",
  actorId: string,
): Promise<boolean> {
  const current = await getCourseWith(database, id);
  if (!current) return false;
  const [neighbour] = await database
    .select({ id: courses.id, position: courses.position })
    .from(courses)
    .where(
      direction === "up"
        ? sql`${courses.position} < ${current.position}`
        : sql`${courses.position} > ${current.position}`,
    )
    .orderBy(
      direction === "up" ? desc(courses.position) : asc(courses.position),
    )
    .limit(1);
  if (!neighbour) return false;
  await database
    .update(courses)
    .set({ position: neighbour.position })
    .where(eq(courses.id, current.id));
  await database
    .update(courses)
    .set({ position: current.position })
    .where(eq(courses.id, neighbour.id));
  await audit(database, "course.move", id, actorId);
  return true;
}

export async function moveCourse(
  id: string,
  direction: "up" | "down",
  actorId: string,
): Promise<boolean> {
  return moveCourseWith(db, id, direction, actorId);
}

export type DeleteCourseResult =
  | { status: "deleted"; orphaned: string[] }
  | { status: "has-videos" }
  | { status: "panel" }
  | { status: "not-found" };

/**
 * Deletes an empty course and hands back its files. A course with videos
 * is refused rather than taking anyone's progress along by accident; the
 * panel course is never deleted.
 */
export async function deleteCourseWith(
  database: Database,
  id: string,
  actorId: string,
): Promise<DeleteCourseResult> {
  const current = await getCourseWith(database, id);
  if (!current) return { status: "not-found" };
  if (current.slug === PANEL_COURSE_SLUG) return { status: "panel" };
  const [videos] = await database
    .select({ n: count() })
    .from(tutorials)
    .where(eq(tutorials.courseId, id));
  if ((videos?.n ?? 0) > 0) return { status: "has-videos" };
  await database.delete(courses).where(eq(courses.id, id));
  // Written out rather than through `audit()` above: the deletion and its
  // trail stay in one function, where check:destructive can see them.
  await recordAuditWith(database, {
    tenantSlug: SUPERADMIN_TENANT_SLUG,
    actorId,
    action: "course.delete",
    targetType: "course",
    targetId: id,
  });
  return {
    status: "deleted",
    orphaned: [current.posterPath, current.materialPath].filter(
      (path): path is string => path !== null,
    ),
  };
}

export async function deleteCourse(
  id: string,
  actorId: string,
): Promise<DeleteCourseResult> {
  return deleteCourseWith(db, id, actorId);
}

export async function getCourse(id: string): Promise<CourseRow | undefined> {
  return getCourseWith(db, id);
}
