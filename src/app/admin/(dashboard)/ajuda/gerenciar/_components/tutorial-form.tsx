"use client";

import { upload } from "@vercel/blob/client";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useState,
} from "react";
import {
  checkTutorialFile,
  describeTutorialFileProblem,
  MAX_CAPTIONS_BYTES,
  MAX_VIDEO_BYTES_DIRECT,
  MAX_VIDEO_BYTES_SERVER_ACTION,
  type TutorialFileKind,
  tutorialFilePath,
} from "@/core/tutorials/video.ts";
import { type SaveTutorialState, saveTutorialAction } from "../actions.ts";

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

/** What the form needs to know about a video it is editing. */
export interface EditingTutorial {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  route: string | null;
  trail: boolean;
  hasCaptions: boolean;
}

/**
 * The duration, read from the file by the browser itself: a <video>
 * element off screen loads just the metadata of an object URL. Rejects
 * when the browser cannot parse the file, which is its own kind of
 * validation, since the operator's browser is the one that will play it.
 */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.round(probe.duration));
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata"));
    };
    probe.src = url;
  });
}

function pickedFile(data: FormData, field: string): File | null {
  const value = data.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * The platform account's form for one video, new or being edited.
 *
 * With the store configured (`directUpload`), the files go from the
 * browser straight to the Blob store before the action runs, under a
 * fresh uuid each (see tutorialFilePath), and the action receives their
 * URLs; a video does not fit in a function's request body. Without the
 * store (development) the files ride in the form and the action writes
 * them to disk. Either way the same checks run here first, so a wrong
 * file is refused before any byte leaves the machine.
 */
export function TutorialForm({
  directUpload,
  routes,
  editing,
  onDone,
}: {
  directUpload: boolean;
  /** The panel's own screens, as the "tela ensinada" options. */
  routes: readonly { href: string; label: string }[];
  editing?: EditingTutorial;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    SaveTutorialState,
    FormData
  >(saveTutorialAction, { status: "idle" });
  const [videoName, setVideoName] = useState<string | null>(null);
  const [captionsName, setCaptionsName] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(
    editing?.durationSeconds ?? null,
  );
  const [localError, setLocalError] = useState<string>();
  const [uploading, setUploading] = useState<string>();
  const formId = useId();

  useEffect(() => {
    if (state.status === "saved") onDone();
  }, [state, onDone]);

  const videoLimit = directUpload
    ? MAX_VIDEO_BYTES_DIRECT
    : MAX_VIDEO_BYTES_SERVER_ACTION;

  async function handleVideoChange(file: File | null) {
    setVideoName(file?.name ?? null);
    setLocalError(undefined);
    if (!file) {
      setDuration(editing?.durationSeconds ?? null);
      return;
    }
    const problem = checkTutorialFile(
      { mimeType: file.type, size: file.size },
      "video",
      videoLimit,
    );
    if (problem) {
      setLocalError(describeTutorialFileProblem(problem, "video"));
      setDuration(null);
      return;
    }
    try {
      setDuration(await readDuration(file));
    } catch {
      setLocalError(
        "Não foi possível ler a duração. O arquivo é um MP4 válido?",
      );
      setDuration(null);
    }
  }

  async function uploadDirect(
    file: File,
    kind: TutorialFileKind,
  ): Promise<string> {
    setUploading(
      kind === "video" ? "Enviando o vídeo…" : "Enviando a legenda…",
    );
    const blob = await upload(
      tutorialFilePath(kind, crypto.randomUUID()),
      file,
      {
        access: "public",
        contentType: file.type,
        handleUploadUrl: "/api/treinamento/upload",
        multipart: kind === "video",
      },
    );
    return blob.url;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const video = pickedFile(data, "video");
    const captions = pickedFile(data, "captions");

    if (!editing && !video) {
      setLocalError("Escolha o arquivo do vídeo.");
      return;
    }
    if (video) {
      const problem = checkTutorialFile(
        { mimeType: video.type, size: video.size },
        "video",
        videoLimit,
      );
      if (problem) {
        setLocalError(describeTutorialFileProblem(problem, "video"));
        return;
      }
    }
    if (captions) {
      const problem = checkTutorialFile(
        { mimeType: captions.type, size: captions.size },
        "captions",
        MAX_CAPTIONS_BYTES,
      );
      if (problem) {
        setLocalError(describeTutorialFileProblem(problem, "captions"));
        return;
      }
    }
    if (duration === null) {
      setLocalError("Não foi possível ler a duração do vídeo.");
      return;
    }
    setLocalError(undefined);
    data.set("durationSeconds", String(duration));

    if (directUpload) {
      try {
        if (video) data.set("videoUrl", await uploadDirect(video, "video"));
        if (captions) {
          data.set("captionsUrl", await uploadDirect(captions, "captions"));
        }
      } catch (error) {
        console.error("treinamento.upload", error);
        setLocalError("Não foi possível enviar o arquivo. Tente de novo.");
        setUploading(undefined);
        return;
      } finally {
        setUploading(undefined);
      }
      data.delete("video");
      data.delete("captions");
    }
    startTransition(() => formAction(data));
  }

  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const busy = pending || Boolean(uploading);
  const pickerClass = `relative flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-admin-input-border px-4 py-3 text-center text-[12.5px] font-semibold text-admin-primary focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-admin-accent ${busy ? "cursor-not-allowed opacity-60" : ""}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[14px] border border-admin-border bg-admin-card p-6.5"
    >
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <h3 className="font-serif text-[17px] font-semibold text-admin-primary">
        {editing ? "Editar vídeo" : "Novo vídeo"}
      </h3>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className={LABEL_CLASS}>Arquivo do vídeo (MP4)</span>
          <label className={pickerClass}>
            {videoName ??
              (editing ? "Trocar o vídeo" : "Escolher o arquivo do vídeo")}
            <input
              type="file"
              name="video"
              accept="video/mp4,.mp4"
              className="sr-only"
              disabled={busy}
              onChange={(event) =>
                handleVideoChange(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <p className="mt-1.5 text-[11px] text-admin-faint">
            {duration !== null
              ? `Duração lida do arquivo: ${Math.round(duration / 60)} min ${duration % 60} s.`
              : `Até ${Math.round(videoLimit / (1024 * 1024))} MB. A duração é lida do arquivo.`}
          </p>
          <FieldError message={fieldErrors.video} />
        </div>
        <div>
          <span className={LABEL_CLASS}>Legenda (WebVTT, opcional)</span>
          <label className={pickerClass}>
            {captionsName ??
              (editing?.hasCaptions
                ? "Trocar a legenda"
                : "Escolher a legenda")}
            <input
              type="file"
              name="captions"
              accept="text/vtt,.vtt"
              className="sr-only"
              disabled={busy}
              onChange={(event) =>
                setCaptionsName(event.target.files?.[0]?.name ?? null)
              }
            />
          </label>
          {editing?.hasCaptions && !captionsName && (
            <label className="mt-1.5 flex items-center gap-2 text-[12px] text-admin-muted">
              <input type="checkbox" name="removeCaptions" disabled={busy} />
              Remover a legenda atual
            </label>
          )}
          <FieldError message={fieldErrors.captions} />
        </div>
      </div>

      <div className="mt-4">
        <label className={LABEL_CLASS} htmlFor={`${formId}-title`}>
          Título
        </label>
        <input
          id={`${formId}-title`}
          name="title"
          defaultValue={editing?.title ?? ""}
          maxLength={120}
          required
          disabled={busy}
          className={fieldErrors.title ? ERROR_FIELD_CLASS : FIELD_CLASS}
        />
        <FieldError message={fieldErrors.title} />
      </div>

      <div className="mt-4">
        <label className={LABEL_CLASS} htmlFor={`${formId}-description`}>
          Descrição
        </label>
        <textarea
          id={`${formId}-description`}
          name="description"
          defaultValue={editing?.description ?? ""}
          maxLength={500}
          rows={2}
          disabled={busy}
          className={fieldErrors.description ? ERROR_FIELD_CLASS : FIELD_CLASS}
        />
        <FieldError message={fieldErrors.description} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor={`${formId}-route`}>
            Tela que o vídeo ensina
          </label>
          <select
            id={`${formId}-route`}
            name="route"
            defaultValue={editing?.route ?? ""}
            disabled={busy}
            className={fieldErrors.route ? ERROR_FIELD_CLASS : FIELD_CLASS}
          >
            <option value="">Nenhuma, é sobre o painel inteiro</option>
            {routes.map((route) => (
              <option key={route.href} value={route.href}>
                {route.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-admin-faint">
            A tela escolhida ganha o link "Como usar esta tela".
          </p>
          <FieldError message={fieldErrors.route} />
        </div>
        <label className="flex items-start gap-2.5 pt-6 text-[13px] text-admin-text">
          <input
            type="checkbox"
            name="trail"
            defaultChecked={editing?.trail ?? true}
            disabled={busy}
            className="mt-0.5"
          />
          <span>
            Faz parte dos primeiros passos
            <span className="block text-[11.5px] text-admin-muted">
              Entra na trilha que a Visão geral sugere a quem é novo.
            </span>
          </span>
        </label>
      </div>

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
          {uploading ??
            (pending
              ? "Salvando…"
              : editing
                ? "Salvar alterações"
                : "Salvar como rascunho")}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="btn btn-admin-ghost btn-md"
        >
          Cancelar
        </button>
        {!editing && (
          <span className="text-[11.5px] text-admin-faint">
            O vídeo só aparece para as serventias depois de publicado.
          </span>
        )}
      </div>
    </form>
  );
}
