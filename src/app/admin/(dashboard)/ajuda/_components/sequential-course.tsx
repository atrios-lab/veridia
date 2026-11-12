import Link from "next/link";
import {
  type Course,
  courseHref,
  type Tutorial,
} from "@/core/tutorials/catalog.ts";
import {
  courseOrder,
  currentItem,
  itemLabels,
  nextItem,
  unlockedIds,
} from "@/core/tutorials/course.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { cn } from "../../../_ui/cn.ts";
import { CourseMaterial } from "./course-material.tsx";
import { TutorialPlayer } from "./tutorial-player.tsx";

/**
 * A sequential course (LGPD): the player, and beside it the whole course in
 * order, numbered, each line watched, open or locked. A locked line is not
 * a link and says what opens it. Rendered on the server: what is open comes
 * from the person's rows through `unlockedIds`, the same rule the server
 * action enforces when a video is marked.
 */
export function SequentialCourse({
  course,
  tutorials,
  watchedIds,
  requestedId,
}: {
  course: Course;
  /** The course's published videos, by position. */
  tutorials: readonly Tutorial[];
  watchedIds: ReadonlySet<string>;
  requestedId: string | undefined;
}) {
  const ordered = courseOrder(tutorials);
  const labels = itemLabels(ordered);
  const open = unlockedIds(ordered, watchedIds);
  const current = currentItem(course, ordered, watchedIds, requestedId);
  if (!current) return null;

  const lessons = ordered.filter((t) => t.kind === "lesson").length;
  const currentLabel = labels.get(current.id) ?? "";
  const following = nextItem(ordered, current.id);
  // What a locked line waits for: the first video not yet watched.
  const blocker = ordered.find((t) => !watchedIds.has(t.id));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <TutorialPlayer
          key={current.id}
          tutorial={current}
          watched={watchedIds.has(current.id)}
          screenLabel={null}
          sequential
          label={
            current.kind === "lesson"
              ? `${currentLabel} de ${lessons}`
              : currentLabel
          }
          next={
            following
              ? {
                  href: courseHref(course.slug, following.id),
                  label:
                    following.kind === "lesson" ? "Próxima aula" : "Continuar",
                }
              : null
          }
        />
        {course.materialUrl && <CourseMaterial courseSlug={course.slug} />}
      </div>

      <nav
        aria-label={`Conteúdo de ${course.title}`}
        className="rounded-xl border bg-card p-3"
      >
        <span className="block px-3 pt-2 pb-2.5 text-xs font-medium text-muted-foreground">
          Conteúdo
        </span>
        <ol className="flex flex-col gap-1">
          {ordered.map((item) => {
            const watched = watchedIds.has(item.id);
            const isOpen = open.has(item.id);
            const isCurrent = item.id === current.id;
            const label = labels.get(item.id) ?? "";
            const body = (
              <>
                <span
                  aria-hidden="true"
                  className={
                    watched
                      ? "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-success text-success-foreground"
                      : isOpen
                        ? "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-input text-muted-foreground"
                  }
                >
                  <AdminIcon
                    name={watched ? "check" : isOpen ? "play" : "lock"}
                    className="h-3.5 w-3.5"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-muted-foreground">
                    {label}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-sm font-semibold",
                      isOpen ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDuration(item.durationSeconds)}
                    {!isOpen &&
                      blocker &&
                      ` · abre depois de ${labels.get(blocker.id)}`}
                  </span>
                </span>
                <span className="sr-only">
                  {watched ? "(assistido)" : isOpen ? "" : "(bloqueado)"}
                </span>
              </>
            );
            const base =
              "flex items-center gap-3 rounded-lg border px-3 py-2.5";
            return (
              <li key={item.id}>
                {isOpen ? (
                  <Link
                    href={courseHref(course.slug, item.id)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={
                      isCurrent
                        ? `${base} border-border bg-muted`
                        : `${base} border-transparent hover:bg-muted`
                    }
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    aria-disabled="true"
                    className={`${base} border-transparent opacity-70`}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
