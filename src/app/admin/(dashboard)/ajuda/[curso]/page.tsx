import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  certificateOfficeName,
  DEFAULT_CERTIFICATE_CHECK_BASE,
} from "@/core/courses/certificate.ts";
import { courseProgress } from "@/core/tutorials/course.ts";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { cohortOfficeName } from "@/lib/cohorts.ts";
import { getCourse, getPublishedCourseBySlug } from "@/lib/courses.ts";
import { assessmentState } from "@/lib/quiz.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { listPublishedTutorials, listWatchedIds } from "@/lib/tutorials.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { Progress } from "../../../_ui/progress.tsx";
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
  const [assessment, settings, tenant, cohortOffice] = await Promise.all([
    assessmentState(session.user.id, course.id),
    getCourse(course.id),
    getTenant(),
    cohortOfficeName(session.user.id),
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
        back={{ href: "/admin/ajuda", label: "Ajuda e treinamentos" }}
        description={course.description || undefined}
        actions={
          // A reference course has no player column of its own to sit
          // under; a sequential one shows the support PDF under the video.
          course.materialUrl && !course.sequential ? (
            <a
              href={`/admin/ajuda/${encodeURIComponent(course.slug)}/apostila`}
              target="_blank"
              rel="noopener"
              className={buttonVariants({ variant: "outline" })}
            >
              <AdminIcon name="file" className="h-4 w-4" />
              Apostila (PDF)
            </a>
          ) : undefined
        }
      />
      <main className="flex min-w-0 flex-col gap-7 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm text-muted-foreground">
            {progress.total} {progress.total === 1 ? "vídeo" : "vídeos"} ·{" "}
            {formatDuration(progress.durationSeconds)}
          </span>
          <span className="flex min-w-[220px] flex-1 items-center gap-2.5 sm:max-w-[360px]">
            <Progress value={percent} className="flex-1" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground tabular-nums">
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
            // A course learner's certificate names their cohort's office
            // (see issueCertificateWith); the preview says the same.
            tenantName={cohortOffice ?? certificateOfficeName(tenant)}
            accountName={session.user.name ?? ""}
            checkUrl={
              process.env.CERTIFICATE_CHECK_BASE_URL ||
              DEFAULT_CERTIFICATE_CHECK_BASE
            }
            state={panelState}
          />
        )}
      </main>
    </>
  );
}
