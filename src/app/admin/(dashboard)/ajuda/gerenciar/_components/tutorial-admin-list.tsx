"use client";

import { useActionState, useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { Badge } from "../../../../_ui/badge.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { TutorialCover } from "../../_components/tutorial-cover.tsx";
import {
  deleteCourseAction,
  deleteTutorialAction,
  moveCourseAction,
  moveTutorialAction,
  publishCourseAction,
  publishTutorialAction,
  type TutorialActionState,
  unpublishCourseAction,
  unpublishTutorialAction,
} from "../actions.ts";
import {
  type AdminQuestionItem,
  AssessmentAdmin,
  type AssessmentSettingsItem,
} from "./assessment-admin.tsx";
import { CourseForm, type EditingCourse } from "./course-form.tsx";
import { type EditingTutorial, TutorialForm } from "./tutorial-form.tsx";

/** One row of the management list, as the page serialises it. */
export interface AdminTutorialItem extends EditingTutorial {
  videoUrl: string;
  captionsUrl: string | null;
  published: boolean;
  /** "Aula 3", "Apresentação"…, among this course's videos. */
  label: string;
}

/** One course, as the page serialises it. */
export interface AdminCourseItem extends EditingCourse {
  published: boolean;
  assessment: AssessmentSettingsItem;
  questions: AdminQuestionItem[];
}

function DeleteButton({ item }: { item: AdminTutorialItem }) {
  const [state, formAction, pending] = useActionState<
    TutorialActionState,
    FormData
  >(deleteTutorialAction, { status: "idle" });
  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este vídeo?"
      consequence={`"${item.title}" some de todas as serventias, e a marca de assistido de quem já o viu some junto. Os arquivos são apagados do armazenamento.`}
      confirmLabel="Excluir o vídeo"
      pendingLabel="Excluindo…"
      className="flex-none"
    >
      <input type="hidden" name="id" value={item.id} />
    </ConfirmAction>
  );
}

function Row({
  item,
  index,
  total,
  routeLabel,
  sequential,
  onEdit,
}: {
  item: AdminTutorialItem;
  index: number;
  total: number;
  routeLabel: string | undefined;
  sequential: boolean;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run(action: () => Promise<TutorialActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
    });
  }

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-input text-xs font-semibold text-muted-foreground tabular-nums">
          {index + 1}
        </span>
        <span className="block w-[96px] flex-none overflow-hidden rounded-md border">
          <TutorialCover
            title={item.title}
            posterUrl={item.posterUrl}
            size="thumb"
          />
        </span>
        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {item.title}
            </span>
            {!item.published && (
              <Badge className="bg-warning text-warning-foreground">
                Rascunho
              </Badge>
            )}
            {!item.captionsUrl && (
              <Badge variant="outline" className="text-muted-foreground">
                Sem legenda
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.label && `${item.label} · `}
            {formatDuration(item.durationSeconds)}
            {!sequential &&
              (routeLabel
                ? ` · ensina ${routeLabel}`
                : " · sobre o painel inteiro")}
            {!sequential &&
              (item.trail ? " · primeiros passos" : " · aprofundamento")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            aria-label="Subir"
            title="Subir"
            disabled={pending || index === 0}
            onClick={() => run(() => moveTutorialAction(item.id, "up"))}
            variant="ghost"
            size="icon-sm"
          >
            <AdminIcon name="chevronDown" className="h-4 w-4 rotate-180" />
          </Button>
          <Button
            type="button"
            aria-label="Descer"
            title="Descer"
            disabled={pending || index === total - 1}
            onClick={() => run(() => moveTutorialAction(item.id, "down"))}
            variant="ghost"
            size="icon-sm"
          >
            <AdminIcon name="chevronDown" className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            variant="ghost"
            size="sm"
          >
            {open ? "Fechar" : "Conferir"}
          </Button>
          <Button
            type="button"
            onClick={onEdit}
            disabled={pending}
            variant="outline"
            size="sm"
          >
            Editar
          </Button>
          {item.published ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => unpublishTutorialAction(item.id))}
              variant="outline"
              size="sm"
            >
              Despublicar
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => publishTutorialAction(item.id))}
              size="sm"
            >
              Publicar
            </Button>
          )}
          <DeleteButton item={item} />
        </div>
      </div>
      {open && (
        <div className="border-t px-4 py-4">
          {/* biome-ignore lint/a11y/useMediaCaption: the <track> renders whenever the video has captions; a video without them is the platform's own call, flagged "Sem legenda" where it is managed. */}
          <video
            controls
            preload="metadata"
            crossOrigin="anonymous"
            className="aspect-video w-full max-w-[720px] rounded-lg bg-black"
          >
            <source src={item.videoUrl} type="video/mp4" />
            {item.captionsUrl && (
              <track
                kind="captions"
                src={item.captionsUrl}
                srcLang="pt-BR"
                label="Português"
                default
              />
            )}
          </video>
          {item.description && (
            <p className="mt-3 max-w-[720px] text-sm text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function DeleteCourseButton({ course }: { course: AdminCourseItem }) {
  const [state, formAction, pending] = useActionState<
    TutorialActionState,
    FormData
  >(deleteCourseAction, { status: "idle" });
  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este curso?"
      consequence={`"${course.title}" só pode ser excluído sem vídeos. A capa e a apostila são apagadas do armazenamento.`}
      confirmLabel="Excluir o curso"
      pendingLabel="Excluindo…"
      className="flex-none"
    >
      <input type="hidden" name="id" value={course.id} />
    </ConfirmAction>
  );
}

type Open =
  | { kind: "none" }
  | { kind: "new-course" }
  | { kind: "edit-course"; id: string }
  | { kind: "new-video"; courseId: string }
  | { kind: "edit-video"; id: string };

/**
 * Every course and, under each, its videos, drafts included, in the order
 * each course is watched. Creating or editing opens the form in place;
 * only one form is open at a time.
 */
export function TutorialAdminList({
  courses,
  items,
  routes,
  directUpload,
}: {
  courses: AdminCourseItem[];
  items: AdminTutorialItem[];
  routes: readonly { href: string; label: string }[];
  directUpload: boolean;
}) {
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const [pending, startTransition] = useTransition();
  const close = useCallback(() => setOpen({ kind: "none" }), []);
  const labels = new Map(routes.map((route) => [route.href, route.label]));
  const courseOptions = courses.map((c) => ({
    id: c.id,
    title: c.title,
    sequential: c.sequential,
  }));

  function run(action: () => Promise<TutorialActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {open.kind === "new-course" ? (
        <CourseForm directUpload={directUpload} onDone={close} />
      ) : (
        <div>
          <Button type="button" onClick={() => setOpen({ kind: "new-course" })}>
            <AdminIcon name="plus" className="h-4 w-4" />
            Novo curso
          </Button>
        </div>
      )}

      {courses.map((course, courseIndex) => {
        const videos = items.filter((item) => item.courseId === course.id);
        return (
          <section
            key={course.id}
            aria-label={course.title}
            className="flex flex-col gap-2.5"
          >
            {open.kind === "edit-course" && open.id === course.id ? (
              <CourseForm
                directUpload={directUpload}
                editing={course}
                onDone={close}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
                {/* The course's own cover, apart from its videos': the way
                    in to change it is "Editar curso", right of the title. */}
                <button
                  type="button"
                  onClick={() =>
                    setOpen({ kind: "edit-course", id: course.id })
                  }
                  disabled={pending}
                  aria-label={`Trocar a capa do curso ${course.title}`}
                  title="Trocar a capa do curso"
                  className="group relative block w-[120px] flex-none overflow-hidden rounded-lg border"
                >
                  <TutorialCover
                    title={course.title}
                    posterUrl={course.posterUrl}
                    size="thumb"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {course.posterUrl ? "Trocar capa" : "Pôr capa"}
                  </span>
                </button>
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {course.title}
                    </h2>
                    {!course.published && (
                      <Badge className="bg-warning text-warning-foreground">
                        Rascunho
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-muted-foreground">
                      {course.sequential ? "Em sequência" : "Consulta"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    /admin/ajuda/{course.slug} · {videos.length}{" "}
                    {videos.length === 1 ? "vídeo" : "vídeos"}
                    {course.materialUrl && " · com apostila"}
                    {course.posterUrl ? " · com capa" : " · sem capa"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    aria-label={`Subir o curso ${course.title}`}
                    title="Subir"
                    disabled={pending || courseIndex === 0}
                    onClick={() => run(() => moveCourseAction(course.id, "up"))}
                    variant="ghost"
                    size="icon-sm"
                  >
                    <AdminIcon
                      name="chevronDown"
                      className="h-4 w-4 rotate-180"
                    />
                  </Button>
                  <Button
                    type="button"
                    aria-label={`Descer o curso ${course.title}`}
                    title="Descer"
                    disabled={pending || courseIndex === courses.length - 1}
                    onClick={() =>
                      run(() => moveCourseAction(course.id, "down"))
                    }
                    variant="ghost"
                    size="icon-sm"
                  >
                    <AdminIcon name="chevronDown" className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      setOpen({ kind: "edit-course", id: course.id })
                    }
                    disabled={pending}
                    variant="outline"
                    size="sm"
                  >
                    Editar curso
                  </Button>
                  {course.published ? (
                    <Button
                      type="button"
                      disabled={pending || course.isPanel}
                      onClick={() =>
                        run(() => unpublishCourseAction(course.id))
                      }
                      variant="outline"
                      size="sm"
                    >
                      Despublicar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => publishCourseAction(course.id))}
                      size="sm"
                    >
                      Publicar
                    </Button>
                  )}
                  {!course.isPanel && <DeleteCourseButton course={course} />}
                </div>
              </div>
            )}

            <ol className="flex flex-col gap-2">
              {videos.map((item, index) =>
                open.kind === "edit-video" && open.id === item.id ? (
                  <li key={item.id}>
                    <TutorialForm
                      directUpload={directUpload}
                      routes={routes}
                      courses={courseOptions}
                      editing={item}
                      onDone={close}
                    />
                  </li>
                ) : (
                  <Row
                    key={item.id}
                    item={item}
                    index={index}
                    total={videos.length}
                    routeLabel={item.route ? labels.get(item.route) : undefined}
                    sequential={course.sequential}
                    onEdit={() => setOpen({ kind: "edit-video", id: item.id })}
                  />
                ),
              )}
            </ol>

            {!course.isPanel && (
              <AssessmentAdmin
                courseId={course.id}
                settings={course.assessment}
                questions={course.questions}
              />
            )}

            {open.kind === "new-video" && open.courseId === course.id ? (
              <TutorialForm
                directUpload={directUpload}
                routes={routes}
                courses={courseOptions}
                defaultCourseId={course.id}
                onDone={close}
              />
            ) : (
              <div>
                <Button
                  type="button"
                  onClick={() =>
                    setOpen({ kind: "new-video", courseId: course.id })
                  }
                  variant="ghost"
                  size="sm"
                >
                  <AdminIcon name="plus" className="h-4 w-4" />
                  Novo vídeo neste curso
                </Button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
