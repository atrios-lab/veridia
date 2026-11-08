import Link from "next/link";
import { type Course, courseHref } from "@/core/tutorials/catalog.ts";
import type { CourseProgress } from "@/core/tutorials/course.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { TutorialCover } from "./tutorial-cover.tsx";

/**
 * One course in the catalog: its cover, title, how many videos and how
 * long, and how far this person is, as a bar and as "3 de 14". The whole
 * card is the link to the course page.
 */
export function CourseCard({
  course,
  progress,
}: {
  course: Course;
  progress: CourseProgress;
}) {
  const done = progress.total > 0 && progress.watched === progress.total;
  const percent =
    progress.total === 0
      ? 0
      : Math.round((progress.watched / progress.total) * 100);
  return (
    <Link
      href={courseHref(course.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-admin-border bg-admin-card transition-colors duration-120 hover:border-admin-input-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-focus-ring"
    >
      <TutorialCover title={course.title} posterUrl={course.posterUrl}>
        {done && (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-admin-success-text shadow-sm">
            <AdminIcon name="check" className="h-3 w-3" strokeWidth={2.4} />
            Concluído
          </span>
        )}
      </TutorialCover>
      <span className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-4">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-admin-faint">
          {course.sequential ? "Curso em aulas" : "Consulta"}
        </span>
        <span className="text-[16px] leading-snug font-semibold text-admin-primary group-hover:underline">
          {course.title}
        </span>
        {course.description && (
          <span className="line-clamp-2 text-[12.5px] leading-normal text-admin-muted">
            {course.description}
          </span>
        )}
        <span className="mt-auto flex flex-col gap-1.5 pt-1">
          <span className="text-[12px] text-admin-muted">
            {progress.total} {progress.total === 1 ? "vídeo" : "vídeos"} ·{" "}
            {formatDuration(progress.durationSeconds)}
          </span>
          <span className="flex items-center gap-2.5">
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-admin-surface"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-admin-primary"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="text-[12px] font-semibold text-admin-primary tabular-nums">
              {progress.watched} de {progress.total}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
