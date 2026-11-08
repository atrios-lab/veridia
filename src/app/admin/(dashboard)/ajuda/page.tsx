import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { courseHref, type Tutorial } from "@/core/tutorials/catalog.ts";
import {
  continueWatching,
  courseOrder,
  courseProgress,
  itemLabels,
} from "@/core/tutorials/course.ts";
import { listPublishedCourses } from "@/lib/courses.ts";
import { getSession } from "@/lib/session.ts";
import { listPublishedTutorials, listWatchedAt } from "@/lib/tutorials.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { CourseCard } from "./_components/course-card.tsx";
import { TutorialCover } from "./_components/tutorial-cover.tsx";

export const metadata = { title: "Treinamento" };

/**
 * The catalog: "Continue de onde parou", then every published course that
 * has a published video, each with this person's progress. Open to every
 * panel user; the layout has already required `admin.access`.
 *
 * `?video=<id>` is the address before courses existed ("Como usar esta
 * tela" in old tabs, links already shared): a published video goes to its
 * course page; anything else lands here, revealing nothing.
 */
export default async function TrainingCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string }>;
}) {
  const session = await getSession();
  // The layout redirects before this renders; the check keeps the type.
  if (!session) return null;
  const { video } = await searchParams;
  const [courses, tutorials, watchedAt] = await Promise.all([
    listPublishedCourses(),
    listPublishedTutorials(),
    listWatchedAt(session.user.id),
  ]);

  if (video) {
    const found = tutorials.find((t) => t.id === video);
    const course = found && courses.find((c) => c.id === found.courseId);
    if (found && course) permanentRedirect(courseHref(course.slug, found.id));
  }

  const itemsByCourse = new Map<string, Tutorial[]>();
  for (const course of courses) {
    const items = courseOrder(
      tutorials.filter((t) => t.courseId === course.id),
    );
    if (items.length > 0) itemsByCourse.set(course.id, items);
  }
  const shown = courses.filter((c) => itemsByCourse.has(c.id));
  const watchedIds = new Set(watchedAt.keys());
  const resume = continueWatching(shown, itemsByCourse, watchedAt);
  const resumeLabel = resume
    ? itemLabels(itemsByCourse.get(resume.course.id) ?? []).get(resume.item.id)
    : undefined;
  const canManage = can(session.user.role ?? "", "tutorials.manage");

  return (
    <>
      <AdminPageHeader
        title="Treinamento"
        description="Cursos em vídeo: como usar cada tela do painel e o que a equipe precisa saber no dia a dia."
        actions={
          canManage ? (
            <Link
              href="/admin/ajuda/gerenciar"
              className="btn btn-admin-secondary btn-md"
            >
              Gerenciar vídeos
            </Link>
          ) : undefined
        }
      />
      <main className="flex min-w-0 flex-col gap-8 px-[30px] py-7">
        {shown.length === 0 ? (
          <div className="rounded-[14px] border border-admin-border bg-admin-card px-6 py-10 text-center">
            <p className="font-serif text-[18px] font-semibold text-admin-primary">
              Os vídeos de treinamento estão sendo preparados
            </p>
            <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-normal text-admin-muted">
              Assim que o primeiro estiver pronto, ele aparece aqui e na Visão
              geral, sem precisar fazer nada.
            </p>
          </div>
        ) : (
          <>
            {resume && (
              <section
                aria-labelledby="continue-title"
                className="grid grid-cols-1 overflow-hidden rounded-[16px] border border-admin-border bg-admin-card md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
              >
                <TutorialCover
                  title={resume.item.title}
                  posterUrl={resume.item.posterUrl ?? resume.course.posterUrl}
                />
                <div className="flex flex-col justify-center gap-2.5 p-6 lg:p-8">
                  <span className="self-start rounded-full bg-admin-primary px-3 py-1 text-[11.5px] font-bold text-white">
                    {watchedIds.size === 0
                      ? "Comece por aqui"
                      : "Continue de onde parou"}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
                    {resume.course.title}
                    {resumeLabel && ` · ${resumeLabel}`}
                  </span>
                  <h2
                    id="continue-title"
                    className="font-serif text-[22px] leading-tight font-semibold text-admin-primary"
                  >
                    {resume.item.title}
                  </h2>
                  {resume.item.description && (
                    <p className="text-[13.5px] leading-normal text-admin-muted">
                      {resume.item.description}
                    </p>
                  )}
                  <div className="pt-1">
                    <Link
                      href={courseHref(resume.course.slug, resume.item.id)}
                      className="btn btn-admin-primary btn-sm"
                    >
                      Assistir
                    </Link>
                  </div>
                </div>
              </section>
            )}

            <section
              aria-labelledby="courses-title"
              className="flex flex-col gap-3"
            >
              <h2
                id="courses-title"
                className="font-serif text-[18px] leading-tight font-semibold text-admin-primary"
              >
                Cursos
              </h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((course) => (
                  <li key={course.id}>
                    <CourseCard
                      course={course}
                      progress={courseProgress(
                        itemsByCourse.get(course.id) ?? [],
                        watchedIds,
                      )}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
