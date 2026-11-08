import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import type {
  CourseFormInput,
  TutorialFormInput,
} from "@/core/tutorials/video.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, courses } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  createCourseWith,
  deleteCourseWith,
  getPublishedCourseBySlugWith,
  listAllCoursesWith,
  listPublishedCoursesWith,
  moveCourseWith,
  PanelCourseError,
  SlugTakenError,
  setCoursePublishedWith,
  updateCourseWith,
} from "@/lib/courses.ts";
import {
  createTutorialWith,
  deleteTutorialWith,
  FrameTakenError,
  listPanelTutorialsWith,
  listPublishedTutorialsWith,
  listWatchedAtWith,
  markWatchedWith,
  moveTutorialWith,
  publishedTutorialCountWith,
  setTutorialPublishedWith,
  unmarkWatchedWith,
  updateTutorialWith,
} from "@/lib/tutorials.ts";

// Courses against Postgres in process: the panel course the migration
// creates, a sequential course whose videos open one after the other, what
// is refused (a second Apresentação, a locked mark, undoing a lesson,
// deleting a course with videos) and what each office sees.

let db: Database;
let close: () => Promise<void>;
let panelId: string;

const ATRIOS = "user-atrios";
const ANA = "user-ana";

const LGPD: CourseFormInput = {
  title: "LGPD no cartório",
  slug: "lgpd-no-cartorio",
  description: "Doze aulas curtas.",
  sequential: true,
};

function video(
  courseId: string,
  kind: TutorialFormInput["kind"] = "lesson",
  title: string = kind,
): TutorialFormInput {
  return {
    title,
    description: "",
    durationSeconds: 120,
    route: null,
    trail: false,
    courseId,
    kind,
  };
}

async function addVideo(input: TutorialFormInput, publish = true) {
  const id = randomUUID();
  const row = await createTutorialWith(
    db,
    id,
    input,
    {
      videoUrl: `https://store.example.test/treinamento/${id}.mp4`,
      captionsUrl: null,
      posterUrl: null,
    },
    ATRIOS,
  );
  if (publish) await setTutorialPublishedWith(db, id, true, ATRIOS);
  return row;
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
  ]);
  const [panel] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, "uso-do-painel"));
  panelId = panel.id;
});

after(async () => {
  await close();
});

test("the migration leaves the panel course published, first in the catalog", async () => {
  const published = await listPublishedCoursesWith(db);
  assert.deepEqual(
    published.map((c) => [c.slug, c.sequential]),
    [["uso-do-painel", false]],
  );
});

test("a new course is a draft at the end; its address must be free", async () => {
  const row = await createCourseWith(
    db,
    LGPD,
    {
      posterUrl: null,
      materialUrl: "https://store.example.test/treinamento/a.pdf",
    },
    ATRIOS,
  );
  assert.equal(row.publishedAt, null);
  assert.equal(
    row.materialPath,
    "https://store.example.test/treinamento/a.pdf",
  );
  assert.equal(await getPublishedCourseBySlugWith(db, LGPD.slug), undefined);
  await assert.rejects(
    createCourseWith(db, LGPD, { posterUrl: null, materialUrl: null }, ATRIOS),
    SlugTakenError,
  );
  const [audit] = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, row.id));
  assert.equal(audit.tenantSlug, "atrios");
  assert.equal(audit.action, "course.create");
});

test("the panel course keeps its address and is never deleted", async () => {
  await assert.rejects(
    updateCourseWith(
      db,
      panelId,
      { title: "Painel", slug: "painel", description: "", sequential: false },
      {},
      ATRIOS,
    ),
    PanelCourseError,
  );
  assert.deepEqual(await deleteCourseWith(db, panelId, ATRIOS), {
    status: "panel",
  });
});

async function lgpdId(): Promise<string> {
  const all = await listAllCoursesWith(db);
  const found = all.find((c) => c.slug === LGPD.slug);
  assert.ok(found);
  return found.id;
}

test("a course has one Apresentação and one Encerramento at most", async () => {
  const id = await lgpdId();
  await addVideo(video(id, "intro", "Apresentação"));
  await assert.rejects(addVideo(video(id, "intro")), FrameTakenError);
  await addVideo(video(id, "outro", "Encerramento"));
  await assert.rejects(addVideo(video(id, "outro")), FrameTakenError);
});

test("videos of a draft course stay hidden until the course is published", async () => {
  const id = await lgpdId();
  await addVideo(video(id, "lesson", "Aula 1"));
  await addVideo(video(id, "lesson", "Aula 2"));
  const before = await listPublishedTutorialsWith(db);
  assert.equal(
    before.some((t) => t.courseId === id),
    false,
  );
  const countBefore = await publishedTutorialCountWith(db);
  await setCoursePublishedWith(db, id, true, ATRIOS);
  const visible = (await listPublishedTutorialsWith(db)).filter(
    (t) => t.courseId === id,
  );
  assert.equal(visible.length, 4);
  assert.equal(await publishedTutorialCountWith(db), countBefore + 4);
  assert.equal((await getPublishedCourseBySlugWith(db, LGPD.slug))?.id, id);
});

test("the panel listing never includes another course's videos", async () => {
  await addVideo({ ...video(panelId), trail: true, title: "Primeiros passos" });
  const panel = await listPanelTutorialsWith(db);
  assert.ok(panel.length > 0);
  assert.ok(panel.every((t) => t.courseId === panelId));
});

async function lgpdVideos() {
  const id = await lgpdId();
  return (await listPublishedTutorialsWith(db)).filter(
    (t) => t.courseId === id,
  );
}

test("sequence: a video opens only after the one before it", async () => {
  const items = await lgpdVideos();
  const intro = items.find((t) => t.kind === "intro");
  const lessons = items.filter((t) => t.kind === "lesson");
  const outro = items.find((t) => t.kind === "outro");
  assert.ok(intro && outro && lessons.length === 2);

  // Locked: Aula 1 before the Apresentação.
  assert.equal(await markWatchedWith(db, ANA, lessons[0].id), false);
  assert.equal(await markWatchedWith(db, ANA, intro.id), true);
  assert.equal(await markWatchedWith(db, ANA, lessons[1].id), false);
  assert.equal(await markWatchedWith(db, ANA, lessons[0].id), true);
  assert.equal(await markWatchedWith(db, ANA, lessons[1].id), true);
  // The Encerramento comes last, whatever position it was saved with.
  assert.equal(await markWatchedWith(db, ANA, outro.id), true);
  const watched = await listWatchedAtWith(db, ANA);
  assert.equal(watched.size, 4);
  assert.ok(watched.get(outro.id) instanceof Date);
});

test("a lesson of a sequential course cannot be undone; a panel video can", async () => {
  const [first] = await lgpdVideos();
  assert.equal(await unmarkWatchedWith(db, "marinho", ANA, first.id), false);
  assert.ok((await listWatchedAtWith(db, ANA)).has(first.id));

  const [panelVideo] = await listPanelTutorialsWith(db);
  assert.equal(await markWatchedWith(db, ANA, panelVideo.id), true);
  assert.equal(
    await unmarkWatchedWith(db, "marinho", ANA, panelVideo.id),
    true,
  );
});

test("moving a video swaps it with its neighbour in the same course only", async () => {
  const id = await lgpdId();
  const before = (await lgpdVideos()).filter((t) => t.kind === "lesson");
  const panelBefore = await listPanelTutorialsWith(db);
  assert.ok(await moveTutorialWith(db, before[1].id, "up", ATRIOS));
  const after = (await lgpdVideos()).filter((t) => t.kind === "lesson");
  assert.deepEqual(
    after.map((t) => t.id),
    [before[1].id, before[0].id],
  );
  assert.deepEqual(
    (await listPanelTutorialsWith(db)).map((t) => t.id),
    panelBefore.map((t) => t.id),
  );
  // Moved to another course: to the end of that one.
  const moved = await updateTutorialWith(
    db,
    after[0].id,
    { ...video(panelId), title: "Movido" },
    {},
    ATRIOS,
  );
  assert.ok(moved);
  const panelAfter = await listPanelTutorialsWith(db);
  assert.equal(panelAfter.at(-1)?.id, after[0].id);
  assert.notEqual(moved.row.courseId, id);
});

test("a course with videos is not deleted; an empty one hands back its files", async () => {
  const id = await lgpdId();
  assert.deepEqual(await deleteCourseWith(db, id, ATRIOS), {
    status: "has-videos",
  });
  for (const t of await lgpdVideos())
    await deleteTutorialWith(db, t.id, ATRIOS);
  const result = await deleteCourseWith(db, id, ATRIOS);
  assert.deepEqual(result, {
    status: "deleted",
    orphaned: ["https://store.example.test/treinamento/a.pdf"],
  });
});

test("courses swap places in the catalog", async () => {
  const a = await createCourseWith(
    db,
    { ...LGPD, slug: "curso-a", title: "A" },
    { posterUrl: null, materialUrl: null },
    ATRIOS,
  );
  assert.ok(await moveCourseWith(db, a.id, "up", ATRIOS));
  const order = (await listAllCoursesWith(db)).map((c) => c.slug);
  assert.deepEqual(order.slice(0, 2), ["curso-a", "uso-do-painel"]);
});

test("a video of a sequential course never teaches a screen nor joins the trail", async () => {
  const seq = await createCourseWith(
    db,
    { ...LGPD, slug: "curso-seq", title: "Seq" },
    { posterUrl: null, materialUrl: null },
    ATRIOS,
  );
  const row = await addVideo(
    { ...video(seq.id), route: "/admin/pedidos", trail: true },
    false,
  );
  assert.equal(row.route, null);
  assert.equal(row.trail, false);
});
