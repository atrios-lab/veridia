import assert from "node:assert/strict";
import { test } from "node:test";
import type { Course, Tutorial, TutorialKind } from "./catalog.ts";
import {
  continueWatching,
  courseOrder,
  courseProgress,
  currentItem,
  itemLabels,
  nextItem,
  openIds,
  unlockedIds,
} from "./course.ts";

function video(
  id: string,
  kind: TutorialKind = "lesson",
  courseId = "lgpd",
): Tutorial {
  return {
    id,
    title: id,
    description: "",
    durationSeconds: 100,
    videoUrl: `/v/${id}.mp4`,
    captionsUrl: null,
    posterUrl: null,
    route: null,
    trail: false,
    courseId,
    kind,
  };
}

function course(id: string, sequential: boolean): Course {
  return {
    id,
    slug: id,
    title: id,
    description: "",
    posterUrl: null,
    materialUrl: null,
    sequential,
  };
}

// As the query hands them in: by position, frame videos anywhere.
const LGPD = [
  video("a1"),
  video("fim", "outro"),
  video("a2"),
  video("abertura", "intro"),
  video("a3"),
];
const ORDERED = courseOrder(LGPD);
const IDS = ORDERED.map((t) => t.id);

test("the Apresentação comes first and the Encerramento last", () => {
  assert.deepEqual(IDS, ["abertura", "a1", "a2", "a3", "fim"]);
});

test("only lessons are numbered, from 1, without gaps", () => {
  const labels = itemLabels(LGPD);
  assert.equal(labels.get("abertura"), "Apresentação");
  assert.equal(labels.get("a1"), "Aula 1");
  assert.equal(labels.get("a3"), "Aula 3");
  assert.equal(labels.get("fim"), "Encerramento");
  // Aula 2 taken down: the rest close ranks.
  const without = itemLabels(LGPD.filter((t) => t.id !== "a2"));
  assert.equal(without.get("a3"), "Aula 2");
});

test("sequence: nothing watched opens only the first", () => {
  assert.deepEqual([...unlockedIds(ORDERED, new Set())], ["abertura"]);
});

test("sequence: each watched video opens the next one", () => {
  assert.deepEqual(
    [...unlockedIds(ORDERED, new Set(["abertura", "a1"]))],
    ["abertura", "a1", "a2"],
  );
});

test("sequence: a gap closes everything after it", () => {
  // Watched out of order (e.g. before the course became sequential).
  assert.deepEqual(
    [...unlockedIds(ORDERED, new Set(["abertura", "a2"]))],
    ["abertura", "a1"],
  );
});

test("sequence: everything watched opens everything", () => {
  assert.deepEqual([...unlockedIds(ORDERED, new Set(IDS))], IDS);
});

test("a reference course has nothing locked", () => {
  assert.deepEqual([...openIds(course("p", false), ORDERED, new Set())], IDS);
});

test("progress counts watched videos and adds up the duration", () => {
  assert.deepEqual(courseProgress(ORDERED, new Set(["a1", "x"])), {
    watched: 1,
    total: 5,
    durationSeconds: 500,
  });
});

test("current: the asked-for video when it is open", () => {
  const seq = course("lgpd", true);
  const watched = new Set(["abertura", "a1"]);
  assert.equal(currentItem(seq, ORDERED, watched, "a1")?.id, "a1");
});

test("current: a locked or foreign id falls back to the first open unwatched", () => {
  const seq = course("lgpd", true);
  const watched = new Set(["abertura"]);
  assert.equal(currentItem(seq, ORDERED, watched, "a3")?.id, "a1");
  assert.equal(currentItem(seq, ORDERED, watched, "outro-curso")?.id, "a1");
  assert.equal(currentItem(seq, ORDERED, watched, undefined)?.id, "a1");
});

test("current: everything watched opens the first", () => {
  assert.equal(
    currentItem(course("lgpd", true), ORDERED, new Set(IDS), undefined)?.id,
    "abertura",
  );
});

test("next: the following video, none after the last", () => {
  assert.equal(nextItem(ORDERED, "a1")?.id, "a2");
  assert.equal(nextItem(ORDERED, "fim"), undefined);
  assert.equal(nextItem(ORDERED, "nada"), undefined);
});

const PAINEL = [
  video("p1", "lesson", "painel"),
  video("p2", "lesson", "painel"),
];
const COURSES = [course("painel", false), course("lgpd", true)];
const BY_COURSE = new Map([
  ["painel", PAINEL],
  ["lgpd", ORDERED],
]);

test("continue: nobody watched anything starts at the first course", () => {
  const at = continueWatching(COURSES, BY_COURSE, new Map());
  assert.equal(at?.course.id, "painel");
  assert.equal(at?.item.id, "p1");
});

test("continue: the course last watched in, at its next video", () => {
  const at = continueWatching(
    COURSES,
    BY_COURSE,
    new Map([
      ["p1", new Date("2026-11-01")],
      ["abertura", new Date("2026-11-03")],
      ["a1", new Date("2026-11-04")],
    ]),
  );
  assert.equal(at?.course.id, "lgpd");
  assert.equal(at?.item.id, "a2");
});

test("continue: a finished course hands over to the next unfinished one", () => {
  const all = new Map(IDS.map((id) => [id, new Date("2026-11-05")]));
  const at = continueWatching(COURSES, BY_COURSE, all);
  assert.equal(at?.course.id, "painel");
  assert.equal(at?.item.id, "p1");
});

test("continue: everything watched, nothing to offer", () => {
  const all = new Map(
    [...IDS, "p1", "p2"].map((id) => [id, new Date("2026-11-05")]),
  );
  assert.equal(continueWatching(COURSES, BY_COURSE, all), undefined);
});
