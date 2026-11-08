"use client";

import { useActionState, useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../../_components/icon.tsx";
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
      triggerClassName="btn btn-admin-danger btn-sm"
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
    <li className="rounded-[12px] border border-admin-border bg-admin-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-admin-input-border text-[11.5px] font-bold text-admin-muted">
          {index + 1}
        </span>
        <span className="block w-[96px] flex-none overflow-hidden rounded-[6px] border border-admin-border">
          <TutorialCover
            title={item.title}
            posterUrl={item.posterUrl}
            size="thumb"
          />
        </span>
        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-admin-primary">
              {item.title}
            </span>
            {!item.published && (
              <span className="rounded-full bg-admin-warning-soft-bg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-warning-text">
                Rascunho
              </span>
            )}
            {!item.captionsUrl && (
              <span className="rounded-full border border-admin-input-border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-faint">
                Sem legenda
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-admin-muted">
            {item.label} · {formatDuration(item.durationSeconds)}
            {!sequential &&
              (routeLabel
                ? ` · ensina ${routeLabel}`
                : " · sobre o painel inteiro")}
            {!sequential &&
              (item.trail ? " · primeiros passos" : " · aprofundamento")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="Subir"
            title="Subir"
            disabled={pending || index === 0}
            onClick={() => run(() => moveTutorialAction(item.id, "up"))}
            className="btn btn-admin-ghost btn-sm px-2"
          >
            <AdminIcon name="chevronDown" className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Descer"
            title="Descer"
            disabled={pending || index === total - 1}
            onClick={() => run(() => moveTutorialAction(item.id, "down"))}
            className="btn btn-admin-ghost btn-sm px-2"
          >
            <AdminIcon name="chevronDown" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="btn btn-admin-ghost btn-sm"
          >
            {open ? "Fechar" : "Conferir"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="btn btn-admin-secondary btn-sm"
          >
            Editar
          </button>
          {item.published ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => unpublishTutorialAction(item.id))}
              className="btn btn-admin-secondary btn-sm"
            >
              Despublicar
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => publishTutorialAction(item.id))}
              className="btn btn-admin-primary btn-sm"
            >
              Publicar
            </button>
          )}
          <DeleteButton item={item} />
        </div>
      </div>
      {open && (
        <div className="border-t border-admin-border px-4 py-4">
          {/* biome-ignore lint/a11y/useMediaCaption: the <track> renders whenever the video has captions; a video without them is the platform's own call, flagged "Sem legenda" where it is managed. */}
          <video
            controls
            preload="metadata"
            crossOrigin="anonymous"
            className="aspect-video w-full max-w-[720px] rounded-[10px] bg-black"
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
            <p className="mt-3 max-w-[720px] text-[13px] text-admin-muted">
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
      triggerClassName="btn btn-admin-danger btn-sm"
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
          <button
            type="button"
            onClick={() => setOpen({ kind: "new-course" })}
            className="btn btn-admin-primary btn-md"
          >
            <AdminIcon name="plus" className="h-4 w-4" />
            Novo curso
          </button>
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
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-admin-surface px-4 py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
                      {course.title}
                    </h2>
                    {!course.published && (
                      <span className="rounded-full bg-admin-warning-soft-bg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-warning-text">
                        Rascunho
                      </span>
                    )}
                    <span className="rounded-full border border-admin-input-border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-faint">
                      {course.sequential ? "Em sequência" : "Consulta"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-admin-muted">
                    /admin/ajuda/{course.slug} · {videos.length}{" "}
                    {videos.length === 1 ? "vídeo" : "vídeos"}
                    {course.materialUrl && " · com apostila"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Subir o curso ${course.title}`}
                    title="Subir"
                    disabled={pending || courseIndex === 0}
                    onClick={() => run(() => moveCourseAction(course.id, "up"))}
                    className="btn btn-admin-ghost btn-sm px-2"
                  >
                    <AdminIcon
                      name="chevronDown"
                      className="h-4 w-4 rotate-180"
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer o curso ${course.title}`}
                    title="Descer"
                    disabled={pending || courseIndex === courses.length - 1}
                    onClick={() =>
                      run(() => moveCourseAction(course.id, "down"))
                    }
                    className="btn btn-admin-ghost btn-sm px-2"
                  >
                    <AdminIcon name="chevronDown" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpen({ kind: "edit-course", id: course.id })
                    }
                    disabled={pending}
                    className="btn btn-admin-secondary btn-sm"
                  >
                    Editar
                  </button>
                  {course.published ? (
                    <button
                      type="button"
                      disabled={pending || course.isPanel}
                      onClick={() =>
                        run(() => unpublishCourseAction(course.id))
                      }
                      className="btn btn-admin-secondary btn-sm"
                    >
                      Despublicar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => publishCourseAction(course.id))}
                      className="btn btn-admin-primary btn-sm"
                    >
                      Publicar
                    </button>
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
                <button
                  type="button"
                  onClick={() =>
                    setOpen({ kind: "new-video", courseId: course.id })
                  }
                  className="btn btn-admin-ghost btn-sm"
                >
                  <AdminIcon name="plus" className="h-4 w-4" />
                  Novo vídeo neste curso
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
