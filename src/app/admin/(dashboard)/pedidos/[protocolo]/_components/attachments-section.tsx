"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { type ActionState, deleteAttachmentAction } from "../actions.ts";

interface AttachmentItem {
  id: string;
  displayName: string;
  createdAtLabel: string;
}

function AttachmentRow({
  requestId,
  documentHref,
  attachment,
}: {
  requestId: string;
  documentHref: string;
  attachment: AttachmentItem;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    deleteAttachmentAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5">
      <a
        href={`${documentHref}&attachmentId=${attachment.id}`}
        className="flex-1 text-[13px] text-admin-text underline-offset-2 hover:underline"
      >
        {attachment.displayName}
      </a>
      <span className="text-[11.5px] text-admin-faint">
        enviado em {attachment.createdAtLabel}
      </span>
      <form
        action={action}
        onSubmit={(event) => {
          if (!confirm(`Excluir "${attachment.displayName}"?`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="attachmentId" value={attachment.id} />
        <button
          type="submit"
          disabled={pending}
          className="text-[11.5px] font-semibold text-admin-error-text underline disabled:opacity-60"
        >
          {pending ? "Excluindo…" : "Excluir"}
        </button>
      </form>
    </div>
  );
}

export function AttachmentsSection({
  requestId,
  protocolNumber,
  attachments,
}: {
  requestId: string;
  protocolNumber: string;
  attachments: AttachmentItem[];
}) {
  const documentHref = `/admin/pedidos/${encodeURIComponent(protocolNumber)}/documento?requestId=${requestId}`;

  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
      <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
        Documentos anexados pelo cidadão
      </h4>
      {attachments.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-admin-muted">
          Nenhum documento anexado.
        </p>
      ) : (
        <div className="mt-3.5 flex flex-col gap-2">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              requestId={requestId}
              documentHref={documentHref}
              attachment={attachment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
