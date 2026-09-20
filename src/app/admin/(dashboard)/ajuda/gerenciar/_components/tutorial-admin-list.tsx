"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDuration } from "@/core/tutorials/progress.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { AdminIcon } from "../../../../_components/icon.tsx";
import {
  deleteTutorialAction,
  moveTutorialAction,
  publishTutorialAction,
  type TutorialActionState,
  unpublishTutorialAction,
} from "../actions.ts";
import { type EditingTutorial, TutorialForm } from "./tutorial-form.tsx";

/** One row of the management list, as the page serialises it. */
export interface AdminTutorialItem extends EditingTutorial {
  videoUrl: string;
  captionsUrl: string | null;
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
      consequence={`"${item.title}" some de todas as serventias, e a marca de assistido de quem já o viu some junto. O arquivo é apagado do armazenamento.`}
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
  onEdit,
}: {
  item: AdminTutorialItem;
  index: number;
  total: number;
  routeLabel: string | undefined;
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
            {formatDuration(item.durationSeconds)}
            {routeLabel
              ? ` · ensina ${routeLabel}`
              : " · sobre o painel inteiro"}
            {item.trail ? " · primeiros passos" : " · aprofundamento"}
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

/**
 * Every video, drafts included, in trail order, with what the platform
 * account does to them. Editing opens the same form as "Novo vídeo", in
 * place of the row; only one form is open at a time.
 */
export function TutorialAdminList({
  items,
  routes,
  directUpload,
}: {
  items: AdminTutorialItem[];
  routes: readonly { href: string; label: string }[];
  directUpload: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const labels = new Map(routes.map((route) => [route.href, route.label]));

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <TutorialForm
          directUpload={directUpload}
          routes={routes}
          onDone={() => setCreating(false)}
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setCreating(true);
            }}
            className="btn btn-admin-primary btn-md"
          >
            <AdminIcon name="plus" className="h-4 w-4" />
            Novo vídeo
          </button>
        </div>
      )}

      {items.length === 0 && !creating && (
        <p className="rounded-[14px] border border-admin-border bg-admin-card px-6 py-8 text-center text-[13.5px] text-admin-muted">
          Nenhum vídeo ainda. O primeiro entra como rascunho, e só aparece para
          as serventias quando você publicar.
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {items.map((item, index) =>
          editingId === item.id ? (
            <li key={item.id}>
              <TutorialForm
                directUpload={directUpload}
                routes={routes}
                editing={item}
                onDone={() => setEditingId(null)}
              />
            </li>
          ) : (
            <Row
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              routeLabel={item.route ? labels.get(item.route) : undefined}
              onEdit={() => {
                setCreating(false);
                setEditingId(item.id);
              }}
            />
          ),
        )}
      </ol>
    </div>
  );
}
