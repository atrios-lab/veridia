import type { Course, Tutorial } from "./catalog.ts";

// What the panel derives from a course's videos and a person's progress:
// the order, the labels, what is open in a sequential course and where to
// pick up. Pure, like progress.ts: the caller hands in the published videos
// and the ids (or dates) the person has watched.

/**
 * The order a course is watched in: the Apresentação first, the lessons in
 * the order they come in (position, from the query), the Encerramento last,
 * whatever positions the frame videos were saved with. Stable.
 */
export function courseOrder(items: readonly Tutorial[]): Tutorial[] {
  return [
    ...items.filter((t) => t.kind === "intro"),
    ...items.filter((t) => t.kind === "lesson"),
    ...items.filter((t) => t.kind === "outro"),
  ];
}

/** "Apresentação", "Aula 1"…"Aula N", "Encerramento", by id. Lessons are
 * numbered among the published ones handed in, so taking one down never
 * leaves a gap. */
export function itemLabels(items: readonly Tutorial[]): Map<string, string> {
  const labels = new Map<string, string>();
  let lesson = 0;
  for (const item of courseOrder(items)) {
    if (item.kind === "intro") labels.set(item.id, "Apresentação");
    else if (item.kind === "outro") labels.set(item.id, "Encerramento");
    else labels.set(item.id, `Aula ${++lesson}`);
  }
  return labels;
}

/**
 * What a person may open in a sequential course: every video up to and
 * including the first one not watched; all of them once all are watched.
 * The page shows the locks from this and the server action refuses a mark
 * outside it, so both read the same rule. Expects `ordered` from
 * `courseOrder`.
 */
export function unlockedIds(
  ordered: readonly Tutorial[],
  watchedIds: ReadonlySet<string>,
): Set<string> {
  const open = new Set<string>();
  for (const item of ordered) {
    open.add(item.id);
    if (!watchedIds.has(item.id)) return open;
  }
  return open;
}

/** What a person may open in a course of either kind. */
export function openIds(
  course: Pick<Course, "sequential">,
  ordered: readonly Tutorial[],
  watchedIds: ReadonlySet<string>,
): Set<string> {
  return course.sequential
    ? unlockedIds(ordered, watchedIds)
    : new Set(ordered.map((t) => t.id));
}

export interface CourseProgress {
  watched: number;
  total: number;
  durationSeconds: number;
}

export function courseProgress(
  items: readonly Tutorial[],
  watchedIds: ReadonlySet<string>,
): CourseProgress {
  return {
    watched: items.filter((t) => watchedIds.has(t.id)).length,
    total: items.length,
    durationSeconds: items.reduce((sum, t) => sum + t.durationSeconds, 0),
  };
}

/**
 * The video the course page opens: the one asked for, when it is in the
 * course and open; otherwise the first open one not yet watched; otherwise
 * (everything watched) the first. An id that is locked, a draft's or from
 * another course is treated as not asked for, never as an error.
 */
export function currentItem(
  course: Pick<Course, "sequential">,
  ordered: readonly Tutorial[],
  watchedIds: ReadonlySet<string>,
  requestedId: string | undefined,
): Tutorial | undefined {
  const open = openIds(course, ordered, watchedIds);
  const requested = requestedId
    ? ordered.find((t) => t.id === requestedId)
    : undefined;
  if (requested && open.has(requested.id)) return requested;
  return (
    ordered.find((t) => open.has(t.id) && !watchedIds.has(t.id)) ?? ordered[0]
  );
}

/** The video after this one in the course, if any. */
export function nextItem(
  ordered: readonly Tutorial[],
  id: string,
): Tutorial | undefined {
  const index = ordered.findIndex((t) => t.id === id);
  return index === -1 ? undefined : ordered[index + 1];
}

export interface ContinueAt {
  course: Course;
  item: Tutorial;
}

/**
 * "Continue de onde parou" on the catalog: the next unwatched video of the
 * course the person last finished something in; when that course is done,
 * the first unwatched video of the first course that still has one. Someone
 * who never watched anything starts at the top of the first course; someone
 * who finished everything gets nothing.
 *
 * `itemsByCourse` holds each course's published videos in `courseOrder`;
 * `watchedAt` maps a watched video's id to when it was first finished.
 */
export function continueWatching(
  courses: readonly Course[],
  itemsByCourse: ReadonlyMap<string, readonly Tutorial[]>,
  watchedAt: ReadonlyMap<string, Date>,
): ContinueAt | undefined {
  const firstUnwatched = (course: Course): ContinueAt | undefined => {
    const item = itemsByCourse
      .get(course.id)
      ?.find((t) => !watchedAt.has(t.id));
    return item ? { course, item } : undefined;
  };

  let lastCourse: Course | undefined;
  let lastDate = -Infinity;
  for (const course of courses) {
    for (const item of itemsByCourse.get(course.id) ?? []) {
      const date = watchedAt.get(item.id)?.getTime();
      if (date !== undefined && date > lastDate) {
        lastDate = date;
        lastCourse = course;
      }
    }
  }

  if (lastCourse) {
    const here = firstUnwatched(lastCourse);
    if (here) return here;
  }
  for (const course of courses) {
    const there = firstUnwatched(course);
    if (there) return there;
  }
  return undefined;
}
