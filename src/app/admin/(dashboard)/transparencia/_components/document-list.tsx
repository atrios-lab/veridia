"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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
  makeCurrentFeeTableAction,
  moveDocumentAction,
  publishDocumentAction,
  reorderDocumentsAction,
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

/**
 * "Tornar vigente" (decision of 22/11/2026): one click puts the fee table at
 * the top, published, instead of climbing one row at a time. Asks first: it
 * changes the table the office charges by.
 */
function MakeCurrentButton({ id, title }: { id: string; title: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await makeCurrentFeeTableAction(previous, formData);
      if (result.status === "success") {
        toast.success(`"${title}" é agora a tabela vigente.`);
      }
      return result;
    },
    { status: "idle" },
  );
  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Tornar vigente"
      triggerClassName={buttonVariants({ variant: "default", size: "sm" })}
      question="Tornar esta a tabela vigente?"
      consequence={`"${title}" é publicada (se ainda não estiver) e vai para o topo da lista. O site e as análises passam a usar esta tabela como a vigente, inclusive na prenotação.`}
      confirmLabel="Tornar vigente"
      pendingLabel="Salvando..."
      justify={false}
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/** Where the panel serves a transparency document, any state. */
function documentHref(id: string): string {
  return `/admin/transparencia/documento?id=${id}`;
}

interface DragProps {
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

function DocumentRow({
  doc,
  isFirst,
  isLast,
  feeTable,
  drag,
}: {
  doc: TransparencyDocumentRow;
  isFirst: boolean;
  isLast: boolean;
  feeTable?: FeeTableInfo;
  drag?: DragProps;
}) {
  const status = doc.status as DocumentStatus;
  const size = formatFileSize(doc.fileSizeBytes);
  const meta =
    status === "unpublished" && doc.unpublishedAt
      ? `${doc.category} · ${doc.yearLabel} · ${size} · fora do site desde ${formatOfficeMonthYear(new Date(doc.unpublishedAt))}`
      : `${doc.category} · ${doc.yearLabel} · ${size}`;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a mouse convenience; the arrows beside it move the row by keyboard and touch.
    <div
      draggable={Boolean(drag)}
      onDragStart={(e) => {
        if (!drag) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", doc.id);
        drag.onDragStart();
      }}
      onDragEnter={(e) => {
        if (!drag) return;
        e.preventDefault();
        drag.onDragEnter();
      }}
      onDragOver={(e) => {
        if (drag) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!drag) return;
        e.preventDefault();
        drag.onDrop();
      }}
      onDragEnd={() => drag?.onDragEnd()}
      className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
        status === "draft" ? "bg-warning-soft/40" : ""
      } ${drag?.dragging ? "opacity-50" : ""} ${
        drag?.over ? "border-t-2 border-primary" : ""
      }`}
    >
      {drag && (
        <span
          title="Arraste para mudar a ordem"
          className="flex-none cursor-grab select-none rounded-md border border-border px-1.5 py-1 text-base leading-none text-muted-foreground active:cursor-grabbing"
        >
          <span aria-hidden>⠿</span>
          <span className="sr-only">Arrastar para mudar a ordem</span>
        </span>
      )}
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

      <span className="min-w-48 flex-1">
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

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {feeTable && !feeTable.inForce && (
          <MakeCurrentButton id={doc.id} title={doc.title} />
        )}
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
    </div>
  );
}

type StatusView = "todos" | "site" | "rascunhos" | "fora";

const STATUS_VIEWS: { id: StatusView; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "site", label: "No site" },
  { id: "rascunhos", label: "Rascunhos" },
  { id: "fora", label: "Despublicados" },
];

function inView(doc: TransparencyDocumentRow, view: StatusView): boolean {
  if (view === "site") return doc.status === "published";
  if (view === "rascunhos") return doc.status === "draft";
  if (view === "fora") return doc.status === "unpublished";
  return true;
}

/**
 * The document list. Filter, status tabs and "Ver todos" are client state:
 * the whole set arrives from the server and this only decides how much of
 * it to show. The rows are dragged into place (decision of 22/11/2026: "ter
 * o botão de arrastar"); the order is saved at once, among the rows shown,
 * and the arrows stay for the keyboard and the phone. The drafts sit in
 * their own box at the top, not at the end of the list, where nobody saw
 * them ("um local próximo para mostrar os rascunhos").
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
  const [view, setView] = useState<StatusView>("todos");
  const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState(() => documents.map((d) => d.id));
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // A new list from the server (after any action) is the truth again.
  const serverOrder = documents.map((d) => d.id).join(",");
  useEffect(() => {
    setOrder(serverOrder ? serverOrder.split(",") : []);
  }, [serverOrder]);

  const byId = useMemo(
    () => new Map(documents.map((d) => [d.id, d])),
    [documents],
  );
  const ordered = order
    .map((id) => byId.get(id))
    .filter((d): d is TransparencyDocumentRow => Boolean(d));
  const ofCategory =
    category === "all"
      ? ordered
      : ordered.filter((d) => d.category === category);
  const counts = Object.fromEntries(
    STATUS_VIEWS.map((v) => [
      v.id,
      ofCategory.filter((d) => inView(d, v.id)).length,
    ]),
  ) as Record<StatusView, number>;
  const drafts = ofCategory.filter((d) => d.status === "draft");
  // In "Todos", the drafts go in their box above; the list keeps the rest
  // in the order of the site.
  const filtered =
    view === "todos"
      ? ofCategory.filter((d) => d.status !== "draft")
      : ofCategory.filter((d) => inView(d, view));
  const INITIAL = 6;
  const visible = expanded ? filtered : filtered.slice(0, INITIAL);

  function dropOn(targetId: string, list: TransparencyDocumentRow[]) {
    const from = dragged;
    setDragged(null);
    setOver(null);
    if (!from || from === targetId) return;
    const ids = list.map((d) => d.id);
    if (!ids.includes(from)) return;
    const next = ids.filter((id) => id !== from);
    next.splice(next.indexOf(targetId), 0, from);
    // Optimistic: the rows move now; the server keeps the positions these
    // rows already held between them, in the new order.
    const previous = order;
    const slots = order.filter((id) => ids.includes(id));
    const queue = [...next];
    setOrder(
      order.map((id) => (slots.includes(id) ? (queue.shift() ?? id) : id)),
    );
    const form = new FormData();
    for (const id of next) form.append("ids", id);
    startTransition(async () => {
      const result = await reorderDocumentsAction({ status: "idle" }, form);
      if (result.status === "error") {
        toast.error(result.message);
        setOrder(previous);
      } else {
        toast.success("Ordem salva.");
      }
    });
  }

  function dragProps(
    doc: TransparencyDocumentRow,
    list: TransparencyDocumentRow[],
  ): DragProps | undefined {
    if (list.length < 2) return undefined;
    return {
      dragging: dragged === doc.id,
      over: over === doc.id && dragged !== doc.id,
      onDragStart: () => setDragged(doc.id),
      onDragEnter: () => setOver(doc.id),
      onDragEnd: () => {
        setDragged(null);
        setOver(null);
      },
      onDrop: () => dropOn(doc.id, list),
    };
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5">
        <h3 className="flex-1 text-lg font-semibold text-foreground">
          Documentos{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · na ordem em que aparecem no site; arraste pela alça ⠿ para mudar
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

      <div
        role="tablist"
        aria-label="Situação dos documentos"
        className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5"
      >
        {STATUS_VIEWS.map((v) => {
          const active = view === v.id;
          const alert = v.id === "rascunhos" && counts.rascunhos > 0;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setView(v.id);
                setExpanded(false);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : alert
                    ? "border-warning/50 bg-warning-soft text-warning-text"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label} ({counts[v.id]})
            </button>
          );
        })}
      </div>

      {view === "todos" && drafts.length > 0 && (
        <section
          aria-label="Rascunhos"
          className="border-b border-warning/40 bg-warning-soft/30"
        >
          <p className="px-4 pt-3 text-xs font-semibold text-warning-text">
            Rascunhos ({drafts.length}): ainda não aparecem no site. Publique,
            ou, se for tabela de emolumentos, use "Tornar vigente".
          </p>
          <div className="divide-y divide-border">
            {drafts.map((doc, i) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                isFirst={i === 0}
                isLast={i === drafts.length - 1}
                feeTable={feeTables[doc.id]}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {view === "rascunhos"
            ? "Nenhum rascunho: tudo o que foi enviado já está no site ou fora dele."
            : "Nenhum documento aqui ainda."}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {visible.map((doc) => {
            // Position among the *shown* list drives the arrows' disabled
            // state; the action still swaps by real neighbour in the full set.
            const index = filtered.indexOf(doc);
            return (
              <DocumentRow
                key={doc.id}
                doc={doc}
                isFirst={index === 0}
                isLast={index === filtered.length - 1}
                feeTable={feeTables[doc.id]}
                drag={dragProps(doc, visible)}
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
