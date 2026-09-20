import "server-only";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { SUPERADMIN_TENANT_SLUG } from "@/core/auth/roles.ts";
import type { Tutorial } from "@/core/tutorials/catalog.ts";
import type { TutorialFormInput } from "@/core/tutorials/video.ts";
import { type Database, db } from "@/db/index.ts";
import { tutorialProgress, tutorials } from "@/db/schema.ts";
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
    route: row.route,
    trail: row.trail,
  };
}

/** What every office sees: published rows, in trail order. */
export async function listPublishedTutorialsWith(
  database: Database,
): Promise<Tutorial[]> {
  const rows = await database
    .select()
    .from(tutorials)
    .where(isNotNull(tutorials.publishedAt))
    .orderBy(asc(tutorials.position));
  return rows.map(toTutorial);
}

export async function listPublishedTutorials(): Promise<Tutorial[]> {
  return listPublishedTutorialsWith(db);
}

/** Every row, drafts included, for the management screen only. */
export async function listAllTutorialsWith(
  database: Database,
): Promise<TutorialRow[]> {
  return database.select().from(tutorials).orderBy(asc(tutorials.position));
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
    .where(isNotNull(tutorials.publishedAt));
  return row?.n ?? 0;
}

export async function publishedTutorialCount(): Promise<number> {
  return publishedTutorialCountWith(db);
}

export interface TutorialFiles {
  videoUrl: string;
  captionsUrl: string | null;
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
export async function createTutorialWith(
  database: Database,
  id: string,
  input: TutorialFormInput,
  files: TutorialFiles,
  actorId: string,
): Promise<TutorialRow> {
  const [last] = await database
    .select({ position: tutorials.position })
    .from(tutorials)
    .orderBy(desc(tutorials.position))
    .limit(1);
  const [row] = await database
    .insert(tutorials)
    .values({
      id,
      title: input.title,
      description: input.description,
      durationSeconds: input.durationSeconds,
      videoPath: files.videoUrl,
      captionsPath: files.captionsUrl,
      route: input.route,
      trail: input.trail,
      position: (last?.position ?? 0) + 1,
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
 * null` removes the captions. The replaced files come back as `orphaned`.
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
  const [row] = await database
    .update(tutorials)
    .set({
      title: input.title,
      description: input.description,
      durationSeconds: input.durationSeconds,
      route: input.route,
      trail: input.trail,
      ...(files.videoUrl !== undefined ? { videoPath: files.videoUrl } : {}),
      ...(files.captionsUrl !== undefined
        ? { captionsPath: files.captionsUrl }
        : {}),
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
  const [neighbour] = await database
    .select({ id: tutorials.id, position: tutorials.position })
    .from(tutorials)
    .where(
      direction === "up"
        ? sql`${tutorials.position} < ${current.position}`
        : sql`${tutorials.position} > ${current.position}`,
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
  await audit(database, "tutorial.delete", id, actorId);
  return [current.videoPath, current.captionsPath].filter(
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
  const [video] = await database
    .select({ id: tutorials.id })
    .from(tutorials)
    .where(and(eq(tutorials.id, videoId), isNotNull(tutorials.publishedAt)));
  if (!video) return false;
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

export async function unmarkWatchedWith(
  database: Database,
  userId: string,
  videoId: string,
): Promise<void> {
  await database
    .delete(tutorialProgress)
    .where(
      and(
        eq(tutorialProgress.userId, userId),
        eq(tutorialProgress.videoId, videoId),
      ),
    );
}

export async function unmarkWatched(
  userId: string,
  videoId: string,
): Promise<void> {
  return unmarkWatchedWith(db, userId, videoId);
}
