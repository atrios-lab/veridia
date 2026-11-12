"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatOfficeMonthYear } from "@/core/time/office-time.ts";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUS_LABELS,
  type DocumentStatus,
} from "@/core/transparency/documents.ts";
import type { TransparencyDocumentRow } from "@/lib/transparency.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
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

const STATUS_PILL: Record<DocumentStatus, string> = {
  draft: "bg-warning-soft text-warning-text",
  published: "bg-success-soft text-success-text",
  unpublished: "bg-muted text-muted-foreground",
};

/** A one-field form that fires a document action on submit. */
function ActionForm({
  action,
  id,
  extra,
  disabled,
  variant = "outline",
  className,
  children,
  successMessage,
}: {
  action: (p: ActionState, f: FormData) => Promise<ActionState>;
  id: string;
  extra?: Record<string, string>;
  disabled?: boolean;
  variant?: "default" | "outline";
  className?: string;
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
      <Button
        type="submit"
        variant={variant}
        size="sm"
        disabled={disabled || pending}
        className={className}
      >
        {children}
      </Button>
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

/** What a fee table holds for the prenotação, for its row. */
export interface FeeTableInfo {
  /** The table the site charges from: the first published one. */
  inForce: boolean;
  /** How many of the three prenotações it has values for. */
  items: number;
  source?: "pdf" | "manual";
}

function feeTableNote(info: FeeTableInfo): string {
  if (info.items === 0) return "Prenotação: informar os valores";
  const read = info.source === "pdf" ? " (lidos do PDF, confira)" : "";
  return `Prenotação: ${info.items} de 3 valores${read}`;
}

/** Where the panel serves a transparency document, any state. */
function documentHref(id: string): string {
  return `/admin/transparencia/documento?id=${id}`;
}

function DocumentRow({
  doc,
  isFirst,
  isLast,
  feeTable,
}: {
  doc: TransparencyDocumentRow;
  isFirst: boolean;
  isLast: boolean;
  feeTable?: FeeTableInfo;
}) {
  const status = doc.status as DocumentStatus;
  const size = formatFileSize(doc.fileSizeBytes);
  const meta =
    status === "unpublished" && doc.unpublishedAt
      ? `${doc.category} · ${doc.yearLabel} · ${size} · fora do site desde ${formatOfficeMonthYear(new Date(doc.unpublishedAt))}`
      : `${doc.category} · ${doc.yearLabel} · ${size}`;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
        status === "draft" ? "bg-warning-soft/40" : ""
      }`}
    >
      <div className="flex flex-none flex-col">
        <ActionForm
          action={moveDocumentAction}
          id={doc.id}
          extra={{ direction: "up" }}
          disabled={isFirst}
          className="px-2 disabled:opacity-40"
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
          className="px-2 disabled:opacity-40"
        >
          <span aria-hidden>↓</span>
          <span className="sr-only">Mover para baixo</span>
        </ActionForm>
      </div>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {doc.title}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[status]}`}
          >
            {DOCUMENT_STATUS_LABELS[status]}
          </span>
          {feeTable?.inForce && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
              Vigente
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {meta}
        </span>
        {feeTable && (
          <Link
            href={`/admin/transparencia/tabela/${doc.id}`}
            className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            {feeTableNote(feeTable)} ›
          </Link>
        )}
      </span>

      <a
        href={documentHref(doc.id)}
        target="_blank"
        rel="noopener"
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "flex-none",
        })}
      >
        Ver
      </a>
      {status === "published" ? (
        <ActionForm
          action={unpublishDocumentAction}
          id={doc.id}
          successMessage="Documento despublicado."
        >
          Despublicar
        </ActionForm>
      ) : (
        <ActionForm
          action={publishDocumentAction}
          id={doc.id}
          variant="default"
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
  feeTables = {},
}: {
  documents: TransparencyDocumentRow[];
  /** Fee tables only, keyed by document id. */
  feeTables?: Record<string, FeeTableInfo>;
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
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5">
        <h3 className="flex-1 text-lg font-semibold text-foreground">
          Documentos{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · na ordem em que aparecem no site
          </span>
        </h3>
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filtrar por categoria"
          size="sm"
        >
          <NativeSelectOption value="all">
            Todas as categorias
          </NativeSelectOption>
          {DOCUMENT_CATEGORIES.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum documento nesta categoria ainda.
        </p>
      ) : (
        <div className="divide-y divide-border">
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
                feeTable={feeTables[doc.id]}
              />
            );
          })}
        </div>
      )}

      {filtered.length > INITIAL && (
        <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-muted/50 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Mostrando {visible.length} de {filtered.length} documentos
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="px-0"
          >
            {expanded ? "Ver menos" : "Ver todos"}
          </Button>
        </div>
      )}
    </div>
  );
}
