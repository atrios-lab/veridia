import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { tutorialProgress } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  listWatchedIdsWith,
  markWatchedWith,
  unmarkWatchedWith,
} from "@/lib/tutorials.ts";

// tutorial_progress against Postgres in process: what the table promises
// (first watch wins, rows go with the account) and what the lib does with
// it, in one place. The user rows are the minimum Better Auth's schema
// requires; nothing here signs anyone in.

let db: Database;
let close: () => Promise<void>;

const ANA = "user-ana";
const BETO = "user-beto";

before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values([
    { id: ANA, name: "Ana", email: "ana@exemplo.com", tenantSlug: "marinho" },
    { id: BETO, name: "Beto", email: "beto@exemplo.com", tenantSlug: "marinho" },
  ]);
});

after(async () => {
  await close();
});

async function watchedAt(userId: string, videoId: string): Promise<Date> {
  const [row] = await db
    .select()
    .from(tutorialProgress)
    .where(eq(tutorialProgress.userId, userId));
  assert.ok(row && row.videoId === videoId, "fixture: row must exist");
  return row.watchedAt;
}

test("marking twice keeps the first watched_at", async () => {
  await markWatchedWith(db, ANA, "primeiros-passos");
  const first = await watchedAt(ANA, "primeiros-passos");
  // Push the clock past the row's default before the second mark.
  await db
    .update(tutorialProgress)
    .set({ watchedAt: new Date(first.getTime() - 60_000) })
    .where(eq(tutorialProgress.userId, ANA));
  const backdated = await watchedAt(ANA, "primeiros-passos");
  await markWatchedWith(db, ANA, "primeiros-passos");
  assert.equal(
    (await watchedAt(ANA, "primeiros-passos")).getTime(),
    backdated.getTime(),
  );
});

test("one person's progress never shows up for another", async () => {
  await markWatchedWith(db, BETO, "pedidos");
  assert.deepEqual([...(await listWatchedIdsWith(db, ANA))], [
    "primeiros-passos",
  ]);
  assert.deepEqual([...(await listWatchedIdsWith(db, BETO))], ["pedidos"]);
});

test("unmarking removes the row, and only that one", async () => {
  await markWatchedWith(db, ANA, "agenda");
  await unmarkWatchedWith(db, ANA, "primeiros-passos");
  assert.deepEqual([...(await listWatchedIdsWith(db, ANA))], ["agenda"]);
  // Unmarking what was never marked is not an error.
  await unmarkWatchedWith(db, ANA, "nao-existe");
});

test("deleting the account takes its progress along", async () => {
  await db.delete(user).where(eq(user.id, BETO));
  assert.equal((await listWatchedIdsWith(db, BETO)).size, 0);
});
