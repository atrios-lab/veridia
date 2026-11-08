import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  isTutorialKind,
  PANEL_COURSE_SLUG,
  type Tutorial,
} from "@/core/tutorials/catalog.ts";
import { courseOrder, itemLabels } from "@/core/tutorials/course.ts";
import { listAllCourses } from "@/lib/courses.ts";
import { listAllQuestions } from "@/lib/quiz.ts";
import { getSession } from "@/lib/session.ts";
import { listAllTutorials } from "@/lib/tutorials.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { ADMIN_NAV } from "../../../_components/nav.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import {
  type AdminCourseItem,
  type AdminTutorialItem,
  TutorialAdminList,
} from "./_components/tutorial-admin-list.tsx";

export const metadata = { title: "Gerenciar vídeos" };

const ROUTES = ADMIN_NAV.filter((item) => !item.external).map((item) => ({
  href: item.href,
  label: item.label,
}));

/**
 * The platform's screen inside an office's panel: the Átrios account signs
 * in through some serventia's host, like anyone, and what it does here is
 * the same for every serventia. The permission is the gate, not the role
 * by name and not the sidebar (which does not even list this route): a
 * registrador who types the URL gets the same 404 as a route that does not
 * exist, so the screen's existence is not something the panel advertises.
 */
export default async function ManageTutorialsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "tutorials.manage")) {
    notFound();
  }

  const [courseRows, rows, questions] = await Promise.all([
    listAllCourses(),
    listAllTutorials(),
    listAllQuestions(),
  ]);
  const courses: AdminCourseItem[] = courseRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sequential: row.sequential,
    posterUrl: row.posterPath,
    materialUrl: row.materialPath,
    isPanel: row.slug === PANEL_COURSE_SLUG,
    published: row.publishedAt !== null,
    assessment: {
      passingScore: row.passingScore,
      workloadHours: row.workloadHours,
      retryHours: row.retryHours,
    },
    questions: (questions.get(row.id) ?? []).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      active: q.active,
      used: q.used,
    })),
  }));
  // "Aula 3" counted among every video of the course, drafts included:
  // the platform sees where a draft will land once published.
  const labels = new Map<string, string>();
  for (const course of courses) {
    // A reference course is not numbered: its videos are watched in any
    // order.
    if (!course.sequential) continue;
    const inCourse = rows
      .filter((row) => row.courseId === course.id)
      .map(
        (row) =>
          ({
            id: row.id,
            kind: isTutorialKind(row.kind) ? row.kind : "lesson",
          }) as Tutorial,
      );
    for (const [id, label] of itemLabels(courseOrder(inCourse))) {
      labels.set(id, label);
    }
  }
  const items: AdminTutorialItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    durationSeconds: row.durationSeconds,
    route: row.route,
    trail: row.trail,
    hasCaptions: row.captionsPath !== null,
    videoUrl: row.videoPath,
    captionsUrl: row.captionsPath,
    posterUrl: row.posterPath,
    published: row.publishedAt !== null,
    courseId: row.courseId,
    kind: isTutorialKind(row.kind) ? row.kind : "lesson",
    label: labels.get(row.id) ?? "",
  }));

  return (
    <>
      <AdminPageHeader
        title="Gerenciar vídeos"
        back={{ href: "/admin/ajuda", label: "Treinamento" }}
        description="Os cursos do Treinamento e os vídeos de cada um, na ordem em que são assistidos."
      />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <p
          role="note"
          className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-4 py-3 text-[13px] text-admin-warning-text"
        >
          <strong>Conteúdo da plataforma.</strong> O que você publica aqui
          aparece no Treinamento de todas as serventias, não só na que você está
          usando agora.
        </p>
        <TutorialAdminList
          courses={courses}
          items={items}
          routes={ROUTES}
          directUpload={blobUploadEnabled()}
        />
      </main>
    </>
  );
}
