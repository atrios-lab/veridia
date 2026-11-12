import Link from "next/link";
import { type Course, courseHref } from "@/core/tutorials/catalog.ts";
import type { CourseProgress } from "@/core/tutorials/course.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Progress } from "../../../_ui/progress.tsx";
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
      className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-120 hover:border-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <TutorialCover title={course.title} posterUrl={course.posterUrl}>
        {done && (
          <Badge className="absolute top-2.5 right-2.5 bg-success text-success-foreground shadow-sm">
            <AdminIcon name="check" className="h-3 w-3" strokeWidth={2.4} />
            Concluído
          </Badge>
        )}
      </TutorialCover>
      <span className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-4">
        <span className="text-xs font-medium text-muted-foreground">
          {course.sequential ? "Curso em aulas" : "Consulta"}
        </span>
        <span className="text-base leading-snug font-semibold text-foreground group-hover:underline">
          {course.title}
        </span>
        {course.description && (
          <span className="line-clamp-2 text-xs leading-normal text-muted-foreground">
            {course.description}
          </span>
        )}
        <span className="mt-auto flex flex-col gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground">
            {progress.total} {progress.total === 1 ? "vídeo" : "vídeos"} ·{" "}
            {formatDuration(progress.durationSeconds)}
          </span>
          <span className="flex items-center gap-2.5">
            <Progress value={percent} className="flex-1" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {progress.watched} de {progress.total}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
