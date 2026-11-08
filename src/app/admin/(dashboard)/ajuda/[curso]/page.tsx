import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { courseProgress } from "@/core/tutorials/course.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { getCourse, getPublishedCourseBySlug } from "@/lib/courses.ts";
import { assessmentState } from "@/lib/quiz.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { listPublishedTutorials, listWatchedIds } from "@/lib/tutorials.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import {
  AssessmentPanel,
  type PanelState,
} from "../_components/assessment-panel.tsx";
import { ReferenceCourse } from "../_components/reference-course.tsx";
import { SequentialCourse } from "../_components/sequential-course.tsx";

type Params = Promise<{ curso: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { curso } = await params;
  const course = await getPublishedCourseBySlug(curso);
  return { title: course ? course.title : "Treinamento" };
}

/**
 * One course: the vitrine for a reference course, the numbered list with
 * locks for a sequential one. A draft course, an unknown address or one
 * with nothing published is a 404, the same answer for all three, so the
 * page never tells a draft apart from nothing.
 */
export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ video?: string }>;
}) {
  const session = await getSession();
  // The layout redirects before this renders; the check keeps the type.
  if (!session) return null;
  const [{ curso }, { video }] = await Promise.all([params, searchParams]);
  const course = await getPublishedCourseBySlug(curso);
  if (!course) notFound();
  const [all, watchedIds] = await Promise.all([
    listPublishedTutorials(),
    listWatchedIds(session.user.id),
  ]);
  const tutorials = all.filter((t) => t.courseId === course.id);
  if (tutorials.length === 0) notFound();
  const progress = courseProgress(tutorials, watchedIds);
  const [assessment, settings, tenant] = await Promise.all([
    assessmentState(session.user.id, course.id),
    getCourse(course.id),
    getTenant(),
  ]);
  const panelState: PanelState | null =
    assessment.kind === "none"
      ? null
      : assessment.kind === "certified"
        ? { ...assessment, issuedAt: assessment.issuedAt.toISOString() }
        : assessment;
  const percent = Math.round((progress.watched / progress.total) * 100);

  return (
    <>
      <AdminPageHeader
        title={course.title}
        back={{ href: "/admin/ajuda", label: "Treinamento" }}
        description={course.description || undefined}
        actions={
          course.materialUrl ? (
            <a
              href={course.materialUrl}
              target="_blank"
              rel="noopener"
              className="btn btn-admin-secondary btn-md"
            >
              <AdminIcon name="file" className="h-4 w-4" />
              Apostila (PDF)
            </a>
          ) : undefined
        }
      />
      <main className="flex min-w-0 flex-col gap-7 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[13px] text-admin-muted">
            {progress.total} {progress.total === 1 ? "vídeo" : "vídeos"} ·{" "}
            {formatDuration(progress.durationSeconds)}
          </span>
          <span className="flex min-w-[220px] flex-1 items-center gap-2.5 sm:max-w-[360px]">
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-admin-surface"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-admin-primary"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="text-[13px] font-semibold text-admin-primary tabular-nums">
              {progress.watched} de {progress.total} assistidos
            </span>
          </span>
        </div>
        {course.sequential ? (
          <SequentialCourse
            course={course}
            tutorials={tutorials}
            watchedIds={watchedIds}
            requestedId={video}
          />
        ) : (
          <ReferenceCourse
            course={course}
            tutorials={tutorials}
            watchedIds={watchedIds}
            requestedId={video}
          />
        )}
        {panelState && settings?.workloadHours && (
          <AssessmentPanel
            courseId={course.id}
            courseSlug={course.slug}
            courseTitle={course.title}
            passingScore={settings.passingScore}
            retryHours={settings.retryHours}
            workloadHours={settings.workloadHours}
            tenantName={tenant.name}
            accountName={session.user.name ?? ""}
            state={panelState}
          />
        )}
      </main>
    </>
  );
}
