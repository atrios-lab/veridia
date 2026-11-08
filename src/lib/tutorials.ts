import "server-only";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { SUPERADMIN_TENANT_SLUG } from "@/core/auth/roles.ts";
import {
  isTutorialKind,
  PANEL_COURSE_SLUG,
  type Tutorial,
} from "@/core/tutorials/catalog.ts";
import { courseOrder, unlockedIds } from "@/core/tutorials/course.ts";
import type { TutorialFormInput } from "@/core/tutorials/video.ts";
import { type Database, db } from "@/db/index.ts";
import { courses, tutorialProgress, tutorials } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

// The platform's video tutorials and each person's progress through them.
//
// The catalog side is global: no tenant slug anywhere, the same rows for
// every office, written only by the platform account (the actions check
// `tutorials.manage`; this module trusts its caller for that, like every
// lib). What it does insist on is where the audit trail goes: under the
// platform's own sentinel slug, never under the office the account happened
// to be signed into, because the office did not do it.
//
// Files are not this module's: a write that replaces or removes one returns
// the URLs nothing references any more, and the action deletes them from
// the store afterwards (src/lib/uploads.ts). The row is the source of
// truth, so the store is cleaned last, and never from in here.
//
// The progress side is per person, never per office (see the table's
// comment in src/db/schema.ts): every caller passes the session's own user
// id, which is what makes one clerk's progress invisible to the next one
// on the same counter.

export type TutorialRow = typeof tutorials.$inferSelect;

/** A row as the panel reads it: the file paths as public URLs. */
export function toTutorial(row: TutorialRow): Tutorial {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    durationSeconds: row.durationSeconds,
    videoUrl: row.videoPath,
    captionsUrl: row.captionsPath,
    posterUrl: row.posterPath,
    route: row.route,
    trail: row.trail,
    courseId: row.courseId,
    // The column is free text with a default; anything else reads as a
    // lesson rather than breaking the page.
    kind: isTutorialKind(row.kind) ? row.kind : "lesson",
  };
}

/** Published videos of published courses: the only ones an office sees. */
const visible = and(
  isNotNull(tutorials.publishedAt),
  isNotNull(courses.publishedAt),
);

/** What every office sees: published videos of published courses, course
 * by course in course order, each course's videos by position. */
export async function listPublishedTutorialsWith(
  database: Database,
): Promise<Tutorial[]> {
  const rows = await database
    .select({ tutorial: tutorials })
    .from(tutorials)
    .innerJoin(courses, eq(courses.id, tutorials.courseId))
    .where(visible)
    .orderBy(asc(courses.position), asc(tutorials.position));
  return rows.map((r) => toTutorial(r.tutorial));
}

/**
 * The "Uso do painel" course alone, in the order it is watched: what the
 * trail, the overview card and "Como usar esta tela" read. A deep dive in
 * another course never claims a screen or counts on the trail.
 */
export async function listPanelTutorialsWith(
  database: Database,
): Promise<Tutorial[]> {
  const rows = await database
    .select({ tutorial: tutorials })
    .from(tutorials)
    .innerJoin(courses, eq(courses.id, tutorials.courseId))
    .where(and(visible, eq(courses.slug, PANEL_COURSE_SLUG)))
    .orderBy(asc(tutorials.position));
  return courseOrder(rows.map((r) => toTutorial(r.tutorial)));
}

export async function listPanelTutorials(): Promise<Tutorial[]> {
  return listPanelTutorialsWith(db);
}

export async function listPublishedTutorials(): Promise<Tutorial[]> {
  return listPublishedTutorialsWith(db);
}

/** Every row, drafts included, for the management screen only: course by
 * course, each by position. */
export async function listAllTutorialsWith(
  database: Database,
): Promise<TutorialRow[]> {
  const rows = await database
    .select({ tutorial: tutorials })
    .from(tutorials)
    .innerJoin(courses, eq(courses.id, tutorials.courseId))
    .orderBy(asc(courses.position), asc(tutorials.position));
  return rows.map((r) => r.tutorial);
}

export async function listAllTutorials(): Promise<TutorialRow[]> {
  return listAllTutorialsWith(db);
}

export async function getTutorialWith(
  database: Database,
  id: string,
): Promise<TutorialRow | undefined> {
  const [row] = await database
    .select()
    .from(tutorials)
    .where(eq(tutorials.id, id));
  return row;
}

/** Whether the sidebar has a reason to offer "Treinamento" to an office. */
export async function publishedTutorialCountWith(
  database: Database,
): Promise<number> {
  const [row] = await database
    .select({ n: count() })
    .from(tutorials)
    .innerJoin(courses, eq(courses.id, tutorials.courseId))
    .where(visible);
  return row?.n ?? 0;
}

export async function publishedTutorialCount(): Promise<number> {
  return publishedTutorialCountWith(db);
}

export interface TutorialFiles {
  videoUrl: string;
  captionsUrl: string | null;
  posterUrl: string | null;
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
    targetType: "tutorial",
    targetId: id,
  });
}

/**
 * A new video, as a draft, at the end of the list. The id is the caller's:
 * with direct upload the browser needs it before the row exists, to name
 * the file (see `tutorialFilePath`), so the action mints it and this
 * function only stores it.
 */
/**
 * A course's second Apresentação or Encerramento. The partial unique index
 * refuses it too; checking first gives the form a sentence instead of a
 * constraint name.
 */
export class FrameTakenError extends Error {
  readonly kind: "intro" | "outro";
  constructor(kind: "intro" | "outro") {
    super(
      kind === "intro"
        ? "O curso já tem uma Apresentação."
        : "O curso já tem um Encerramento.",
    );
    this.kind = kind;
  }
}

async function assertFrameFree(
  database: Database,
  courseId: string,
  kind: string,
  exceptId: string | null,
): Promise<void> {
  if (kind !== "intro" && kind !== "outro") return;
  const [taken] = await database
    .select({ id: tutorials.id })
    .from(tutorials)
    .where(
      and(
        eq(tutorials.courseId, courseId),
        eq(tutorials.kind, kind),
        exceptId ? sql`${tutorials.id} <> ${exceptId}` : undefined,
      ),
    )
    .limit(1);
  if (taken) throw new FrameTakenError(kind);
}

/**
 * What a video of this course may carry. A sequential course is watched in
 * order, from its own page: a screen to teach ("Como usar esta tela") and
 * the panel's trail make no sense there, so they are dropped whatever the
 * form sent.
 */
async function framedInput(
  database: Database,
  input: TutorialFormInput,
): Promise<TutorialFormInput> {
  const [course] = await database
    .select({ sequential: courses.sequential })
    .from(courses)
    .where(eq(courses.id, input.courseId));
  return course?.sequential ? { ...input, route: null, trail: false } : input;
}

/** The course's highest position plus one: a new video, or one moved in
 * from another course, goes to the end. */
async function nextPosition(
  database: Database,
  courseId: string,
): Promise<number> {
  const [last] = await database
    .select({ position: tutorials.position })
    .from(tutorials)
    .where(eq(tutorials.courseId, courseId))
    .orderBy(desc(tutorials.position))
    .limit(1);
  return (last?.position ?? 0) + 1;
}

export async function createTutorialWith(
  database: Database,
  id: string,
  input: TutorialFormInput,
  files: TutorialFiles,
  actorId: string,
): Promise<TutorialRow> {
  input = await framedInput(database, input);
  await assertFrameFree(database, input.courseId, input.kind, null);
  const position = await nextPosition(database, input.courseId);
  const [row] = await database
    .insert(tutorials)
    .values({
      id,
      title: input.title,
      description: input.description,
      durationSeconds: input.durationSeconds,
      videoPath: files.videoUrl,
      captionsPath: files.captionsUrl,
      posterPath: files.posterUrl,
      route: input.route,
      trail: input.trail,
      courseId: input.courseId,
      kind: input.kind,
      position,
      createdBy: actorId,
    })
    .returning();
  await audit(database, "tutorial.create", id, actorId);
  return row;
}

export async function createTutorial(
  id: string,
  input: TutorialFormInput,
  files: TutorialFiles,
  actorId: string,
): Promise<TutorialRow> {
  return createTutorialWith(db, id, input, files, actorId);
}

export interface UpdateResult {
  row: TutorialRow;
  /** Stored files the row no longer points at, for the caller to delete. */
  orphaned: string[];
}

/**
 * Edits the description of a video and, when a new file came along, swaps
 * it in. `files` fields left undefined keep what is stored; `captionsUrl:
 * null` removes the captions and `posterUrl: null` the cover. The replaced files come back as `orphaned`.
 */
export async function updateTutorialWith(
  database: Database,
  id: string,
  input: TutorialFormInput,
  files: Partial<TutorialFiles>,
  actorId: string,
): Promise<UpdateResult | undefined> {
  const current = await getTutorialWith(database, id);
  if (!current) return undefined;
  input = await framedInput(database, input);
  await assertFrameFree(database, input.courseId, input.kind, id);
  // Moved to another course: to the end of that one.
  const moved = input.courseId !== current.courseId;
  const [row] = await database
    .update(tutorials)
    .set({
      title: input.title,
      description: input.description,
      durationSeconds: input.durationSeconds,
      route: input.route,
      trail: input.trail,
      courseId: input.courseId,
      kind: input.kind,
      ...(moved
        ? { position: await nextPosition(database, input.courseId) }
        : {}),
      ...(files.videoUrl !== undefined ? { videoPath: files.videoUrl } : {}),
      ...(files.captionsUrl !== undefined
        ? { captionsPath: files.captionsUrl }
        : {}),
      ...(files.posterUrl !== undefined ? { posterPath: files.posterUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tutorials.id, id))
    .returning();
  await audit(database, "tutorial.update", id, actorId);
  const orphaned: string[] = [];
  if (files.videoUrl !== undefined && files.videoUrl !== current.videoPath) {
    orphaned.push(current.videoPath);
  }
  if (
    files.captionsUrl !== undefined &&
    current.captionsPath &&
    files.captionsUrl !== current.captionsPath
  ) {
    orphaned.push(current.captionsPath);
  }
  if (
    files.posterUrl !== undefined &&
    current.posterPath &&
    files.posterUrl !== current.posterPath
  ) {
    orphaned.push(current.posterPath);
  }
  return { row, orphaned };
}

export async function updateTutorial(
  id: string,
  input: TutorialFormInput,
  files: Partial<TutorialFiles>,
  actorId: string,
): Promise<UpdateResult | undefined> {
  return updateTutorialWith(db, id, input, files, actorId);
}

/** Publishing puts the video in front of every office at once; unpublishing
 * takes it back without touching the row or anyone's progress. */
export async function setTutorialPublishedWith(
  database: Database,
  id: string,
  published: boolean,
  actorId: string,
): Promise<boolean> {
  const rows = await database
    .update(tutorials)
    .set({ publishedAt: published ? new Date() : null, updatedAt: new Date() })
    .where(eq(tutorials.id, id))
    .returning({ id: tutorials.id });
  if (rows.length === 0) return false;
  await audit(
    database,
    published ? "tutorial.publish" : "tutorial.unpublish",
    id,
    actorId,
  );
  return true;
}

export async function setTutorialPublished(
  id: string,
  published: boolean,
  actorId: string,
): Promise<boolean> {
  return setTutorialPublishedWith(db, id, published, actorId);
}

/**
 * Swaps positions with the neighbour above or below. At the top or bottom
 * there is no neighbour and nothing happens. Two statements rather than a
 * transaction: positions are only ever changed by this function, from one
 * account, and a crash between them leaves two rows sharing a value, which
 * the next move repairs and the list tolerates (ordered by position, then
 * insertion).
 */
export async function moveTutorialWith(
  database: Database,
  id: string,
  direction: "up" | "down",
  actorId: string,
): Promise<boolean> {
  const current = await getTutorialWith(database, id);
  if (!current) return false;
  // The neighbour in the same course: other courses keep their order.
  const [neighbour] = await database
    .select({ id: tutorials.id, position: tutorials.position })
    .from(tutorials)
    .where(
      and(
        eq(tutorials.courseId, current.courseId),
        direction === "up"
          ? sql`${tutorials.position} < ${current.position}`
          : sql`${tutorials.position} > ${current.position}`,
      ),
    )
    .orderBy(
      direction === "up" ? desc(tutorials.position) : asc(tutorials.position),
    )
    .limit(1);
  if (!neighbour) return false;
  await database
    .update(tutorials)
    .set({ position: neighbour.position })
    .where(eq(tutorials.id, current.id));
  await database
    .update(tutorials)
    .set({ position: current.position })
    .where(eq(tutorials.id, neighbour.id));
  await audit(database, "tutorial.move", id, actorId);
  return true;
}

export async function moveTutorial(
  id: string,
  direction: "up" | "down",
  actorId: string,
): Promise<boolean> {
  return moveTutorialWith(db, id, direction, actorId);
}

/** The row goes, the progress of everyone in it goes with it (cascade).
 * Returns the stored files for the caller to delete, or null when there
 * was no such row. */
export async function deleteTutorialWith(
  database: Database,
  id: string,
  actorId: string,
): Promise<string[] | null> {
  const current = await getTutorialWith(database, id);
  if (!current) return null;
  await database.delete(tutorials).where(eq(tutorials.id, id));
  // Written out rather than through `audit()` above: the deletion and its
  // trail stay in one function, where check:destructive can see them.
  await recordAuditWith(database, {
    tenantSlug: SUPERADMIN_TENANT_SLUG,
    actorId,
    action: "tutorial.delete",
    targetType: "tutorial",
    targetId: id,
  });
  return [current.videoPath, current.captionsPath, current.posterPath].filter(
    (path): path is string => path !== null,
  );
}

export async function deleteTutorial(
  id: string,
  actorId: string,
): Promise<string[] | null> {
  return deleteTutorialWith(db, id, actorId);
}

/** The ids of every video this person has finished, for the catalog
 * functions in src/core/tutorials/progress.ts. */
export async function listWatchedIdsWith(
  database: Database,
  userId: string,
): Promise<Set<string>> {
  const rows = await database
    .select({ videoId: tutorialProgress.videoId })
    .from(tutorialProgress)
    .where(eq(tutorialProgress.userId, userId));
  return new Set(rows.map((r) => r.videoId));
}

export async function listWatchedIds(userId: string): Promise<Set<string>> {
  return listWatchedIdsWith(db, userId);
}

/** The same, with when each was first finished: "Continue de onde parou"
 * picks up in the course the person last finished something in. */
export async function listWatchedAtWith(
  database: Database,
  userId: string,
): Promise<Map<string, Date>> {
  const rows = await database
    .select({
      videoId: tutorialProgress.videoId,
      watchedAt: tutorialProgress.watchedAt,
    })
    .from(tutorialProgress)
    .where(eq(tutorialProgress.userId, userId));
  return new Map(rows.map((r) => [r.videoId, r.watchedAt]));
}

export async function listWatchedAt(
  userId: string,
): Promise<Map<string, Date>> {
  return listWatchedAtWith(db, userId);
}

/** A video's course, when the video is in front of offices (published, in
 * a published course): what the mark and unmark rules need. */
async function visibleCourseOf(
  database: Database,
  videoId: string,
): Promise<{ courseId: string; sequential: boolean } | undefined> {
  const [row] = await database
    .select({ courseId: courses.id, sequential: courses.sequential })
    .from(tutorials)
    .innerJoin(courses, eq(courses.id, tutorials.courseId))
    .where(and(eq(tutorials.id, videoId), visible));
  return row;
}

/**
 * Records that the video reached its end (or was marked by hand). Marking a
 * video already watched does nothing: `watched_at` is the first time, and
 * the player fires this on every `ended`, replays included. Only a
 * published video can be marked: a draft is not in front of anyone, so a
 * mark on it is a forged id. Returns whether the id was accepted.
 */
export async function markWatchedWith(
  database: Database,
  userId: string,
  videoId: string,
): Promise<boolean> {
  const course = await visibleCourseOf(database, videoId);
  if (!course) return false;
  // In a sequential course, only what is open counts: the same rule the
  // page draws the locks with, so a forged id cannot skip ahead.
  if (course.sequential) {
    const rows = await database
      .select({ tutorial: tutorials })
      .from(tutorials)
      .innerJoin(courses, eq(courses.id, tutorials.courseId))
      .where(and(visible, eq(tutorials.courseId, course.courseId)))
      .orderBy(asc(tutorials.position));
    const ordered = courseOrder(rows.map((r) => toTutorial(r.tutorial)));
    const watched = await listWatchedIdsWith(database, userId);
    if (!unlockedIds(ordered, watched).has(videoId)) return false;
  }
  await database
    .insert(tutorialProgress)
    .values({ userId, videoId })
    .onConflictDoNothing();
  return true;
}

export async function markWatched(
  userId: string,
  videoId: string,
): Promise<boolean> {
  return markWatchedWith(db, userId, videoId);
}

/**
 * "Desfazer" on a tick. The one deletion here that is the person's own,
 * so its trail goes under their office, like everything else an office
 * user does: the platform slug is for the platform account only.
 */
export async function unmarkWatchedWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  videoId: string,
): Promise<boolean> {
  // A lesson of a sequential course counts only by being watched to the
  // end, and undoing it would lock everything after it: no "Desfazer".
  const [course] = await database
    .select({ sequential: courses.sequential })
    .from(tutorials)
    .innerJoin(courses, eq(courses.id, tutorials.courseId))
    .where(eq(tutorials.id, videoId));
  if (course?.sequential) return false;
  await database
    .delete(tutorialProgress)
    .where(
      and(
        eq(tutorialProgress.userId, userId),
        eq(tutorialProgress.videoId, videoId),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "tutorial-progress.unmark",
    targetType: "tutorial",
    targetId: videoId,
  });
  return true;
}

export async function unmarkWatched(
  tenantSlug: string,
  userId: string,
  videoId: string,
): Promise<boolean> {
  return unmarkWatchedWith(db, tenantSlug, userId, videoId);
}
