"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from "@/core/transparency/documents.ts";
import type { TransparencyDocumentRow } from "@/lib/transparency.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import {
  type ActionState,
  deleteDocumentAction,
  moveDocumentAction,
  publishDocumentAction,
  unpublishDocumentAction,
} from "../actions.ts";

/** "259 KB", "1.4 MB": the size beside each document, before opening. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function monthYear(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

const STATUS_PILL: Record<DocumentStatus, string> = {
  draft: "bg-admin-warning-bg text-admin-warning-text",
  published: "bg-admin-success-bg text-admin-success-text",
  unpublished: "bg-admin-readonly-bg text-admin-muted",
};

/** A one-field form that fires a document action on submit. */
function ActionForm({
  action,
  id,
  extra,
  disabled,
  className,
  children,
  successMessage,
}: {
  action: (p: ActionState, f: FormData) => Promise<ActionState>;
  id: string;
  extra?: Record<string, string>;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
  successMessage?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success" && successMessage) {
      toast.success(successMessage);
    }
    if (state.status === "error") toast.error(state.message);
  }, [state, successMessage]);

  return (
    <form action={formAction} className="flex-none">
      <input type="hidden" name="id" value={id} />
      {extra &&
        Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <button
        type="submit"
        disabled={disabled || pending}
        className={className}
      >
        {children}
      </button>
    </form>
  );
}

function DeleteButton({ id, title }: { id: string; title: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await deleteDocumentAction(previous, formData);
      if (result.status === "success") toast.success("Documento removido.");
      return result;
    },
    { status: "idle" },
  );

  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Remover"
      question="Remover este documento?"
      consequence={`"${title}" sai do site e o arquivo é apagado. Não dá para desfazer. Para só tirar do site mantendo o arquivo, use "Despublicar".`}
      confirmLabel="Confirmar remoção"
      pendingLabel="Removendo…"
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/** Where the panel serves a transparency document, any state. */
function documentHref(id: string): string {
  return `/admin/transparencia/documento?id=${id}`;
}

function DocumentRow({
  doc,
  isFirst,
  isLast,
}: {
  doc: TransparencyDocumentRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const status = doc.status as DocumentStatus;
  const size = formatFileSize(doc.fileSizeBytes);
  const meta =
    status === "unpublished" && doc.unpublishedAt
      ? `${doc.category} · ${doc.yearLabel} · ${size} · fora do site desde ${monthYear(new Date(doc.unpublishedAt))}`
      : `${doc.category} · ${doc.yearLabel} · ${size}`;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
        status === "draft" ? "bg-admin-warning-bg/40" : ""
      }`}
    >
      <div className="flex flex-none flex-col">
        <ActionForm
          action={moveDocumentAction}
          id={doc.id}
          extra={{ direction: "up" }}
          disabled={isFirst}
          className="btn btn-admin-secondary btn-sm px-2 disabled:opacity-40"
        >
          <span aria-hidden>↑</span>
          <span className="sr-only">Mover para cima</span>
        </ActionForm>
      </div>
      <div className="flex flex-none flex-col">
        <ActionForm
          action={moveDocumentAction}
          id={doc.id}
          extra={{ direction: "down" }}
          disabled={isLast}
          className="btn btn-admin-secondary btn-sm px-2 disabled:opacity-40"
        >
          <span aria-hidden>↓</span>
          <span className="sr-only">Mover para baixo</span>
        </ActionForm>
      </div>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-bold text-admin-primary">
            {doc.title}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${STATUS_PILL[status]}`}
          >
            {DOCUMENT_STATUS_LABELS[status]}
          </span>
        </span>
        <span className="mt-0.5 block text-[11.5px] text-admin-muted">
          {meta}
        </span>
      </span>

      <a
        href={documentHref(doc.id)}
        target="_blank"
        rel="noopener"
        className="btn btn-admin-secondary btn-sm flex-none"
      >
        Ver
      </a>
      {status === "published" ? (
        <ActionForm
          action={unpublishDocumentAction}
          id={doc.id}
          className="btn btn-admin-secondary btn-sm"
          successMessage="Documento despublicado."
        >
          Despublicar
        </ActionForm>
      ) : (
        <ActionForm
          action={publishDocumentAction}
          id={doc.id}
          className="btn btn-admin-primary btn-sm"
          successMessage="Documento publicado."
        >
          {status === "unpublished" ? "Publicar de novo" : "Publicar"}
        </ActionForm>
      )}
      <DeleteButton id={doc.id} title={doc.title} />
    </div>
  );
}

/**
 * The document list. Filter and "Ver todos" are client state: the whole set
 * arrives from the server and this only decides how much of it to show, so
 * neither needs a round trip.
 */
export function DocumentList({
  documents,
}: {
  documents: TransparencyDocumentRow[];
}) {
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered =
    category === "all"
      ? documents
      : documents.filter((d) => d.category === category);
  const INITIAL = 6;
  const visible = expanded ? filtered : filtered.slice(0, INITIAL);

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-admin-border px-4 py-3.5">
        <h3 className="flex-1 font-serif text-[15.5px] font-semibold text-admin-primary">
          Documentos{" "}
          <span className="font-sans text-[12.5px] font-normal text-admin-muted">
            · na ordem em que aparecem no site
          </span>
        </h3>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filtrar por categoria"
          className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-1.5 text-[12.5px] text-admin-text outline-none focus:border-admin-primary-soft"
        >
          <option value="all">Todas as categorias</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-admin-muted">
          Nenhum documento nesta categoria ainda.
        </p>
      ) : (
        <div className="divide-y divide-admin-border">
          {visible.map((doc) => {
            // Position among the *filtered* view drives the arrows' disabled
            // state; the action still swaps by real neighbour in the full set.
            const index = filtered.indexOf(doc);
            return (
              <DocumentRow
                key={doc.id}
                doc={doc}
                isFirst={index === 0}
                isLast={index === filtered.length - 1}
              />
            );
          })}
        </div>
      )}

      {filtered.length > INITIAL && (
        <div className="flex items-center justify-between border-t border-admin-border px-4 py-3">
          <span className="text-[12px] text-admin-muted">
            Mostrando {visible.length} de {filtered.length} documentos
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn btn-admin-ghost btn-sm px-0"
          >
            {expanded ? "Ver menos" : "Ver todos"}
          </button>
        </div>
      )}
    </div>
  );
}
