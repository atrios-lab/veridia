"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface AttachmentItem {
  id: string;
  displayName: string;
  createdAtLabel: string;
}

/** What every attachment action in the panel returns. */
type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

type DeleteAction = (
  previous: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Stored names are deliberately not the ones the browser sent: that string is
 * attacker controlled and routinely carries the citizen's full name (see
 * `src/core/request/attachment.ts`). What it stores instead is a slug, and a
 * slug is not something to show a registrar — least of all "office".
 */
const LABELS: Record<string, string> = {
  "documento-final": "Documento final",
  "requerimento-assinado": "Requerimento assinado",
  office: "Relatório de dados",
};

export function attachmentLabel(displayName: string): string {
  return LABELS[displayName] ?? displayName;
}

/** Where the panel serves any attachment, whatever section it belongs to. */
export function documentHref(requestId: string, attachmentId: string): string {
  return `/admin/documento?requestId=${requestId}&attachmentId=${attachmentId}`;
}

/**
 * One attached file, everywhere the panel shows one: the name opens it, the
 * date says when it arrived, and the office can take it back.
 *
 * `onDelete` is optional only because some places have nothing to call — the
 * file that answered a requirement is pinned by it, and the server refuses to
 * remove it anyway.
 */
export function AttachmentRow({
  requestId,
  attachment,
  meta,
  onDelete,
}: {
  requestId: string;
  attachment: AttachmentItem;
  /** Reads before the date: "enviado em", "entregue em". */
  meta: string;
  onDelete?: DeleteAction;
}) {
  const [armed, setArmed] = useState(false);
  const label = attachmentLabel(attachment.displayName);
  const when = `${meta} ${attachment.createdAtLabel}`;

  return (
    <div className="rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <a
          href={documentHref(requestId, attachment.id)}
          target="_blank"
          rel="noopener"
          className="min-w-0 flex-1 truncate text-[13px] text-admin-text underline-offset-2 hover:underline"
        >
          {label}
        </a>
        <span className="shrink-0 text-[11.5px] text-admin-faint">{when}</span>
        {onDelete && !armed && (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="shrink-0 text-[11.5px] font-semibold text-admin-error-text underline"
          >
            Excluir
          </button>
        )}
      </div>
      {onDelete && armed && (
        <DeleteConfirm
          requestId={requestId}
          attachmentId={attachment.id}
          action={onDelete}
          onCancel={() => setArmed(false)}
        />
      )}
    </div>
  );
}

/**
 * Confirmation in the row, not a native `confirm()`: after a few dialogs the
 * browser offers to block them for the tab, and a blocked `confirm()` returns
 * false forever with no sign — the button would just stop working.
 */
function DeleteConfirm({
  requestId,
  attachmentId,
  action,
  onCancel,
}: {
  requestId: string;
  attachmentId: string;
  action: DeleteAction;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    // The toast fires here, not in an effect: on success the action revalidates
    // and this row leaves the tree in the same commit, so an effect on it would
    // never run and the most destructive action in the panel would be the one
    // that says nothing. `toast` is a store outside React, so it survives.
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "success") {
        toast.success("Arquivo excluído. Não aparece mais para o cidadão.");
      }
      return result;
    },
    { status: "idle" },
  );

  // Arming moves the target: the key that opened this has to land on it.
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <form
      action={formAction}
      className="mt-2 border-t border-admin-border pt-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="attachmentId" value={attachmentId} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex-1 text-[11.5px] text-admin-muted">
          Excluir este arquivo? O cidadão perde o acesso a ele na consulta.
        </span>
        <button
          ref={confirmRef}
          type="submit"
          disabled={pending}
          className="shrink-0 text-[11.5px] font-semibold text-admin-error-text underline disabled:opacity-60"
        >
          {pending ? "Excluindo…" : "Confirmar exclusão"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="shrink-0 text-[11.5px] font-semibold text-admin-muted underline disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {/* The row survives an error, so the message stays with the row instead
          of in a toast that leaves before it is read. */}
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-1.5 text-[11.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
