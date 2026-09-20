import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type { TutorialFormInput } from "@/core/tutorials/video.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, tutorialProgress } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createTutorialWith,
  deleteTutorialWith,
  listAllTutorialsWith,
  listPublishedTutorialsWith,
  listWatchedIdsWith,
  markWatchedWith,
  moveTutorialWith,
  publishedTutorialCountWith,
  setTutorialPublishedWith,
  unmarkWatchedWith,
  updateTutorialWith,
} from "@/lib/tutorials.ts";

// The platform's catalog and each person's progress, against Postgres in
// process: draft vs. published, order, what deleting takes along, what
// unpublishing leaves alone, and where the audit trail lands. The user
// rows are the minimum Better Auth's schema requires; nothing signs in.

let db: Database;
let close: () => Promise<void>;

const ATRIOS = "user-atrios";
const ANA = "user-ana";
const BETO = "user-beto";

const INPUT: TutorialFormInput = {
  title: "Primeiros passos",
  description: "Login, menu e troca de senha.",
  durationSeconds: 245,
  route: null,
  trail: true,
};

function files(id: string) {
  return {
    videoUrl: `https://store.example.test/treinamento/${id}.mp4`,
    captionsUrl: `https://store.example.test/treinamento/${id}.vtt`,
  };
}

async function create(overrides: Partial<TutorialFormInput> = {}) {
  const id = randomUUID();
  return createTutorialWith(
    db,
    id,
    { ...INPUT, ...overrides },
    files(id),
    ATRIOS,
  );
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
    { id: ANA, name: "Ana", email: "ana@exemplo.com", tenantSlug: "marinho" },
    { id: BETO, name: "Beto", email: "beto@exemplo.com", tenantSlug: "aurora" },
  ]);
});

after(async () => {
  await close();
});

test("a new video is a draft at the end of the list, invisible to offices", async () => {
  const first = await create({ title: "Um" });
  const second = await create({ title: "Dois" });
  assert.equal(first.position + 1, second.position);
  assert.equal(first.publishedAt, null);
  assert.deepEqual(await listPublishedTutorialsWith(db), []);
  assert.equal(await publishedTutorialCountWith(db), 0);
  assert.equal((await listAllTutorialsWith(db)).length, 2);
});

test("publishing puts it in front of every office; the audit goes to the platform", async () => {
  const [row] = await listAllTutorialsWith(db);
  assert.ok(await setTutorialPublishedWith(db, row.id, true, ATRIOS));
  const published = await listPublishedTutorialsWith(db);
  assert.deepEqual(
    published.map((t) => t.id),
    [row.id],
  );
  assert.equal(published[0].captionsUrl, files(row.id).captionsUrl);
  assert.equal(await publishedTutorialCountWith(db), 1);

  const trail = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, "tutorial.publish"));
  assert.equal(trail.length, 1);
  assert.equal(trail[0].tenantSlug, "atrios");
  assert.equal(trail[0].targetId, row.id);
});

test("moving swaps positions with the neighbour; the ends stay put", async () => {
  const [um, dois] = await listAllTutorialsWith(db);
  assert.ok(await moveTutorialWith(db, dois.id, "up", ATRIOS));
  assert.deepEqual(
    (await listAllTutorialsWith(db)).map((t) => t.title),
    ["Dois", "Um"],
  );
  assert.equal(await moveTutorialWith(db, dois.id, "up", ATRIOS), false);
  assert.equal(await moveTutorialWith(db, um.id, "down", ATRIOS), false);
  assert.ok(await moveTutorialWith(db, um.id, "up", ATRIOS));
  assert.deepEqual(
    (await listAllTutorialsWith(db)).map((t) => t.title),
    ["Um", "Dois"],
  );
});

test("only a published video can be marked watched", async () => {
  const [um, dois] = await listAllTutorialsWith(db);
  assert.ok(um.publishedAt);
  assert.equal(dois.publishedAt, null);
  assert.ok(await markWatchedWith(db, ANA, um.id));
  assert.equal(await markWatchedWith(db, ANA, dois.id), false);
  assert.equal(await markWatchedWith(db, ANA, randomUUID()), false);
  assert.deepEqual([...(await listWatchedIdsWith(db, ANA))], [um.id]);
  assert.deepEqual([...(await listWatchedIdsWith(db, BETO))], []);
});

test("marking twice keeps the first watched_at; unmarking removes the row", async () => {
  const [um] = await listAllTutorialsWith(db);
  const [before] = await db
    .select()
    .from(tutorialProgress)
    .where(eq(tutorialProgress.userId, ANA));
  await db
    .update(tutorialProgress)
    .set({ watchedAt: new Date(before.watchedAt.getTime() - 60_000) })
    .where(eq(tutorialProgress.userId, ANA));
  const [backdated] = await db
    .select()
    .from(tutorialProgress)
    .where(eq(tutorialProgress.userId, ANA));
  await markWatchedWith(db, ANA, um.id);
  const [after] = await db
    .select()
    .from(tutorialProgress)
    .where(eq(tutorialProgress.userId, ANA));
  assert.equal(after.watchedAt.getTime(), backdated.watchedAt.getTime());

  await unmarkWatchedWith(db, ANA, um.id);
  assert.equal((await listWatchedIdsWith(db, ANA)).size, 0);
  await markWatchedWith(db, ANA, um.id);
});

test("unpublishing keeps the progress; publishing again brings it back", async () => {
  const [um] = await listAllTutorialsWith(db);
  await setTutorialPublishedWith(db, um.id, false, ATRIOS);
  assert.deepEqual(await listPublishedTutorialsWith(db), []);
  assert.deepEqual([...(await listWatchedIdsWith(db, ANA))], [um.id]);
  await setTutorialPublishedWith(db, um.id, true, ATRIOS);
  assert.equal((await listPublishedTutorialsWith(db)).length, 1);
});

test("updating with a new file reports the old one as orphaned", async () => {
  const [um] = await listAllTutorialsWith(db);
  const newVideo = `https://store.example.test/treinamento/${randomUUID()}.mp4`;
  const result = await updateTutorialWith(
    db,
    um.id,
    { ...INPUT, title: "Um, editado", route: "/admin/pedidos" },
    { videoUrl: newVideo, captionsUrl: null },
    ATRIOS,
  );
  assert.ok(result);
  assert.equal(result.row.title, "Um, editado");
  assert.equal(result.row.route, "/admin/pedidos");
  assert.equal(result.row.videoPath, newVideo);
  assert.equal(result.row.captionsPath, null);
  assert.deepEqual(result.orphaned, [
    files(um.id).videoUrl,
    files(um.id).captionsUrl,
  ]);

  const kept = await updateTutorialWith(db, um.id, INPUT, {}, ATRIOS);
  assert.deepEqual(kept?.orphaned, []);
  assert.equal(kept?.row.videoPath, newVideo);
  assert.equal(
    await updateTutorialWith(db, randomUUID(), INPUT, {}, ATRIOS),
    undefined,
  );
});

test("deleting takes the progress along and hands back the files", async () => {
  const [um] = await listAllTutorialsWith(db);
  await markWatchedWith(db, BETO, um.id);
  assert.equal((await listWatchedIdsWith(db, BETO)).size, 1);
  const orphaned = await deleteTutorialWith(db, um.id, ATRIOS);
  assert.deepEqual(orphaned, [um.videoPath]);
  assert.equal((await listWatchedIdsWith(db, ANA)).size, 0);
  assert.equal((await listWatchedIdsWith(db, BETO)).size, 0);
  assert.equal((await listAllTutorialsWith(db)).length, 1);
  assert.equal(await deleteTutorialWith(db, um.id, ATRIOS), null);
});

test("deleting the account takes its progress along", async () => {
  const [dois] = await listAllTutorialsWith(db);
  await setTutorialPublishedWith(db, dois.id, true, ATRIOS);
  await markWatchedWith(db, BETO, dois.id);
  await db.delete(user).where(eq(user.id, BETO));
  assert.equal((await listWatchedIdsWith(db, BETO)).size, 0);
});
