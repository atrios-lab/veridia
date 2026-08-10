"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import {
  type AttachmentItem,
  attachmentLabel,
  documentHref,
} from "./attachment-link.ts";
import { ConfirmAction } from "./confirm-action.tsx";
import { AdminIcon } from "./icon.tsx";

export type { AttachmentItem };

/** What every attachment action in the panel returns. */
type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

type DeleteAction = (
  previous: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/** "259 KB", "1.4 MB" — the size the operator sees before opening. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BUTTON = "btn btn-admin-secondary btn-sm shrink-0";

/**
 * One attached file, everywhere the panel shows one: icon, name, when it
 * arrived, how big it is, and explicit "Ver" and "Excluir" buttons — the
 * registrar asked for buttons that look like buttons, not links.
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
  const label = attachmentLabel(attachment.displayName);

  return (
    <div className="rounded-[10px] border border-admin-border bg-admin-input-bg px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-admin-readonly-bg text-admin-muted">
          <AdminIcon name="file" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-admin-text">
            {label}
          </span>
          <span className="block text-[11px] text-admin-muted">
            {meta} {attachment.createdAtLabel}
          </span>
        </span>
        {attachment.sizeBytes != null && (
          <span className="shrink-0 text-[11.5px] text-admin-muted">
            {formatFileSize(attachment.sizeBytes)}
          </span>
        )}
        <a
          href={documentHref(requestId, attachment.id)}
          target="_blank"
          rel="noopener"
          className={BUTTON}
        >
          Ver
        </a>
        {onDelete && (
          <DeleteButton
            requestId={requestId}
            attachmentId={attachment.id}
            label={label}
            action={onDelete}
          />
        )}
      </div>
    </div>
  );
}

function DeleteButton({
  requestId,
  attachmentId,
  label,
  action,
}: {
  requestId: string;
  attachmentId: string;
  /** The file's name, so the dialog names what is about to go. */
  label: string;
  action: DeleteAction;
}) {
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

  return (
    <ConfirmAction
      action={formAction}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este arquivo?"
      consequence={`"${label}" sai do sistema e o cidadão perde o acesso a ele na consulta. Não dá para desfazer.`}
      confirmLabel="Confirmar exclusão"
      pendingLabel="Excluindo…"
      className="shrink-0"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="attachmentId" value={attachmentId} />
    </ConfirmAction>
  );
}
