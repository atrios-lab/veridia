"use client";

import { upload } from "@vercel/blob/client";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useState,
} from "react";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import {
  checkTutorialFile,
  describeTutorialFileProblem,
  MAX_DIRECT_BYTES,
  MAX_SERVER_ACTION_BYTES,
  type TutorialFileKind,
  tutorialFilePath,
} from "@/core/tutorials/video.ts";
import { TutorialCover } from "../../_components/tutorial-cover.tsx";
import { type SaveTutorialState, saveCourseAction } from "../actions.ts";

const FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const ERROR_FIELD_CLASS =
  "w-full rounded-[9px] border border-admin-error-border bg-admin-error-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-error-text";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold text-admin-primary";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-semibold text-admin-error-text">
      {message}
    </p>
  );
}

/** What the form needs to know about a course it is editing. */
export interface EditingCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  sequential: boolean;
  posterUrl: string | null;
  materialUrl: string | null;
  /** The panel course keeps its address. */
  isPanel: boolean;
}

type CourseFileKind = Extract<TutorialFileKind, "poster" | "material">;

function pickedFile(data: FormData, field: string): File | null {
  const value = data.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * The platform account's form for one course. Files go the way the video
 * form's do: straight to the store with it configured, in the form without
 * (development), checked here first either way.
 */
export function CourseForm({
  directUpload,
  editing,
  onDone,
}: {
  directUpload: boolean;
  editing?: EditingCourse;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    SaveTutorialState,
    FormData
  >(saveCourseAction, { status: "idle" });
  const [names, setNames] = useState<Partial<Record<CourseFileKind, string>>>(
    {},
  );
  const [localError, setLocalError] = useState<string>();
  // The picked cover, previewed from an object URL before it is sent; the
  // URL is revoked when another file replaces it or the form goes away.
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const formId = useId();
  const limits = directUpload ? MAX_DIRECT_BYTES : MAX_SERVER_ACTION_BYTES;

  useEffect(() => {
    if (state.status === "saved") onDone();
  }, [state, onDone]);

  useEffect(() => {
    if (!posterPreview) return;
    return () => URL.revokeObjectURL(posterPreview);
  }, [posterPreview]);

  function check(file: File, kind: CourseFileKind): string | null {
    const problem = checkTutorialFile(
      { mimeType: file.type, size: file.size },
      kind,
      limits[kind],
    );
    return problem ? describeTutorialFileProblem(problem, kind) : null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const files: [CourseFileKind, File | null][] = [
      ["poster", pickedFile(data, "poster")],
      ["material", pickedFile(data, "material")],
    ];
    for (const [kind, file] of files) {
      const problem = file && check(file, kind);
      if (problem) {
        setLocalError(problem);
        return;
      }
    }
    setLocalError(undefined);
    if (directUpload) {
      setUploading(true);
      try {
        for (const [kind, file] of files) {
          if (!file) continue;
          const blob = await upload(
            tutorialFilePath(kind, crypto.randomUUID(), file.type),
            file,
            {
              access: "public",
              contentType: file.type,
              handleUploadUrl: "/api/treinamento/upload",
            },
          );
          data.set(`${kind}Url`, blob.url);
          data.delete(kind);
        }
      } catch (error) {
        console.error("treinamento.course.upload", error);
        setLocalError("Não foi possível enviar o arquivo. Tente de novo.");
        return;
      } finally {
        setUploading(false);
      }
    }
    startTransition(() => formAction(data));
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const busy = pending || uploading;
  const pickerClass = `relative flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-admin-input-border px-4 py-3 text-center text-[12.5px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${busy ? "cursor-not-allowed opacity-60" : ""}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[14px] border border-admin-border bg-admin-card p-6.5"
    >
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <h3 className="font-serif text-[17px] font-semibold text-admin-primary">
        {editing ? "Editar curso" : "Novo curso"}
      </h3>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-title`}>
            Título
          </label>
          <input
            id={`${formId}-title`}
            name="title"
            defaultValue={editing?.title ?? ""}
            maxLength={80}
            required
            disabled={busy}
            className={fieldErrors.title ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          <FieldError message={fieldErrors.title} />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-slug`}>
            Endereço
          </label>
          <input
            id={`${formId}-slug`}
            name="slug"
            defaultValue={editing?.slug ?? ""}
            maxLength={60}
            required
            readOnly={editing?.isPanel}
            disabled={busy}
            placeholder="lgpd-no-cartorio"
            className={fieldErrors.slug ? ERROR_FIELD_CLASS : FIELD_CLASS}
          />
          <p className="mt-1.5 text-[11px] text-admin-faint">
            {editing?.isPanel
              ? "O endereço do curso do painel não muda."
              : "Fica em /admin/ajuda/<endereço>. Letras minúsculas, números e hífen."}
          </p>
          <FieldError message={fieldErrors.slug} />
        </div>
      </div>

      <div className="mt-4">
        <label className={LABEL_CLASS} htmlFor={`${formId}-description`}>
          Descrição
        </label>
        <textarea
          id={`${formId}-description`}
          name="description"
          defaultValue={editing?.description ?? ""}
          maxLength={LONG_TEXT_MAX}
          rows={2}
          disabled={busy}
          className={fieldErrors.description ? ERROR_FIELD_CLASS : FIELD_CLASS}
        />
        <FieldError message={fieldErrors.description} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className={LABEL_CLASS}>
            Capa (JPEG, PNG ou WebP, opcional)
          </span>
          <span className="mb-2 block w-[176px] overflow-hidden rounded-[8px] border border-admin-border">
            {posterPreview ? (
              // biome-ignore lint/performance/noImgElement: local unpublished file previewed via a blob: object URL, which next/image cannot optimize.
              <img
                src={posterPreview}
                alt="Prévia da capa escolhida"
                className="block aspect-video w-full object-cover"
              />
            ) : (
              <TutorialCover
                title={editing?.title || "Título do curso"}
                posterUrl={editing?.posterUrl ?? null}
                size="thumb"
              />
            )}
          </span>
          <label className={pickerClass}>
            {names.poster ??
              (editing?.posterUrl ? "Trocar a capa" : "Escolher a capa")}
            <input
              type="file"
              name="poster"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setNames((n) => ({ ...n, poster: file?.name }));
                setPosterPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <p className="mt-1.5 text-[11px] text-admin-faint">
            Aparece no card do curso no Treinamento. Até 2 MB, de preferência
            1280×720.
          </p>
          {editing?.posterUrl && !names.poster && (
            <label className="mt-1.5 flex items-center gap-2 text-[12px] text-admin-muted">
              <input type="checkbox" name="removePoster" disabled={busy} />
              Remover a capa atual
            </label>
          )}
          <FieldError message={fieldErrors.poster} />
        </div>
        <div>
          <span className={LABEL_CLASS}>Apostila (PDF, opcional)</span>
          <label className={pickerClass}>
            {names.material ??
              (editing?.materialUrl
                ? "Trocar a apostila"
                : "Escolher a apostila")}
            <input
              type="file"
              name="material"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={busy}
              onChange={(event) =>
                setNames((n) => ({
                  ...n,
                  material: event.target.files?.[0]?.name,
                }))
              }
            />
          </label>
          {editing?.materialUrl && !names.material && (
            <label className="mt-1.5 flex items-center gap-2 text-[12px] text-admin-muted">
              <input type="checkbox" name="removeMaterial" disabled={busy} />
              Remover a apostila atual
            </label>
          )}
          <FieldError message={fieldErrors.material} />
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-[13px] text-admin-text">
        <input
          type="checkbox"
          name="sequential"
          defaultChecked={editing?.sequential ?? false}
          disabled={busy || editing?.isPanel}
          className="mt-0.5"
        />
        <span>
          Aulas em sequência
          <span className="block text-[11.5px] text-admin-muted">
            Cada vídeo abre só depois de assistir ao anterior, conta como
            assistido só ao chegar ao fim e não deixa adiantar.
          </span>
        </span>
      </label>

      {(localError || state.status === "error") && (
        <p
          role="alert"
          className="mt-4 rounded-[9px] border border-admin-error-border bg-admin-error-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-admin-error-text"
        >
          {localError ?? (state.status === "error" ? state.message : "")}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-admin-primary btn-md"
        >
          {uploading
            ? "Enviando os arquivos…"
            : pending
              ? "Salvando…"
              : editing
                ? "Salvar alterações"
                : "Salvar como rascunho"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="btn btn-admin-ghost btn-md"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
