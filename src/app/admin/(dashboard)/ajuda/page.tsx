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
import { getTenant } from "@/lib/tenant.ts";
import { listPublishedTutorials, listWatchedAt } from "@/lib/tutorials.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { Badge } from "../../_ui/badge.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../_ui/empty.tsx";
import { CourseCard } from "./_components/course-card.tsx";
import { TutorialCover } from "./_components/tutorial-cover.tsx";

export const metadata = { title: "Ajuda e treinamentos" };

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
  const [courses, tutorials, watchedAt, tenant] = await Promise.all([
    listPublishedCourses(),
    listPublishedTutorials(),
    listWatchedAt(session.user.id),
    getTenant(),
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
  // "Aula 3" only means something in a course watched in order.
  const resumeLabel = resume?.course.sequential
    ? itemLabels(itemsByCourse.get(resume.course.id) ?? []).get(resume.item.id)
    : undefined;
  const canManage = can(
    session.user.role ?? "",
    "tutorials.manage",
    session.user.permissions,
  );

  return (
    <>
      <AdminPageHeader
        title="Ajuda e treinamentos"
        description="Cursos em vídeo: como usar cada tela do painel e o que a equipe precisa saber no dia a dia."
        actions={
          canManage || tenant.demo ? (
            <>
              {/* The demonstration office's own site: what a course learner
                  came to see besides the course. */}
              {tenant.demo && (
                <a
                  href="/"
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Ver o site do cartório de demonstração
                </a>
              )}
              {canManage && (
                <Link
                  href="/admin/ajuda/gerenciar"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Gerenciar vídeos
                </Link>
              )}
            </>
          ) : undefined
        }
      />
      <main className="flex min-w-0 flex-col gap-8 px-4 py-6 md:px-8">
        {shown.length === 0 ? (
          <Empty className="rounded-xl border border-solid bg-card px-6 py-10">
            <EmptyHeader className="max-w-md">
              <EmptyTitle className="font-semibold text-foreground">
                Os vídeos de treinamento estão sendo preparados
              </EmptyTitle>
              <EmptyDescription>
                Assim que o primeiro estiver pronto, ele aparece aqui e na Visão
                geral, sem precisar fazer nada.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {resume && (
              <section
                aria-labelledby="continue-title"
                className="grid grid-cols-1 overflow-hidden rounded-xl border bg-card md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
              >
                <TutorialCover
                  title={resume.item.title}
                  posterUrl={resume.item.posterUrl ?? resume.course.posterUrl}
                />
                <div className="flex flex-col justify-center gap-2.5 p-6 lg:p-8">
                  <Badge className="self-start">
                    {watchedIds.size === 0
                      ? "Comece por aqui"
                      : "Continue de onde parou"}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {resume.course.title}
                    {resumeLabel && ` · ${resumeLabel}`}
                  </span>
                  <h2
                    id="continue-title"
                    className="text-xl leading-tight font-semibold text-foreground"
                  >
                    {resume.item.title}
                  </h2>
                  {resume.item.description && (
                    <p className="line-clamp-3 text-sm leading-normal text-muted-foreground">
                      {resume.item.description}
                    </p>
                  )}
                  <div className="pt-1">
                    <Link
                      href={courseHref(resume.course.slug, resume.item.id)}
                      className={buttonVariants({ size: "sm" })}
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
                className="text-lg leading-tight font-semibold text-foreground"
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
