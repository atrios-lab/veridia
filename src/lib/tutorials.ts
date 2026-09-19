import "server-only";
import { and, eq } from "drizzle-orm";
import { type Database, db } from "@/db/index.ts";
import { tutorialProgress } from "@/db/schema.ts";

// A person's progress through the video tutorials. Keyed by user, never by
// office (see the table's comment in src/db/schema.ts): every caller passes
// the session's own user id, which is what makes one clerk's progress
// invisible to the next one on the same counter.

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
 * the player fires this on every `ended`, replays included.
 */
export async function markWatchedWith(
  database: Database,
  userId: string,
  videoId: string,
): Promise<void> {
  await database
    .insert(tutorialProgress)
    .values({ userId, videoId })
    .onConflictDoNothing();
}

export async function markWatched(
  userId: string,
  videoId: string,
): Promise<void> {
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
