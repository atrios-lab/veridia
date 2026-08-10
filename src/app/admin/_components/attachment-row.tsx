"use client";

import { useActionState, useEffect } from "react";
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
 * `onDelete` is optional on purpose. A file the citizen sent is their evidence,
 * not the office's to remove; a file the office published is.
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
  onDelete?: (
    previous: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
}) {
  const label = attachmentLabel(attachment.displayName);
  const when = `${meta} ${attachment.createdAtLabel}`;

  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5">
      <a
        href={documentHref(requestId, attachment.id)}
        target="_blank"
        rel="noopener"
        className="min-w-0 flex-1 truncate text-[13px] text-admin-text underline-offset-2 hover:underline"
      >
        {label}
      </a>
      <span className="shrink-0 text-[11.5px] text-admin-faint">{when}</span>
      {onDelete && (
        <DeleteButton
          requestId={requestId}
          attachmentId={attachment.id}
          // Two deliveries carry the same label, so the label alone cannot say
          // which one is about to disappear from the citizen's screen.
          describe={`${label}, ${when}`}
          action={onDelete}
        />
      )}
    </div>
  );
}

function DeleteButton({
  requestId,
  attachmentId,
  describe,
  action,
}: {
  requestId: string;
  attachmentId: string;
  describe: string;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
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

  useEffect(() => {
    // The row survives an error, so the message stays where the row is.
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      className="shrink-0"
      onSubmit={(event) => {
        // Deleting reaches the citizen's screen, so it asks first.
        if (!confirm(`Excluir "${describe}"? O cidadão perde o acesso.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="attachmentId" value={attachmentId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11.5px] font-semibold text-admin-error-text underline disabled:opacity-60"
      >
        {pending ? "Excluindo…" : "Excluir"}
      </button>
    </form>
  );
}
